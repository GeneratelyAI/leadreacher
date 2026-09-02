import Fastify from "fastify";
import { applyZodCompilers } from "../../lib/zod-compilers.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../../lib/errors.js";

const {
  socialAccountFindMany,
  socialAccountCount,
  socialAccountFindFirst,
  socialAccountUpdate,
  socialAccountUpsert,
  messageFindMany,
  organizationFindUnique,
  organizationUpdate,
  strategyFindFirst,
  strategyUpdate,
  campaignFindFirst,
  campaignCreate,
  campaignUpdate,
  leadFindMany,
  leadUpdateMany,
  campaignLeadCreateMany,
  campaignLeadCount,
} = vi.hoisted(() => ({
  socialAccountFindMany: vi.fn(),
  socialAccountCount: vi.fn(),
  socialAccountFindFirst: vi.fn(),
  socialAccountUpdate: vi.fn(),
  socialAccountUpsert: vi.fn(),
  messageFindMany: vi.fn(),
  organizationFindUnique: vi.fn(),
  organizationUpdate: vi.fn(),
  strategyFindFirst: vi.fn(),
  strategyUpdate: vi.fn(),
  campaignFindFirst: vi.fn(),
  campaignCreate: vi.fn(),
  campaignUpdate: vi.fn(),
  leadFindMany: vi.fn(),
  leadUpdateMany: vi.fn(),
  campaignLeadCreateMany: vi.fn(),
  campaignLeadCount: vi.fn(),
}));
const { createHostedAuthLink, getAccountStatus, listAccounts } = vi.hoisted(() => ({
  createHostedAuthLink: vi.fn(),
  getAccountStatus: vi.fn(),
  listAccounts: vi.fn(),
}));
const { getDailySendLimitStatus } = vi.hoisted(() => ({
  getDailySendLimitStatus: vi.fn(),
}));
const { redisGet, redisSet, redisDel } = vi.hoisted(() => ({
  redisGet: vi.fn(),
  redisSet: vi.fn(),
  redisDel: vi.fn(),
}));
const { launchCampaign } = vi.hoisted(() => ({ launchCampaign: vi.fn() }));
const { searchAndImportLinkedInProspects } = vi.hoisted(() => ({
  searchAndImportLinkedInProspects: vi.fn(),
}));
const { onboardingDiscoveryAdd, onboardingDiscoveryGetJob } = vi.hoisted(() => ({
  onboardingDiscoveryAdd: vi.fn(),
  onboardingDiscoveryGetJob: vi.fn(),
}));
const { publishDashboardEvent } = vi.hoisted(() => ({ publishDashboardEvent: vi.fn() }));

vi.mock("../../config/env.js", () => ({
  env: {
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
      update: socialAccountUpdate,
      upsert: socialAccountUpsert,
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
      update: campaignUpdate,
    },
    lead: { findMany: leadFindMany, updateMany: leadUpdateMany },
    campaignLead: { createMany: campaignLeadCreateMany, count: campaignLeadCount },
  },
}));
vi.mock("../../adapters/unipile.js", () => ({
  UnipileAdapter: class {
    createHostedAuthLink = createHostedAuthLink;
    getAccountStatus = getAccountStatus;
    listAccounts = listAccounts;
  },
  isAccountHealthy: () => true,
  encodeHostedAuthName: (orgId: string) => `lr:${orgId}:signed`,
}));
vi.mock("../../lib/rate-limiter.js", () => ({ getDailySendLimitStatus }));
vi.mock("../../services/campaign-launch.js", () => ({ launchCampaign }));
vi.mock("../../services/prospect-search.js", () => ({ searchAndImportLinkedInProspects }));
vi.mock("../../lib/queue.js", () => ({
  onboardingProspectDiscoveryQueue: {
    add: onboardingDiscoveryAdd,
    getJob: onboardingDiscoveryGetJob,
  },
}));
vi.mock("../../lib/dashboard-events.js", () => ({ publishDashboardEvent }));
vi.mock("../../lib/redis.js", () => ({
  redis: { get: redisGet, set: redisSet, del: redisDel },
}));

import { onboardingRoutes } from "../onboarding.js";
import { socialAccountRoutes } from "../social-accounts.js";

async function buildTestApp() {
  const app = Fastify();
  applyZodCompilers(app);
  app.addHook("preHandler", async (request) => {
    request.orgId = "org-1";
  });
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      reply.header("X-Request-Id", request.id);
      return reply
        .status(error.statusCode)
        .send({
          status: error.statusCode,
          code: error.code,
          message: error.message,
          requestId: request.id,
        });
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
  socialAccountUpdate.mockReset();
  socialAccountUpsert.mockReset();
  messageFindMany.mockReset();
  organizationFindUnique.mockReset();
  organizationUpdate.mockReset();
  strategyFindFirst.mockReset();
  strategyUpdate.mockReset();
  campaignFindFirst.mockReset();
  campaignCreate.mockReset();
  campaignUpdate.mockReset();
  leadFindMany.mockReset();
  leadUpdateMany.mockReset();
  campaignLeadCreateMany.mockReset();
  campaignLeadCount.mockReset();
  launchCampaign.mockReset();
  searchAndImportLinkedInProspects.mockReset();
  onboardingDiscoveryAdd.mockReset();
  onboardingDiscoveryGetJob.mockReset();
  publishDashboardEvent.mockReset();
  createHostedAuthLink.mockReset();
  getAccountStatus.mockReset();
  listAccounts.mockReset();
  getDailySendLimitStatus.mockReset();
  redisGet.mockReset();
  redisSet.mockReset();
  redisDel.mockReset();

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
    channels: { selected: ["linkedin", "email", "whatsapp"] },
    positioning: { businessModel: "B2B lead generation" },
    icpDefinition: { idealCustomer: "Revenue leaders" },
    messagingAngles: {
      outreachMessage: "Hi {{FirstName}}, I help {{Company}} start more qualified conversations.",
    },
    videoConfig: { tone: "professional" },
  });
  strategyUpdate.mockResolvedValue({});
  campaignFindFirst.mockResolvedValue(null);
  campaignCreate.mockResolvedValue({ id: "campaign-onboarding-1", status: "review" });
  leadFindMany.mockResolvedValue([
    {
      id: "lead-1",
      reviewStatus: "pending",
      enrichmentData: { networkDistance: "FIRST_DEGREE" },
    },
    {
      id: "lead-2",
      reviewStatus: "approved",
      enrichmentData: { networkDistance: "DISTANCE_2" },
    },
  ]);
  leadUpdateMany.mockResolvedValue({ count: 1 });
  campaignLeadCreateMany.mockResolvedValue({ count: 2 });
  campaignLeadCount.mockResolvedValue(0);
  launchCampaign.mockResolvedValue({ launched: true, jobCount: 2, audienceRouting: {} });
  searchAndImportLinkedInProspects.mockResolvedValue({
    imported: 2,
    skipped: 0,
    total: 2,
    totalFound: 2,
    leadIds: ["lead-1", "lead-2"],
  });
  createHostedAuthLink.mockResolvedValue({
    url: "https://account.unipile.com/hosted-auth-link",
  });
  getAccountStatus.mockResolvedValue({
    id: "unipile-1",
    type: "LINKEDIN",
    name: "Ada Lovelace",
    sources: [{ id: "source-1", status: "OK" }],
  });
  listAccounts.mockResolvedValue({ items: [] });
  onboardingDiscoveryGetJob.mockResolvedValue(null);
  onboardingDiscoveryAdd.mockResolvedValue({ id: "onboarding-prospect-discovery:campaign-onboarding-1" });
  socialAccountUpdate.mockResolvedValue({});
  app = await buildTestApp();
});

afterEach(async () => {
  await app.close();
});

describe("channel connection and onboarding completion", () => {
  it("does not import another organization's account during sync", async () => {
    socialAccountFindMany.mockResolvedValueOnce([
      {
        id: "sa-1",
        platform: "linkedin",
        platformUserId: "unipile-1",
        unipileId: "unipile-1",
        status: "active",
      },
    ]);
    listAccounts.mockResolvedValueOnce({
      items: [
        { id: "unipile-1", type: "LINKEDIN", name: "Ada Lovelace" },
        { id: "unipile-other-org", type: "LINKEDIN", name: "Other Tenant" },
      ],
    });
    const warn = vi.spyOn(app.log, "warn");

    const response = await app.inject({
      method: "POST",
      url: "/social-accounts/sync",
      payload: {},
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ synced: 1 });
    expect(getAccountStatus).toHaveBeenCalledTimes(1);
    expect(getAccountStatus).toHaveBeenCalledWith("unipile-1");
    expect(socialAccountUpdate).toHaveBeenCalledTimes(1);
    expect(socialAccountUpdate).toHaveBeenCalledWith({
      where: { id: "sa-1" },
      data: {
        unipileId: "unipile-1",
        platformUserId: "unipile-1",
        accountName: "Ada Lovelace",
        status: "active",
        metadata: { providerType: "linkedin", unipileVersion: "v2" },
      },
    });
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: "org-1",
        unipileAccountId: "unipile-other-org",
        reason: "unknown-account",
      }),
      "Skipped unattributable Unipile account during organization sync",
    );
  });

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
      connectionToken: expect.any(String),
    });
    expect(createHostedAuthLink).toHaveBeenCalledWith(
      expect.objectContaining({
        providers: ["linkedin"],
        redirectUri: "http://localhost:3000/onboarding?step=channels&status=connected",
        state: expect.any(String),
      }),
    );
  });

  it("rejects connection attempts for channels outside the purchased plan", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/social-accounts/connect",
      payload: { provider: "INSTAGRAM" },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      code: "VALIDATION_ERROR",
      message: "instagram is not included in your current plan",
    });
    expect(createHostedAuthLink).not.toHaveBeenCalled();
  });

  it.each(["GOOGLE", "OUTLOOK"] as const)(
    "allows %s when the email channel is included in the purchased plan",
    async (provider) => {
      const response = await app.inject({
        method: "POST",
        url: "/social-accounts/connect",
        payload: { provider },
      });

      expect(response.statusCode).toBe(200);
      expect(createHostedAuthLink).toHaveBeenCalledWith(
        expect.objectContaining({ providers: [provider.toLowerCase()] }),
      );
    },
  );

  it("confirms the returned account with the one-time organization token", async () => {
    const connectionToken = "4e17cd74-bbee-4d42-8e93-75cf9cb12e64";
    redisGet.mockResolvedValueOnce(JSON.stringify({
      orgId: "org-1",
      provider: "LINKEDIN",
    }));
    socialAccountFindFirst.mockResolvedValueOnce(null);
    socialAccountUpsert.mockResolvedValueOnce({ id: "sa-confirmed" });

    const response = await app.inject({
      method: "POST",
      url: "/social-accounts/connect/confirm",
      payload: {
        accountId: "unipile-1",
        connectionToken,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      connected: true,
      status: "active",
      platform: "linkedin",
    });
    expect(getAccountStatus).toHaveBeenCalledWith("unipile-1");
    expect(socialAccountUpsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        orgId: "org-1",
        platform: "linkedin",
        unipileId: "unipile-1",
      }),
    }));
    expect(redisDel).toHaveBeenCalledWith(`social-account:connection:${connectionToken}`);
  });

  it("recovers an unclaimed account returned before confirmation tokens were introduced", async () => {
    socialAccountFindFirst.mockResolvedValueOnce(null);
    socialAccountUpsert.mockResolvedValueOnce({ id: "sa-recovered" });

    const response = await app.inject({
      method: "POST",
      url: "/social-accounts/connect/confirm",
      payload: { accountId: "unipile-1" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ connected: true, platform: "linkedin" });
    expect(redisGet).not.toHaveBeenCalled();
    expect(socialAccountUpsert).toHaveBeenCalledOnce();
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
    strategyFindFirst.mockResolvedValueOnce({
      id: "strategy-1",
      positioning: { businessModel: "B2B lead generation" },
      icpDefinition: { idealCustomer: "Revenue leaders" },
      messagingAngles: {
        outreachMessage: "Hi {{FirstName}}, I help {{Company}} start more qualified conversations.",
        cta: { label: "Watch the overview", url: "https://leadreacher.com/overview" },
      },
      videoConfig: { tone: "professional" },
    });
    const response = await app.inject({
      method: "POST",
      url: "/onboarding/complete",
      payload: { socialAccountId: "sa-1" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      completed: true,
      campaignId: "campaign-onboarding-1",
      launched: false,
      reviewRequired: true,
      discoveryStatus: "queued",
    });
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
          aiConfig: expect.objectContaining({ requiresSequenceReview: true }),
          sequence: expect.arrayContaining([
            expect.objectContaining({
              type: "linkedin_invite",
              message: expect.stringMatching(/\{\{FirstName\}\}.*\{\{Company\}\}/),
            }),
            expect.objectContaining({
              type: "linkedin_message",
              message: "Hi {{FirstName}}, I help {{Company}} start more qualified conversations.\n\nWatch the overview: https://leadreacher.com/overview",
            }),
          ]),
        }),
      }),
    );
    expect(onboardingDiscoveryAdd).toHaveBeenCalledWith("discover-onboarding-prospects", {
      orgId: "org-1",
      campaignId: "campaign-onboarding-1",
    }, {
      jobId: "onboarding-prospect-discovery-campaign-onboarding-1",
    });
    expect(socialAccountFindFirst).toHaveBeenCalledWith({
      where: { orgId: "org-1", platform: "linkedin", status: "active", id: "sa-1" },
      select: { id: true },
    });
    expect(campaignLeadCreateMany).not.toHaveBeenCalled();
    expect(searchAndImportLinkedInProspects).not.toHaveBeenCalled();
    expect(launchCampaign).not.toHaveBeenCalled();
  });

  it("queues audience discovery even when the scraper has not yet found prospects", async () => {
    searchAndImportLinkedInProspects.mockResolvedValueOnce({
      imported: 0,
      skipped: 0,
      total: 0,
      totalFound: 0,
      leadIds: [],
    });
    leadFindMany.mockResolvedValueOnce([]);

    const response = await app.inject({
      method: "POST",
      url: "/onboarding/complete",
      payload: {},
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ discoveryStatus: "queued" });
    expect(campaignLeadCreateMany).not.toHaveBeenCalled();
    expect(onboardingDiscoveryAdd).toHaveBeenCalledOnce();
  });

  it("archives an outdated unfinished onboarding campaign before preparing a new strategy", async () => {
    campaignFindFirst.mockResolvedValueOnce({
      id: "campaign-outdated",
      status: "review",
      sequence: [],
      aiConfig: { source: "onboarding", strategyFingerprint: "outdated-fingerprint" },
    });

    const response = await app.inject({
      method: "POST",
      url: "/onboarding/complete",
      payload: {},
    });

    expect(response.statusCode).toBe(200);
    expect(campaignUpdate).toHaveBeenCalledWith({
      where: { id: "campaign-outdated" },
      data: { aiConfig: { source: "onboarding", strategyFingerprint: "outdated-fingerprint", archived: true } },
    });
    expect(campaignCreate).toHaveBeenCalledOnce();
  });

  it("allows a failed onboarding audience to be queued again from campaign review", async () => {
    campaignFindFirst.mockResolvedValueOnce({
      id: "campaign-onboarding-1",
      aiConfig: {
        source: "onboarding",
        onboardingDiscovery: { status: "failed", prospectCount: 0, updatedAt: "2026-08-11T00:00:00.000Z" },
      },
    });

    const response = await app.inject({
      method: "POST",
      url: "/onboarding/campaigns/campaign-onboarding-1/discovery/retry",
      payload: {},
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ queued: true });
    expect(campaignUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "campaign-onboarding-1" },
      data: expect.objectContaining({ aiConfig: expect.objectContaining({
        onboardingDiscovery: expect.objectContaining({ status: "queued", prospectCount: 0 }),
      }) }),
    }));
    expect(onboardingDiscoveryAdd).toHaveBeenCalledWith(
      "discover-onboarding-prospects",
      { orgId: "org-1", campaignId: "campaign-onboarding-1" },
      { jobId: "onboarding-prospect-discovery-campaign-onboarding-1" },
    );
  });

  it("is idempotent when onboarding was already completed", async () => {
    organizationFindUnique.mockResolvedValue({
      id: "org-1",
      name: "Ada's workspace",
      subscriptionStatus: "active",
      onboardedAt: new Date("2026-07-13T00:00:00.000Z"),
    });
    campaignFindFirst.mockResolvedValue({
      id: "campaign-onboarding-1",
      status: "active",
      sequence: [],
      aiConfig: { source: "onboarding", requiresSequenceReview: false },
    });

    const response = await app.inject({
      method: "POST",
      url: "/onboarding/complete",
      payload: {},
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      completed: true,
      campaignId: "campaign-onboarding-1",
      launched: true,
      reviewRequired: false,
      discoveryStatus: "completed",
    });
    expect(organizationUpdate).not.toHaveBeenCalled();
    expect(launchCampaign).not.toHaveBeenCalled();
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
