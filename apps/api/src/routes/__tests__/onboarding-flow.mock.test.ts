import Fastify from "fastify";
import { applyZodCompilers } from "../../lib/zod-compilers.js";
import fastifyRawBody from "fastify-raw-body";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../../lib/errors.js";

const ORG_ID = "org-e2e";

const state = {
  organization: {
    id: ORG_ID,
    name: "Test Organization",
    stripeCustomerId: null as string | null,
    stripeSubscriptionId: null as string | null,
    subscriptionStatus: null as string | null,
    planPriceId: null as string | null,
    currentPeriodEnd: null as Date | null,
    plan: "starter",
    onboardedAt: null as Date | null,
  },
  strategy: {
    id: "strategy-e2e",
    orgId: ORG_ID,
    campaignType: "personalized_outreach",
    videoConfig: null as unknown,
    positioning: { businessModel: "B2B lead generation software" },
    icpDefinition: { idealCustomer: "B2B revenue teams" },
    messagingAngles: {
      outreachMessage:
        "Hi {{FirstName}}, I noticed {{Company}} is focused on growing its pipeline.\nWe help B2B teams create qualified conversations with less manual work.\nOpen to a quick look this week?",
    },
  },
  socialAccounts: [] as Array<{
    orgId: string;
    platform: string;
    platformUserId: string;
    unipileId: string;
    accountName: string;
    avatarUrl?: string | null;
    status: string;
  }>,
  eventIds: new Set<string>(),
};

const { getStripePrice, createSubscriptionCheckoutSession, verifyStripeWebhookEvent } =
  vi.hoisted(() => ({
    getStripePrice: vi.fn(),
    createSubscriptionCheckoutSession: vi.fn(),
    verifyStripeWebhookEvent: vi.fn(),
  }));
const { queueAdd } = vi.hoisted(() => ({ queueAdd: vi.fn() }));
const { launchCampaign } = vi.hoisted(() => ({ launchCampaign: vi.fn() }));

vi.mock("../../config/env.js", () => ({
  env: {
    APIFY_API_KEY: "test-key",
    STRIPE_MOCK_MODE: true,
    STRIPE_PRICE_PERSONALIZED_OUTREACH: "",
    STRIPE_PRICE_AI_VIDEO_AD: "",
    STRIPE_PRICE_UPLOADED_VIDEO: "",
    STRIPE_PRICE_VIDEO_ADDON: "",
    APP_URL: "http://localhost:3000",
    UNIPILE_DSN: "api.example.test:13111",
    UNIPILE_API_KEY: "unipile-key",
    UNIPILE_WEBHOOK_SECRET: "test-secret",
    UNIPILE_WEBHOOK_URL: "https://api.example.test/webhooks/unipile",
  },
}));
vi.mock("../../lib/prisma.js", () => ({
  prisma: {
    strategy: {
      findFirst: vi.fn(async () => state.strategy),
      update: vi.fn(async ({ data }) => {
        Object.assign(state.strategy, data);
        return state.strategy;
      }),
    },
    organization: {
      findUnique: vi.fn(async ({ where }: { where: { id?: string; stripeCustomerId?: string } }) => {
        if (where.id === ORG_ID || where.stripeCustomerId === state.organization.stripeCustomerId) {
          return state.organization;
        }
        return null;
      }),
      update: vi.fn(async ({ data }) => {
        Object.assign(state.organization, data);
        return state.organization;
      }),
    },
    socialAccount: {
      findFirst: vi.fn(async () => state.socialAccounts.find((account) => account.platform === "linkedin" && account.status === "active") ?? null),
      findMany: vi.fn(async () => state.socialAccounts),
      count: vi.fn(async () =>
        state.socialAccounts.filter((account) => account.status === "active").length,
      ),
      upsert: vi.fn(async ({ create }) => {
        const existing = state.socialAccounts.find(
          (account) =>
            account.orgId === create.orgId &&
            account.platform === create.platform &&
            account.platformUserId === create.platformUserId,
        );
        if (!existing) state.socialAccounts.push(create);
        return existing ?? create;
      }),
    },
    stripeWebhookEvent: {
      create: vi.fn(async ({ data }) => {
        if (state.eventIds.has(data.eventId)) throw { code: "P2002" };
        state.eventIds.add(data.eventId);
        return { id: data.eventId };
      }),
      delete: vi.fn(async ({ where }) => {
        state.eventIds.delete(where.eventId);
      }),
    },
    campaign: {
      findFirst: vi.fn(async () => null),
      findMany: vi.fn(async () => []),
      updateMany: vi.fn(async () => ({ count: 0 })),
      create: vi.fn(async () => ({ id: "campaign-onboarding-e2e" })),
    },
    lead: {
      findFirst: vi.fn(async () => null),
      findMany: vi.fn(async () => [{ id: "lead-e2e", reviewStatus: "pending" }]),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    campaignLead: { createMany: vi.fn(async () => ({ count: 1 })) },
    message: { findFirst: vi.fn(), findMany: vi.fn(async () => []) },
  },
}));
vi.mock("../../lib/redis.js", () => ({
  redis: { get: vi.fn(), set: vi.fn(), del: vi.fn() },
}));
vi.mock("../../lib/stripe.js", () => ({
  getStripePrice,
  createSubscriptionCheckoutSession,
  verifyStripeWebhookEvent,
}));
vi.mock("../../lib/queue.js", () => ({
  QUEUE_CAMPAIGN_SEQUENCE: "campaign-sequence",
  campaignSequenceJobId: vi.fn(),
  campaignSequenceQueue: { remove: vi.fn() },
  videoGenerationQueue: { add: queueAdd },
}));
vi.mock("../../services/campaign-step1-chat.js", () => ({
  deliverSequenceStep1ViaChat: vi.fn(),
}));
vi.mock("../../services/campaign-launch.js", () => ({ launchCampaign }));
vi.mock("../../adapters/unipile.js", () => ({
  UnipileAdapter: class {
    createHostedAuthLink = vi.fn(async () => ({ url: "https://unipile.test/link" }));
    getAccountStatus = vi.fn(async () => ({
      id: "unipile-account-1",
      type: "LINKEDIN",
      name: "Ada Lovelace",
      sources: [{ id: "source-1", status: "OK" }],
    }));
  },
  encodeHostedAuthName: (orgId: string) => `lr:${orgId}:signed`,
  decodeHostedAuthName: (name: string) =>
    name === `lr:${ORG_ID}:signed` ? ORG_ID : null,
  isAccountHealthy: () => true,
}));

import { billingRoutes } from "../billing.js";
import { onboardingRoutes } from "../onboarding.js";
import { socialAccountRoutes } from "../social-accounts.js";
import { strategyRoutes } from "../strategy.js";
import { stripeWebhookRoutes } from "../stripe-webhook.js";
import { webhookRoutes } from "../webhooks.js";

async function buildTestApp() {
  const app = Fastify();
  applyZodCompilers(app);
  app.addHook("preHandler", async (request) => {
    request.orgId = ORG_ID;
  });
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      reply.header("X-Request-Id", request.id);
      return reply.status(error.statusCode).send({
        status: error.statusCode,
        code: error.code,
        message: error.message,
        requestId: request.id,
      });
    }
    throw error;
  });
  await app.register(fastifyRawBody, {
    field: "rawBody",
    global: false,
    encoding: false,
    runFirst: true,
  });
  await app.register(strategyRoutes);
  await app.register(billingRoutes);
  await app.register(socialAccountRoutes);
  await app.register(onboardingRoutes);
  await app.register(webhookRoutes);
  await app.register(stripeWebhookRoutes);
  return app;
}

let app: Awaited<ReturnType<typeof buildTestApp>>;

beforeEach(async () => {
  Object.assign(state.organization, {
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    subscriptionStatus: null,
    planPriceId: null,
    currentPeriodEnd: null,
    plan: "starter",
    onboardedAt: null,
  });
  state.strategy.videoConfig = null;
  state.strategy.positioning = { businessModel: "B2B lead generation software" };
  state.strategy.icpDefinition = { idealCustomer: "B2B revenue teams" };
  state.strategy.messagingAngles = {
    outreachMessage:
      "Hi {{FirstName}}, I noticed {{Company}} is focused on growing its pipeline.\nWe help B2B teams create qualified conversations with less manual work.\nOpen to a quick look this week?",
  };
  state.socialAccounts.splice(0);
  state.eventIds.clear();
  getStripePrice.mockReset();
  createSubscriptionCheckoutSession.mockReset();
  verifyStripeWebhookEvent.mockReset();
  queueAdd.mockReset();
  launchCampaign.mockReset();
  launchCampaign.mockResolvedValue({ launched: true, jobCount: 1, audienceRouting: {} });
  getStripePrice.mockImplementation(async (priceId: string) => ({
    priceId,
    unitAmount: null,
    currency: null,
    interval: "month",
  }));
  createSubscriptionCheckoutSession.mockResolvedValue({
    id: "mock_checkout_org-e2e",
    url: "http://localhost:3000/onboarding?step=checkout&status=success",
  });
  verifyStripeWebhookEvent.mockReturnValue({
    id: "evt_subscription_active",
    type: "customer.subscription.created",
    data: {
      object: {
        id: "sub_e2e",
        customer: "cus_e2e",
        status: "active",
        current_period_end: 1_800_000_000,
        metadata: { orgId: ORG_ID, campaignType: "personalized_outreach" },
        items: { data: [{ price: { id: "mock_price_personalized_outreach" } }] },
      },
    },
  });
  app = await buildTestApp();
});

afterEach(async () => {
  await app.close();
});

describe("onboarding backend in Stripe mock mode", () => {
  it("persists video choice through checkout, verified activation, hosted channel connect, and completion", async () => {
    const videoDecision = await app.inject({
      method: "PATCH",
      url: `/strategy/${ORG_ID}/video-decision`,
      payload: {
        enabled: true,
        mode: "personalized",
        source: "generated",
        tone: "professional",
        uploadedVideoUrl: null,
      },
    });
    const pricing = await app.inject({ method: "GET", url: "/billing/pricing" });
    const checkout = await app.inject({
      method: "POST",
      url: "/billing/checkout-session",
      payload: {},
    });
    const activation = await app.inject({
      method: "POST",
      url: "/webhooks/stripe",
      headers: { "stripe-signature": "stripe-mock-signature" },
      payload: { mock: true },
    });
    const replay = await app.inject({
      method: "POST",
      url: "/webhooks/stripe",
      headers: { "stripe-signature": "stripe-mock-signature" },
      payload: { mock: true },
    });
    const connect = await app.inject({
      method: "POST",
      url: "/social-accounts/connect",
      payload: {},
    });
    const hostedCallback = await app.inject({
      method: "POST",
      url: "/webhooks/unipile",
      payload: {
        status: "CREATION_SUCCESS",
        account_id: "unipile-account-1",
        name: `lr:${ORG_ID}:signed`,
      },
    });
    const accounts = await app.inject({ method: "GET", url: "/social-accounts" });
    const complete = await app.inject({
      method: "POST",
      url: "/onboarding/complete",
      payload: {},
    });

    expect(videoDecision.statusCode).toBe(200);
    expect(pricing.statusCode).toBe(200);
    expect(checkout.json()).toEqual({
      url: "http://localhost:3000/onboarding?step=checkout&status=success",
    });
    expect(activation.json()).toEqual({ received: true });
    expect(replay.json()).toEqual({ received: true, duplicate: true });
    expect(state.organization.subscriptionStatus).toBe("active");
    expect(connect.json()).toEqual({ url: "https://unipile.test/link" });
    expect(hostedCallback.json()).toEqual({ received: true, handled: true });
    expect(accounts.json()).toMatchObject({
      accounts: [expect.objectContaining({ platform: "linkedin", status: "active" })],
    });
    expect(complete.json()).toEqual({
      completed: true,
      campaignId: "campaign-onboarding-e2e",
      launched: false,
      reviewRequired: true,
      prospectCount: 1,
    });
    expect(state.organization.onboardedAt).toBeInstanceOf(Date);
  });
});
