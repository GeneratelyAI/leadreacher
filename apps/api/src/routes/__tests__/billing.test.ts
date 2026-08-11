import Fastify from "fastify";
import { applyZodCompilers } from "../../lib/zod-compilers.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../../lib/errors.js";

const { strategyFindFirst, organizationFindUnique } = vi.hoisted(() => ({
  strategyFindFirst: vi.fn(),
  organizationFindUnique: vi.fn(),
}));
const {
  getStripePrice,
  createBillingPortalSession,
  createSubscriptionCheckoutSession,
  retrieveSubscriptionCheckoutSession,
} = vi.hoisted(() => ({
  getStripePrice: vi.fn(),
  createBillingPortalSession: vi.fn(),
  createSubscriptionCheckoutSession: vi.fn(),
  retrieveSubscriptionCheckoutSession: vi.fn(),
}));
const { reconcileCompletedStripeCheckout } = vi.hoisted(() => ({
  reconcileCompletedStripeCheckout: vi.fn(),
}));

vi.mock("../../config/env.js", () => ({
  env: {
    STRIPE_MOCK_MODE: true,
    STRIPE_PRICE_PERSONALIZED_OUTREACH: "",
    STRIPE_PRICE_AI_VIDEO_AD: "",
    STRIPE_PRICE_UPLOADED_VIDEO: "",
    STRIPE_PRICE_VIDEO_ADDON: "",
    APP_URL: "http://localhost:3000",
  },
}));
vi.mock("../../lib/prisma.js", () => ({
  prisma: {
    strategy: { findFirst: strategyFindFirst },
    organization: { findUnique: organizationFindUnique },
  },
}));
vi.mock("../../lib/stripe.js", () => ({
  createBillingPortalSession,
  getStripePrice,
  createSubscriptionCheckoutSession,
  retrieveSubscriptionCheckoutSession,
}));
vi.mock("../../services/stripe-subscription-sync.js", () => ({
  reconcileCompletedStripeCheckout,
}));

import { billingRoutes } from "../billing.js";

const strategy = {
  id: "strategy-1",
  orgId: "org-1",
  campaignType: "personalized_outreach",
  videoConfig: {
    enabled: true,
    mode: "personalized",
    source: "generated",
  },
};

async function buildTestApp() {
  const app = Fastify();
  applyZodCompilers(app);
  app.addHook("preHandler", async (request) => {
    request.orgId = "org-1";
  });
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof AppError) {
      return reply
        .status(error.statusCode)
        .send({ code: error.code, message: error.message });
    }
    throw error;
  });
  await app.register(billingRoutes);
  return app;
}

let app: Awaited<ReturnType<typeof buildTestApp>>;

beforeEach(async () => {
  strategyFindFirst.mockReset();
  organizationFindUnique.mockReset();
  getStripePrice.mockReset();
  createBillingPortalSession.mockReset();
  createSubscriptionCheckoutSession.mockReset();
  retrieveSubscriptionCheckoutSession.mockReset();
  reconcileCompletedStripeCheckout.mockReset();

  strategyFindFirst.mockResolvedValue(strategy);
  organizationFindUnique.mockResolvedValue({
    id: "org-1",
    stripeCustomerId: null,
  });
  getStripePrice.mockImplementation(async (priceId: string) => ({
    priceId,
    unitAmount: null,
    currency: null,
    interval: "month",
  }));
  createSubscriptionCheckoutSession.mockResolvedValue({
    id: "mock_checkout_org-1",
    url: "http://localhost:3000/onboarding?step=checkout&status=success",
  });
  createBillingPortalSession.mockResolvedValue({
    url: "http://localhost:3000/dashboard?billing=portal",
  });
  retrieveSubscriptionCheckoutSession.mockResolvedValue({
    status: "complete",
    client_reference_id: "org-1",
    metadata: { orgId: "org-1" },
  });
  reconcileCompletedStripeCheckout.mockResolvedValue({
    orgId: "org-1",
    subscriptionStatus: "active",
  });
  app = await buildTestApp();
});

afterEach(async () => {
  await app.close();
});

describe("billing routes", () => {
  it("returns catalog line items with Stripe-provided display fields", async () => {
    const response = await app.inject({ method: "GET", url: "/billing/pricing" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      lineItems: [
        {
          key: "personalized_outreach",
          priceId: "mock_price_personalized_outreach",
          label: "Personalized outreach",
          unitAmount: null,
          currency: null,
          interval: "month",
        },
        {
          key: "video_addon",
          priceId: "mock_price_video_addon",
          label: "Video personalization",
          unitAmount: null,
          currency: null,
          interval: "month",
        },
      ],
    });
    expect(getStripePrice).toHaveBeenCalledTimes(2);
  });

  it("creates a hosted Stripe subscription Checkout session without accepting client prices", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/billing/checkout-session",
      payload: {},
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      url: "http://localhost:3000/onboarding?step=checkout&status=success",
    });
    expect(createSubscriptionCheckoutSession).toHaveBeenCalledWith({
      orgId: "org-1",
      strategyId: "strategy-1",
      campaignType: "personalized_outreach",
      videoEnabled: true,
      priceIds: ["mock_price_personalized_outreach", "mock_price_video_addon"],
      customerId: null,
    });
  });

  it("rejects checkout when campaign type has not been selected", async () => {
    strategyFindFirst.mockResolvedValue({ ...strategy, campaignType: null });

    const response = await app.inject({
      method: "POST",
      url: "/billing/checkout-session",
      payload: {},
    });

    expect(response.statusCode).toBe(400);
    expect(createSubscriptionCheckoutSession).not.toHaveBeenCalled();
  });

  it("creates a Stripe billing portal session for an existing customer", async () => {
    organizationFindUnique.mockResolvedValue({
      id: "org-1",
      stripeCustomerId: "cus_123",
    });

    const response = await app.inject({
      method: "POST",
      url: "/billing/portal-session",
      payload: {},
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      url: "http://localhost:3000/dashboard?billing=portal",
    });
    expect(createBillingPortalSession).toHaveBeenCalledWith("cus_123");
  });

  it("reconciles a completed Checkout return without waiting for a webhook", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/billing/checkout-session/reconcile",
      payload: { sessionId: "cs_test_123" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      checkoutStatus: "complete",
      subscriptionStatus: "active",
    });
    expect(retrieveSubscriptionCheckoutSession).toHaveBeenCalledWith("cs_test_123");
    expect(reconcileCompletedStripeCheckout).toHaveBeenCalled();
  });

  it("refuses a Checkout session owned by a different organization", async () => {
    retrieveSubscriptionCheckoutSession.mockResolvedValue({
      status: "complete",
      client_reference_id: "org-2",
      metadata: { orgId: "org-2" },
    });

    const response = await app.inject({
      method: "POST",
      url: "/billing/checkout-session/reconcile",
      payload: { sessionId: "cs_test_other" },
    });

    expect(response.statusCode).toBe(403);
    expect(reconcileCompletedStripeCheckout).not.toHaveBeenCalled();
  });

  it("rejects billing portal access when no Stripe customer exists", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/billing/portal-session",
      payload: {},
    });

    expect(response.statusCode).toBe(400);
    expect(createBillingPortalSession).not.toHaveBeenCalled();
  });
});
