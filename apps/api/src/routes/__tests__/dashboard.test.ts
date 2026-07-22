import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../../lib/errors.js";

const {
  organizationFindUnique,
  organizationUpdate,
  leadCount,
  leadFindMany,
  campaignLeadCount,
  messageCount,
  messageFindMany,
  messageFindFirst,
  campaignCount,
  campaignFindMany,
  socialAccountFindMany,
  videoAssetCount,
  videoAssetFindMany,
  campaignLeadFindMany,
  campaignLeadFindFirst,
  leadFindFirst,
  leadUpdate,
  messageUpdateMany,
  checkAndIncrementDailySendLimit,
  getDailySendLimitStatus,
  deliverOperatorMessage,
  runReplyDraftAgent,
  readCachedAnalyticsInsights,
  analyticsInsightsQueueAdd,
} = vi.hoisted(() => ({
  organizationFindUnique: vi.fn(),
  organizationUpdate: vi.fn(),
  leadCount: vi.fn(),
  leadFindMany: vi.fn(),
  campaignLeadCount: vi.fn(),
  messageCount: vi.fn(),
  messageFindMany: vi.fn(),
  messageFindFirst: vi.fn(),
  campaignCount: vi.fn(),
  campaignFindMany: vi.fn(),
  socialAccountFindMany: vi.fn(),
  videoAssetCount: vi.fn(),
  videoAssetFindMany: vi.fn(),
  campaignLeadFindMany: vi.fn(),
  campaignLeadFindFirst: vi.fn(),
  leadFindFirst: vi.fn(),
  leadUpdate: vi.fn(),
  messageUpdateMany: vi.fn(),
  checkAndIncrementDailySendLimit: vi.fn(),
  getDailySendLimitStatus: vi.fn(),
  deliverOperatorMessage: vi.fn(),
  runReplyDraftAgent: vi.fn(),
  readCachedAnalyticsInsights: vi.fn(),
  analyticsInsightsQueueAdd: vi.fn(),
}));

vi.mock("../../lib/prisma.js", () => ({
  prisma: {
    organization: { findUnique: organizationFindUnique, update: organizationUpdate },
    lead: { count: leadCount, findMany: leadFindMany, findFirst: leadFindFirst, update: leadUpdate },
    campaignLead: { count: campaignLeadCount, findMany: campaignLeadFindMany, findFirst: campaignLeadFindFirst },
    message: { count: messageCount, findMany: messageFindMany, findFirst: messageFindFirst, updateMany: messageUpdateMany },
    campaign: { count: campaignCount, findMany: campaignFindMany },
    socialAccount: { findMany: socialAccountFindMany },
    videoAsset: { count: videoAssetCount, findMany: videoAssetFindMany },
  },
}));
vi.mock("../../lib/queue.js", () => ({
  QUEUE_ANALYTICS_INSIGHTS: "analytics-insights",
  analyticsInsightsQueue: { add: analyticsInsightsQueueAdd },
}));
vi.mock("../../services/analytics-insights.js", () => ({
  readCachedAnalyticsInsights,
}));
vi.mock("../../lib/rate-limiter.js", () => ({ checkAndIncrementDailySendLimit, getDailySendLimitStatus }));
vi.mock("../../services/operator-message-delivery.js", () => ({ deliverOperatorMessage }));
vi.mock("../../modules/agents/reply-draft-agent.js", () => ({ runReplyDraftAgent }));
vi.mock("../../adapters/unipile.js", () => ({ UnipileAdapter: class {} }));

import {
  dashboardRoutes,
  resolveDashboardEngine,
  sortDashboardActivity,
} from "../dashboard.js";

async function buildTestApp() {
  const app = Fastify();
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({ code: error.code, message: error.message });
    }
    return reply.status(500).send({ code: "INTERNAL_ERROR", message: "Unexpected error" });
  });
  app.addHook("preHandler", async (request) => {
    request.orgId = "org-1";
  });
  await app.register(dashboardRoutes);
  return app;
}

let app: Awaited<ReturnType<typeof buildTestApp>>;

beforeEach(async () => {
  organizationFindUnique.mockReset().mockResolvedValue({
    name: "Acme",
    subscriptionStatus: "active",
    stripeCustomerId: "cus_123",
  });
  organizationUpdate.mockReset().mockResolvedValue({
    name: "Renamed workspace",
    plan: "starter",
    subscriptionStatus: "active",
    currentPeriodEnd: null,
    stripeCustomerId: "cus_123",
  });
  leadCount.mockReset().mockImplementation(async (input) => {
    if (input.where.status === "replied") return 3;
    if (input.where.status === "meeting") return 1;
    return 12;
  });
  campaignLeadCount.mockReset().mockResolvedValue(5);
  messageCount.mockReset().mockResolvedValue(9);
  campaignCount.mockReset().mockResolvedValue(1);
  campaignFindMany.mockReset().mockResolvedValue([
    {
      id: "campaign-1",
      name: "Q3 outreach",
      status: "active",
      channels: ["linkedin"],
      createdAt: new Date("2026-07-20T10:00:00.000Z"),
      updatedAt: new Date("2026-07-20T11:00:00.000Z"),
      _count: { leads: 12 },
    },
  ]);
  socialAccountFindMany.mockReset().mockResolvedValue([
    {
      id: "account-1",
      platform: "linkedin",
      accountName: "Ada Lovelace",
      avatarUrl: null,
      status: "active",
    },
    {
      id: "account-2",
      platform: "whatsapp",
      accountName: "Ada WhatsApp",
      avatarUrl: null,
      status: "error",
    },
  ]);
  videoAssetCount
    .mockReset()
    .mockResolvedValueOnce(1)
    .mockResolvedValueOnce(2);
  messageFindMany.mockReset().mockResolvedValue([
    {
      id: "message-1",
      direction: "inbound",
      channel: "linkedin",
      status: "replied",
      createdAt: new Date("2026-07-20T12:00:00.000Z"),
      lead: { firstName: "Ada", lastName: "Lovelace", company: "Analytical Engines" },
      campaign: { name: "Q3 outreach" },
    },
  ]);
  messageFindFirst.mockReset().mockResolvedValue(null);
  leadFindMany.mockReset().mockResolvedValue([
    {
      id: "lead-1",
      firstName: "Grace",
      lastName: "Hopper",
      company: "Navy",
      createdAt: new Date("2026-07-20T10:30:00.000Z"),
    },
  ]);
  videoAssetFindMany.mockReset().mockResolvedValue([
    {
      id: "video-1",
      status: "ready",
      needsReview: false,
      updatedAt: new Date("2026-07-20T11:30:00.000Z"),
      campaign: { name: "Q3 outreach" },
      lead: null,
    },
  ]);
  campaignLeadFindMany.mockReset().mockResolvedValue([]);
  campaignLeadFindFirst.mockReset().mockResolvedValue(null);
  leadFindFirst.mockReset().mockResolvedValue(null);
  leadUpdate.mockReset().mockResolvedValue({});
  messageUpdateMany.mockReset().mockResolvedValue({ count: 0 });
  checkAndIncrementDailySendLimit.mockReset().mockResolvedValue({ allowed: true, remaining: 49 });
  getDailySendLimitStatus.mockReset().mockResolvedValue({ limit: 50, remaining: 49, resetAt: "2026-07-22T00:00:00.000Z" });
  deliverOperatorMessage.mockReset().mockResolvedValue({ messageId: "operator-message-1" });
  runReplyDraftAgent.mockReset().mockResolvedValue({ drafts: ["A safe draft."] });
  readCachedAnalyticsInsights.mockReset().mockResolvedValue(null);
  analyticsInsightsQueueAdd.mockReset().mockResolvedValue({});
  app = await buildTestApp();
});

afterEach(async () => {
  await app.close();
});

describe("dashboard overview", () => {
  it("returns org-scoped operational data and orders activity by recency", async () => {
    const response = await app.inject({ method: "GET", url: "/dashboard/overview" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      organization: { name: "Acme", subscriptionStatus: "active", hasBillingPortal: true },
      engine: { status: "running" },
      metrics: {
        prospects: 12,
        outreachInProgress: 5,
        replies: 3,
        meetingsBooked: 1,
        outreachSent: 9,
      },
      primaryCampaign: {
        id: "campaign-1",
        name: "Q3 outreach",
        status: "active",
        prospectCount: 12,
      },
    });
    expect(response.json().activity.map((item: { id: string }) => item.id)).toEqual([
      "message:message-1",
      "video:video-1",
      "campaign:campaign-1",
      "lead:lead-1",
    ]);
    expect(response.json().attention).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: "whatsapp needs attention" }),
        expect.objectContaining({ title: "1 video asset has failed" }),
        expect.objectContaining({ title: "2 video assets need review" }),
      ]),
    );
    expect(leadCount).toHaveBeenCalledWith(expect.objectContaining({ where: { orgId: "org-1" } }));
    expect(campaignLeadCount).toHaveBeenCalledWith(
      expect.objectContaining({ where: { campaign: { orgId: "org-1" }, status: "active" } }),
    );
    expect(messageFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { orgId: "org-1" } }),
    );
  });

  it("uses the documented engine-status precedence", () => {
    expect(
      resolveDashboardEngine({
        subscriptionStatus: "past_due",
        activeChannelCount: 0,
        activeCampaignCount: 1,
      }).status,
    ).toBe("needs_attention");
    expect(
      resolveDashboardEngine({
        subscriptionStatus: "active",
        activeChannelCount: 0,
        activeCampaignCount: 1,
      }).label,
    ).toBe("Connect a channel");
    expect(
      resolveDashboardEngine({
        subscriptionStatus: "active",
        activeChannelCount: 1,
        activeCampaignCount: 0,
      }).status,
    ).toBe("ready");
  });

  it("keeps activity sorting deterministic", () => {
    const older = new Date("2026-07-20T10:00:00.000Z");
    const newer = new Date("2026-07-20T12:00:00.000Z");
    expect(
      sortDashboardActivity([
        { id: "old", kind: "campaign", title: "Old", detail: "", occurredAt: older },
        { id: "new", kind: "campaign", title: "New", detail: "", occurredAt: newer },
      ]).map((item) => item.id),
    ).toEqual(["new", "old"]);
  });

  it("returns persisted messages with readable content", async () => {
    messageFindMany.mockResolvedValueOnce([
      {
        id: "message-2",
        channel: "linkedin",
        content: { type: "text", message: "Thanks for connecting." },
        direction: "outbound",
        status: "sent",
        stepIndex: 1,
        sentAt: new Date("2026-07-20T13:00:00.000Z"),
        createdAt: new Date("2026-07-20T12:00:00.000Z"),
        lead: { firstName: "Grace", lastName: "Hopper", company: "Navy" },
        campaign: { id: "campaign-1", name: "Q3 outreach" },
      },
    ]);

    const response = await app.inject({ method: "GET", url: "/dashboard/messages" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      messages: [
        expect.objectContaining({
          content: "Thanks for connecting.",
          lead: { name: "Grace Hopper", company: "Navy" },
          campaign: { id: "campaign-1", name: "Q3 outreach" },
        }),
      ],
    });
    expect(messageFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { orgId: "org-1" } }),
    );
  });

  it("returns a chronological, persisted activity feed without forecast data", async () => {
    const response = await app.inject({ method: "GET", url: "/dashboard/activity?limit=10" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      activity: expect.arrayContaining([
        expect.objectContaining({ id: "message:message-1", kind: "message" }),
        expect.objectContaining({ id: "lead:lead-1", kind: "prospect" }),
      ]),
    });
    expect(response.json().activity[0]).toMatchObject({ id: "message:message-1" });
    expect(response.json()).not.toHaveProperty("forecast");
  });

  it("derives analytics from persisted message and lead records", async () => {
    messageFindMany.mockResolvedValueOnce([
      { direction: "outbound", status: "sent", channel: "linkedin", createdAt: new Date() },
      { direction: "outbound", status: "delivered", channel: "linkedin", createdAt: new Date() },
      { direction: "inbound", status: "replied", channel: "linkedin", createdAt: new Date() },
    ]);
    leadFindMany.mockResolvedValueOnce([
      { status: "replied" },
      { status: "meeting" },
    ]);
    campaignFindMany.mockResolvedValueOnce([
      { id: "campaign-1", name: "Q3 outreach", status: "active", _count: { leads: 2 } },
    ]);

    const response = await app.inject({ method: "GET", url: "/dashboard/analytics" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      totals: { sent: 2, received: 1, delivered: 2, replies: 1, meetings: 1 },
      channels: [{ channel: "linkedin", sent: 2, received: 1 }],
      campaigns: [{ id: "campaign-1", prospectCount: 2 }],
    });
  });

  it("updates only the authenticated organization settings", async () => {
    const response = await app.inject({
      method: "PATCH",
      url: "/dashboard/settings",
      payload: { organizationName: "Renamed workspace" },
    });

    expect(response.statusCode).toBe(200);
    expect(organizationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "org-1" },
        data: { name: "Renamed workspace" },
      }),
    );
    expect(response.json()).toMatchObject({
      organization: { name: "Renamed workspace", hasBillingPortal: true },
    });
  });

  it("returns an honest empty insight state without queuing Groq work when no sends exist", async () => {
    messageCount.mockResolvedValueOnce(0);

    const response = await app.inject({ method: "GET", url: "/dashboard/analytics/insights" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: "no_data",
      whatsWorking: [],
      whatsNotWorking: [],
      whatToDoNext: [],
    });
    expect(analyticsInsightsQueueAdd).not.toHaveBeenCalled();
  });

  it("serves cached insights before scheduling aggregation", async () => {
    readCachedAnalyticsInsights.mockResolvedValueOnce({
      status: "ready",
      generatedAt: "2026-07-21T10:00:00.000Z",
      whatsWorking: [],
      whatsNotWorking: [],
      whatToDoNext: [],
    });

    const response = await app.inject({ method: "GET", url: "/dashboard/analytics/insights" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: "ready" });
    expect(analyticsInsightsQueueAdd).not.toHaveBeenCalled();
  });

  it("returns a visible 429 for a capped manual reply without sending or queuing work", async () => {
    campaignLeadFindFirst.mockResolvedValueOnce({
      id: "campaign-lead-1",
      campaignId: "campaign-1",
      leadId: "lead-1",
      linkedinChatId: "chat-1",
      lead: { id: "lead-1" },
      campaign: {
        senderAccount: { id: "account-1", status: "active", unipileId: "unipile-1" },
      },
    });
    messageCount.mockResolvedValueOnce(1);
    checkAndIncrementDailySendLimit.mockResolvedValueOnce({ allowed: false, remaining: 0 });
    getDailySendLimitStatus.mockResolvedValueOnce({
      limit: 50,
      remaining: 0,
      resetAt: "2026-07-22T00:00:00.000Z",
    });

    const response = await app.inject({
      method: "POST",
      url: "/dashboard/conversations/campaign-lead-1/replies",
      payload: {
        message: "Thanks for your note. Would next week work?",
        idempotencyKey: "8fe2f68c-c707-44c5-95b3-d8fe08de7517",
      },
    });

    expect(response.statusCode).toBe(429);
    expect(response.json()).toMatchObject({ code: "daily_message_limit" });
    expect(deliverOperatorMessage).not.toHaveBeenCalled();
    expect(analyticsInsightsQueueAdd).not.toHaveBeenCalled();
  });

  it("returns the original reply for an idempotent operator retry", async () => {
    messageFindFirst.mockResolvedValueOnce({ id: "operator-message-1" });

    const response = await app.inject({
      method: "POST",
      url: "/dashboard/conversations/campaign-lead-1/replies",
      payload: {
        message: "Thanks for your note. Would next week work?",
        idempotencyKey: "8fe2f68c-c707-44c5-95b3-d8fe08de7517",
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({ messageId: "operator-message-1" });
    expect(deliverOperatorMessage).not.toHaveBeenCalled();
    expect(checkAndIncrementDailySendLimit).not.toHaveBeenCalled();
  });
});
