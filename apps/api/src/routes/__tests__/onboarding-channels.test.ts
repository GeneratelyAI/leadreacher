import Fastify from "fastify";
import { applyZodCompilers } from "../../lib/zod-compilers.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../../lib/errors.js";

const {
  socialAccountFindMany,
  socialAccountCount,
  socialAccountFindFirst,
  messageFindMany,
  organizationFindUnique,
  organizationUpdate,
  strategyFindFirst,
  strategyUpdate,
  campaignFindFirst,
  campaignCreate,
} = vi.hoisted(() => ({
  socialAccountFindMany: vi.fn(),
  socialAccountCount: vi.fn(),
  socialAccountFindFirst: vi.fn(),
  messageFindMany: vi.fn(),
  organizationFindUnique: vi.fn(),
  organizationUpdate: vi.fn(),
  strategyFindFirst: vi.fn(),
  strategyUpdate: vi.fn(),
  campaignFindFirst: vi.fn(),
  campaignCreate: vi.fn(),
}));
const { createHostedAuthLink } = vi.hoisted(() => ({
  createHostedAuthLink: vi.fn(),
}));
const { getDailySendLimitStatus } = vi.hoisted(() => ({
  getDailySendLimitStatus: vi.fn(),
}));

vi.mock("../../config/env.js", () => ({
  env: {
    UNIPILE_DSN: "api.example.test:13111",
    UNIPILE_API_KEY: "unipile-key",
    UNIPILE_WEBHOOK_SECRET: "webhook-secret",
    UNIPILE_WEBHOOK_URL: "https://api.example.test/webhooks/unipile",
    APP_URL: "http://localhost:3000",
  },
}));
vi.mock("../../lib/prisma.js", () => ({
  prisma: {
    socialAccount: {
      findMany: socialAccountFindMany,
      count: socialAccountCount,
      findFirst: socialAccountFindFirst,
    },
    message: {
      findMany: messageFindMany,
    },
    organization: {
      findUnique: organizationFindUnique,
      update: organizationUpdate,
    },
    strategy: {
      findFirst: strategyFindFirst,
      update: strategyUpdate,
    },
    campaign: {
      findFirst: campaignFindFirst,
      create: campaignCreate,
    },
  },
}));
vi.mock("../../adapters/unipile.js", () => ({
  UnipileAdapter: class {
    createHostedAuthLink = createHostedAuthLink;
  },
  isAccountHealthy: vi.fn(),
  encodeHostedAuthName: (orgId: string) => `lr:${orgId}:signed`,
}));
vi.mock("../../lib/rate-limiter.js", () => ({ getDailySendLimitStatus }));

import { onboardingRoutes } from "../onboarding.js";
import { socialAccountRoutes } from "../social-accounts.js";

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
  await app.register(socialAccountRoutes);
  await app.register(onboardingRoutes);
  return app;
}

let app: Awaited<ReturnType<typeof buildTestApp>>;

beforeEach(async () => {
  socialAccountFindMany.mockReset();
  socialAccountCount.mockReset();
  socialAccountFindFirst.mockReset();
  messageFindMany.mockReset();
  organizationFindUnique.mockReset();
  organizationUpdate.mockReset();
  strategyFindFirst.mockReset();
  strategyUpdate.mockReset();
  campaignFindFirst.mockReset();
  campaignCreate.mockReset();
  createHostedAuthLink.mockReset();
  getDailySendLimitStatus.mockReset();

  socialAccountFindMany.mockResolvedValue([
    {
      id: "sa-1",
      platform: "linkedin",
      accountName: "Ada Lovelace",
      avatarUrl: "https://example.test/avatar.png",
      status: "active",
      createdAt: new Date("2026-05-10T00:00:00.000Z"),
      updatedAt: new Date("2026-05-10T00:00:00.000Z"),
      unipileId: "unipile-1",
      campaignChannelAccounts: [
        { channel: "linkedin", campaign: { id: "campaign-1", name: "Q3 outreach", status: "active" } },
      ],
      senderCampaigns: [],
    },
  ]);
  messageFindMany.mockResolvedValue([
    { campaignId: "campaign-1", channel: "linkedin", leadId: "lead-1" },
    { campaignId: "campaign-1", channel: "linkedin", leadId: "lead-1" },
    { campaignId: "campaign-1", channel: "linkedin", leadId: "lead-2" },
  ]);
  getDailySendLimitStatus.mockImplementation(async (_accountId: string, kind: string) => ({
    limit: kind === "invite" ? 20 : 50,
    remaining: kind === "invite" ? 18 : 47,
    resetAt: "2026-07-14T00:00:00.000Z",
  }));
  socialAccountCount.mockResolvedValue(1);
  socialAccountFindFirst.mockResolvedValue({ id: "sa-1" });
  organizationFindUnique.mockResolvedValue({
    id: "org-1",
    name: "Ada's workspace",
    subscriptionStatus: "active",
  });
  organizationUpdate.mockResolvedValue({
    id: "org-1",
    onboardedAt: new Date("2026-07-13T00:00:00.000Z"),
  });
  strategyFindFirst.mockResolvedValue({
    id: "strategy-1",
    positioning: { businessModel: "B2B lead generation" },
    icpDefinition: { idealCustomer: "Revenue leaders" },
    messagingAngles: {
      outreachMessage: "Hi {{FirstName}}, I help {{Company}} start more qualified conversations.",
    },
    videoConfig: { tone: "professional" },
  });
  strategyUpdate.mockResolvedValue({});
  campaignFindFirst.mockResolvedValue(null);
  campaignCreate.mockResolvedValue({ id: "campaign-onboarding-1" });
  createHostedAuthLink.mockResolvedValue({
    url: "https://account.unipile.com/hosted-auth-link",
  });
  app = await buildTestApp();
});

afterEach(async () => {
  await app.close();
});

describe("channel connection and onboarding completion", () => {
  it("lists connected channels and creates a hosted-auth link bound to the organization", async () => {
    const list = await app.inject({ method: "GET", url: "/social-accounts" });
    const connect = await app.inject({
      method: "POST",
      url: "/social-accounts/connect",
      payload: {},
    });

    expect(list.statusCode).toBe(200);
    expect(list.json()).toMatchObject({
      accounts: [
        {
          id: "sa-1",
          platform: "linkedin",
          accountName: "Ada Lovelace",
          avatarUrl: "https://example.test/avatar.png",
          status: "active",
          health: "healthy",
          messagesSent: 3,
          prospectsReached: 2,
          assignedCampaigns: [{ id: "campaign-1", name: "Q3 outreach", status: "active" }],
          capacity: {
            invites: { limit: 20, remaining: 18 },
            messages: { limit: 50, remaining: 47 },
          },
        },
      ],
      summary: {
        connectedChannels: 1,
        healthyPercent: 100,
        messagesSent: 3,
        prospectsReached: 2,
      },
    });
    expect(connect.statusCode).toBe(200);
    expect(connect.json()).toEqual({
      url: "https://account.unipile.com/hosted-auth-link",
    });
    expect(createHostedAuthLink).toHaveBeenCalledWith(
      expect.objectContaining({
        providers: ["LINKEDIN"],
        name: "lr:org-1:signed",
        notifyUrl: "https://api.example.test/webhooks/unipile",
        successRedirectUrl: "http://localhost:3000/onboarding?step=channels&status=connected",
        failureRedirectUrl: "http://localhost:3000/onboarding?step=channels&status=failed",
      }),
    );
  });

  it("isolates usage, campaign assignments, and capacity per connected LinkedIn account", async () => {
    socialAccountFindMany.mockResolvedValueOnce([
      {
        id: "sa-1",
        platform: "linkedin",
        accountName: "Ada Lovelace",
        avatarUrl: null,
        status: "active",
        createdAt: new Date("2026-05-10T00:00:00.000Z"),
        updatedAt: new Date("2026-05-10T00:00:00.000Z"),
        unipileId: "unipile-1",
        campaignChannelAccounts: [{ channel: "linkedin", campaign: { id: "campaign-1", name: "Q3 outreach", status: "active" } }],
        senderCampaigns: [],
      },
      {
        id: "sa-2",
        platform: "linkedin",
        accountName: "Grace Hopper",
        avatarUrl: null,
        status: "active",
        createdAt: new Date("2026-05-11T00:00:00.000Z"),
        updatedAt: new Date("2026-05-11T00:00:00.000Z"),
        unipileId: "unipile-2",
        campaignChannelAccounts: [{ channel: "linkedin", campaign: { id: "campaign-2", name: "Enterprise", status: "review" } }],
        senderCampaigns: [],
      },
    ]);
    messageFindMany
      .mockResolvedValueOnce([
        { campaignId: "campaign-1", channel: "linkedin", leadId: "lead-1" },
        { campaignId: "campaign-1", channel: "linkedin", leadId: "lead-2" },
        { campaignId: "campaign-2", channel: "linkedin", leadId: "lead-3" },
      ])
      .mockResolvedValueOnce([]);
    getDailySendLimitStatus.mockImplementation(async (accountId: string, kind: string) => ({
      limit: kind === "invite" ? 20 : 50,
      remaining: accountId === "unipile-1" ? 10 : 5,
      resetAt: "2026-07-14T00:00:00.000Z",
    }));

    const response = await app.inject({ method: "GET", url: "/social-accounts" });

    expect(response.statusCode).toBe(200);
    expect(response.json().accounts).toEqual([
      expect.objectContaining({ id: "sa-1", messagesSent: 2, prospectsReached: 2, assignedCampaigns: [expect.objectContaining({ id: "campaign-1" })], capacity: expect.objectContaining({ messages: expect.objectContaining({ remaining: 10 }) }) }),
      expect.objectContaining({ id: "sa-2", messagesSent: 1, prospectsReached: 1, assignedCampaigns: [expect.objectContaining({ id: "campaign-2" })], capacity: expect.objectContaining({ messages: expect.objectContaining({ remaining: 5 }) }) }),
    ]);
  });

  it("marks onboarding complete only for an active subscription with a connected channel", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/onboarding/complete",
      payload: {},
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ completed: true, campaignId: "campaign-onboarding-1" });
    expect(organizationUpdate).toHaveBeenCalledWith({
      where: { id: "org-1" },
      data: { onboardedAt: expect.any(Date) },
    });
    expect(campaignCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          strategyId: "strategy-1",
          status: "review",
          socialAccountId: "sa-1",
        }),
      }),
    );
  });

  it("is idempotent when onboarding was already completed", async () => {
    organizationFindUnique.mockResolvedValue({
      id: "org-1",
      name: "Ada's workspace",
      subscriptionStatus: "active",
      onboardedAt: new Date("2026-07-13T00:00:00.000Z"),
    });
    campaignFindFirst.mockResolvedValue({ id: "campaign-onboarding-1" });

    const response = await app.inject({
      method: "POST",
      url: "/onboarding/complete",
      payload: {},
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ completed: true, campaignId: "campaign-onboarding-1" });
    expect(organizationUpdate).not.toHaveBeenCalled();
  });

  it("refuses completion when entitlement is not active", async () => {
    organizationFindUnique.mockResolvedValue({
      id: "org-1",
      subscriptionStatus: "incomplete",
    });

    const response = await app.inject({
      method: "POST",
      url: "/onboarding/complete",
      payload: {},
    });

    expect(response.statusCode).toBe(403);
    expect(organizationUpdate).not.toHaveBeenCalled();
  });

  it("refuses completion when no channel has become active", async () => {
    socialAccountCount.mockResolvedValue(0);

    const response = await app.inject({
      method: "POST",
      url: "/onboarding/complete",
      payload: {},
    });

    expect(response.statusCode).toBe(400);
    expect(organizationUpdate).not.toHaveBeenCalled();
  });
});
