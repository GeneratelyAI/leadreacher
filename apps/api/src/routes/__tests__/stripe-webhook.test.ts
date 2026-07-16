import Fastify from "fastify";
import fastifyRawBody from "fastify-raw-body";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  stripeWebhookEventCreate,
  stripeWebhookEventDelete,
  organizationFindUnique,
  organizationUpdate,
  strategyFindFirst,
  campaignFindFirst,
  leadFindFirst,
} = vi.hoisted(() => ({
  stripeWebhookEventCreate: vi.fn(),
  stripeWebhookEventDelete: vi.fn(),
  organizationFindUnique: vi.fn(),
  organizationUpdate: vi.fn(),
  strategyFindFirst: vi.fn(),
  campaignFindFirst: vi.fn(),
  leadFindFirst: vi.fn(),
}));
const { verifyStripeWebhookEvent } = vi.hoisted(() => ({
  verifyStripeWebhookEvent: vi.fn(),
}));
const { add } = vi.hoisted(() => ({ add: vi.fn() }));

vi.mock("../../config/env.js", () => ({
  env: { STRIPE_MOCK_MODE: true },
}));
vi.mock("../../lib/prisma.js", () => ({
  prisma: {
    stripeWebhookEvent: {
      create: stripeWebhookEventCreate,
      delete: stripeWebhookEventDelete,
    },
    organization: {
      findUnique: organizationFindUnique,
      update: organizationUpdate,
    },
    strategy: { findFirst: strategyFindFirst },
    campaign: { findFirst: campaignFindFirst },
    lead: { findFirst: leadFindFirst },
  },
}));
vi.mock("../../lib/stripe.js", () => ({ verifyStripeWebhookEvent }));
vi.mock("../../lib/queue.js", () => ({
  QUEUE_VIDEO_GENERATION: "video-generation",
  videoGenerationQueue: { add },
}));

import { stripeWebhookRoutes } from "../stripe-webhook.js";

const subscriptionEvent = {
  id: "evt_subscription_created",
  type: "customer.subscription.created",
  data: {
    object: {
      id: "sub_123",
      customer: "cus_123",
      status: "active",
      current_period_end: 1_800_000_000,
      metadata: {
        orgId: "org-1",
        campaignType: "personalized_outreach",
      },
      items: { data: [{ price: { id: "price_personalized" } }] },
    },
  },
};

async function buildTestApp() {
  const app = Fastify();
  await app.register(fastifyRawBody, {
    field: "rawBody",
    global: false,
    encoding: false,
    runFirst: true,
  });
  await app.register(stripeWebhookRoutes);
  return app;
}

let app: Awaited<ReturnType<typeof buildTestApp>>;

beforeEach(async () => {
  stripeWebhookEventCreate.mockReset();
  stripeWebhookEventDelete.mockReset();
  organizationFindUnique.mockReset();
  organizationUpdate.mockReset();
  strategyFindFirst.mockReset();
  campaignFindFirst.mockReset();
  leadFindFirst.mockReset();
  verifyStripeWebhookEvent.mockReset();
  add.mockReset();

  stripeWebhookEventCreate.mockResolvedValue({ id: "record-1" });
  organizationFindUnique.mockResolvedValue({
    id: "org-1",
    subscriptionStatus: null,
  });
  organizationUpdate.mockResolvedValue({ id: "org-1" });
  strategyFindFirst.mockResolvedValue({
    id: "strategy-1",
    campaignType: "personalized_outreach",
    videoConfig: { enabled: true, mode: "personalized", source: "generated" },
  });
  campaignFindFirst.mockResolvedValue({ id: "campaign-1", name: "Q3 outreach" });
  leadFindFirst.mockResolvedValue({ id: "lead-1" });
  verifyStripeWebhookEvent.mockReturnValue(subscriptionEvent);
  app = await buildTestApp();
});

afterEach(async () => {
  await app.close();
});

describe("POST /webhooks/stripe", () => {
  it("verifies an event, updates entitlement, and queues one personalized template on first activation", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/webhooks/stripe",
      headers: { "stripe-signature": "stripe-mock-signature" },
      payload: subscriptionEvent,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ received: true });
    expect(organizationUpdate).toHaveBeenCalledWith({
      where: { id: "org-1" },
      data: {
        stripeCustomerId: "cus_123",
        stripeSubscriptionId: "sub_123",
        subscriptionStatus: "active",
        planPriceId: "price_personalized",
        currentPeriodEnd: new Date(1_800_000_000 * 1000),
        plan: "personalized_outreach",
      },
    });
    expect(add).toHaveBeenCalledWith(
      "personalized-template-orchestrate",
      expect.objectContaining({
        orgId: "org-1",
        campaignId: "campaign-1",
        pipeline: "personalized",
        jobType: "template-orchestrate",
      }),
      expect.objectContaining({
        jobId: "personalized-template:campaign-1:1",
      }),
    );
  });

  it("is replay-safe and does not repeat entitlement changes or queue work", async () => {
    stripeWebhookEventCreate.mockRejectedValue({ code: "P2002" });

    const response = await app.inject({
      method: "POST",
      url: "/webhooks/stripe",
      headers: { "stripe-signature": "stripe-mock-signature" },
      payload: subscriptionEvent,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ received: true, duplicate: true });
    expect(organizationUpdate).not.toHaveBeenCalled();
    expect(add).not.toHaveBeenCalled();
  });

  it("does not enqueue video when the persisted video decision is disabled", async () => {
    strategyFindFirst.mockResolvedValue({
      id: "strategy-1",
      videoConfig: { enabled: false, mode: null, source: null },
    });

    const response = await app.inject({
      method: "POST",
      url: "/webhooks/stripe",
      headers: { "stripe-signature": "stripe-mock-signature" },
      payload: subscriptionEvent,
    });

    expect(response.statusCode).toBe(200);
    expect(add).not.toHaveBeenCalled();
  });

  it("does not enqueue Google generation for an uploaded video campaign", async () => {
    strategyFindFirst.mockResolvedValue({
      id: "strategy-1",
      campaignType: "uploaded_video",
      videoConfig: {
        enabled: true,
        mode: null,
        source: "uploaded",
        uploadedVideoUrl: "https://cdn.example/video.mp4",
      },
    });

    const response = await app.inject({
      method: "POST",
      url: "/webhooks/stripe",
      headers: { "stripe-signature": "stripe-mock-signature" },
      payload: subscriptionEvent,
    });

    expect(response.statusCode).toBe(200);
    expect(add).not.toHaveBeenCalled();
  });

  it("rejects a webhook with an invalid signature", async () => {
    verifyStripeWebhookEvent.mockImplementation(() => {
      throw new Error("Invalid Stripe mock webhook signature");
    });

    const response = await app.inject({
      method: "POST",
      url: "/webhooks/stripe",
      headers: { "stripe-signature": "invalid" },
      payload: subscriptionEvent,
    });

    expect(response.statusCode).toBe(400);
    expect(stripeWebhookEventCreate).not.toHaveBeenCalled();
  });
});
