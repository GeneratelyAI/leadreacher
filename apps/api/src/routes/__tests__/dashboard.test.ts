import Fastify from "fastify";
import { applyZodCompilers } from "../../lib/zod-compilers.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../../lib/errors.js";

const {
  organizationFindUnique,
  organizationUpdate,
  userFindMany,
  leadCount,
  leadGroupBy,
  leadFindMany,
  campaignLeadCount,
  messageCount,
  messageFindMany,
  messageFindFirst,
  campaignCount,
  campaignFindMany,
  campaignFindFirst,
  campaignUpdate,
  socialAccountFindMany,
  videoAssetCount,
  videoAssetFindMany,
  campaignLeadFindMany,
  campaignLeadFindFirst,
  leadFindFirst,
  leadUpdate,
  messageUpdateMany,
  deliveryAttemptFindMany,
  deliveryAttemptCount,
  manualDeliveryAttemptFindMany,
  manualDeliveryAttemptCount,
  checkAndIncrementDailySendLimit,
  getDailySendLimitStatus,
  deliverOperatorMessage,
  runReplyDraftAgent,
  readCachedAnalyticsInsights,
  analyticsInsightsQueueAdd,
} = vi.hoisted(() => ({
  organizationFindUnique: vi.fn(),
  organizationUpdate: vi.fn(),
  userFindMany: vi.fn(),
  leadCount: vi.fn(),
  leadGroupBy: vi.fn(),
  leadFindMany: vi.fn(),
  campaignLeadCount: vi.fn(),
  messageCount: vi.fn(),
  messageFindMany: vi.fn(),
  messageFindFirst: vi.fn(),
  campaignCount: vi.fn(),
  campaignFindMany: vi.fn(),
  campaignFindFirst: vi.fn(),
  campaignUpdate: vi.fn(),
  socialAccountFindMany: vi.fn(),
  videoAssetCount: vi.fn(),
  videoAssetFindMany: vi.fn(),
  campaignLeadFindMany: vi.fn(),
  campaignLeadFindFirst: vi.fn(),
  leadFindFirst: vi.fn(),
  leadUpdate: vi.fn(),
  messageUpdateMany: vi.fn(),
  deliveryAttemptFindMany: vi.fn(),
  deliveryAttemptCount: vi.fn(),
  manualDeliveryAttemptFindMany: vi.fn(),
  manualDeliveryAttemptCount: vi.fn(),
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
    user: { findMany: userFindMany },
    lead: { count: leadCount, groupBy: leadGroupBy, findMany: leadFindMany, findFirst: leadFindFirst, update: leadUpdate },
    campaignLead: { count: campaignLeadCount, findMany: campaignLeadFindMany, findFirst: campaignLeadFindFirst },
    message: { count: messageCount, findMany: messageFindMany, findFirst: messageFindFirst, updateMany: messageUpdateMany },
    campaign: { count: campaignCount, findMany: campaignFindMany, findFirst: campaignFindFirst, update: campaignUpdate },
    socialAccount: { findMany: socialAccountFindMany },
    videoAsset: { count: videoAssetCount, findMany: videoAssetFindMany },
    deliveryAttempt: { findMany: deliveryAttemptFindMany, count: deliveryAttemptCount },
    manualDeliveryAttempt: { findMany: manualDeliveryAttemptFindMany, count: manualDeliveryAttemptCount },
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
  overviewMetricTrend,
  buildOverviewActivityTrend,
  resolveDashboardEngine,
  resolveOverviewDateRange,
  sortDashboardActivity,
  campaignMetricRate,
  campaignStatusFilter,
} from "../dashboard.js";
import { buildPrimaryCampaignVideoSummary } from "../../lib/campaign-video-summary.js";

async function buildTestApp() {
  const app = Fastify();
  applyZodCompilers(app);
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
    id: "org-1",
    name: "Acme",
    plan: "starter",
    subscriptionStatus: "active",
    currentPeriodEnd: null,
    stripeCustomerId: "cus_123",
  });
  organizationUpdate.mockReset().mockResolvedValue({
    id: "org-1",
    name: "Renamed workspace",
    plan: "starter",
    subscriptionStatus: "active",
    currentPeriodEnd: null,
    stripeCustomerId: "cus_123",
  });
  userFindMany.mockReset().mockResolvedValue([
    {
      id: "user-1",
      name: "Nicolas Miranda",
      email: "nicolas@example.com",
      role: "owner",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    },
  ]);
  leadCount.mockReset().mockImplementation(async (input) => {
    if (input.where.status === "replied") return 3;
    if (input.where.status === "meeting") return 1;
    return 12;
  });
  leadGroupBy.mockReset().mockResolvedValue([
    { reviewStatus: "pending", _count: { _all: 0 } },
    { reviewStatus: "approved", _count: { _all: 0 } },
    { reviewStatus: "excluded", _count: { _all: 0 } },
  ]);
  campaignLeadCount.mockReset().mockResolvedValue(5);
  messageCount.mockReset().mockImplementation(async (input) => {
    if (input.where.direction === "inbound") {
      return input.where.createdAt ? 3 : 1;
    }
    return 9;
  });
  campaignCount.mockReset().mockResolvedValue(1);
  campaignFindMany.mockReset().mockResolvedValue([
    {
      id: "campaign-1",
      name: "Q3 outreach",
      status: "active",
      channels: ["linkedin"],
      aiConfig: null,
      createdAt: new Date("2026-07-20T10:00:00.000Z"),
      updatedAt: new Date("2026-07-20T11:00:00.000Z"),
      _count: { leads: 12 },
    },
  ]);
  campaignFindFirst.mockReset().mockResolvedValue(null);
  campaignUpdate.mockReset().mockResolvedValue({});
  socialAccountFindMany.mockReset().mockResolvedValue([
    {
      id: "account-1",
      platform: "linkedin",
      accountName: "Ada Lovelace",
      avatarUrl: null,
      status: "active",
      unipileId: "unipile-1",
    },
    {
      id: "account-2",
      platform: "whatsapp",
      accountName: "Ada WhatsApp",
      avatarUrl: null,
      status: "error",
      unipileId: null,
    },
  ]);
  videoAssetCount
    .mockReset()
    .mockResolvedValueOnce(1)
    .mockResolvedValueOnce(2);
  messageFindMany.mockReset().mockImplementation(async (input) => {
    if (input?.where?.handledAt === null) {
      return [
        {
          id: "message-needs-reply",
          campaignId: "campaign-1",
          leadId: "lead-1",
          createdAt: new Date("2026-07-20T12:00:00.000Z"),
          content: { message: "Can we talk next week?", attachments: [] },
          lead: { firstName: "Ada", lastName: "Lovelace", company: "Analytical Engines", avatarUrl: null },
          campaign: { id: "campaign-1", name: "Q3 outreach" },
        },
      ];
    }
    return [
      {
        id: "message-1",
        direction: "inbound",
        channel: "linkedin",
        status: "replied",
        createdAt: new Date("2026-07-20T12:00:00.000Z"),
        leadId: "lead-1",
        campaignId: "campaign-1",
        content: { message: "Hello", attachments: [] },
        lead: { id: "lead-1", firstName: "Ada", lastName: "Lovelace", company: "Analytical Engines", avatarUrl: null },
        campaign: { id: "campaign-1", name: "Q3 outreach" },
      },
    ];
  });
  messageFindFirst.mockReset().mockResolvedValue(null);
  leadFindMany.mockReset().mockResolvedValue([
    {
      id: "lead-1",
      firstName: "Grace",
      lastName: "Hopper",
      company: "Navy",
      avatarUrl: null,
      createdAt: new Date("2026-07-20T10:30:00.000Z"),
    },
  ]);
  videoAssetFindMany.mockReset().mockResolvedValue([
    {
      id: "video-1",
      status: "ready",
      needsReview: false,
      videoUrl: "https://cdn.example/video.mp4",
      thumbnailUrl: "https://cdn.example/thumb.jpg",
      updatedAt: new Date("2026-07-20T11:30:00.000Z"),
      campaign: { id: "campaign-1", name: "Q3 outreach" },
      lead: null,
    },
  ]);
  campaignLeadFindMany.mockReset().mockImplementation(async (input) => {
    if (input?.where?.lead?.status === "contacted" || input?.select?.currentStep) {
      return [];
    }
    if (input?.select?.status && input?.select?.lead) {
      return [{ status: "active", lead: { status: "replied" } }];
    }
    return [{ id: "cl-1", campaignId: "campaign-1", leadId: "lead-1" }];
  });
  campaignLeadFindFirst.mockReset().mockResolvedValue(null);
  leadFindFirst.mockReset().mockResolvedValue(null);
  leadUpdate.mockReset().mockResolvedValue({});
  messageUpdateMany.mockReset().mockResolvedValue({ count: 0 });
  deliveryAttemptFindMany.mockReset().mockResolvedValue([]);
  deliveryAttemptCount.mockReset().mockResolvedValue(0);
  manualDeliveryAttemptFindMany.mockReset().mockResolvedValue([]);
  manualDeliveryAttemptCount.mockReset().mockResolvedValue(0);
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
        video: {
          id: "video-1",
          status: "ready",
          videoUrl: "https://cdn.example/video.mp4",
          thumbnailUrl: "https://cdn.example/thumb.jpg",
          videosSent: 0,
          paused: false,
        },
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
    expect(response.json().actions).toMatchObject({
      needsReplyCount: expect.any(Number),
      needsReply: expect.arrayContaining([
        expect.objectContaining({ prospectName: "Ada Lovelace", campaignLeadId: "cl-1" }),
      ]),
      reconnectAccounts: expect.arrayContaining([
        expect.objectContaining({ platform: "whatsapp", status: "error" }),
      ]),
    });
    expect(response.json().sendingHealth).toMatchObject({
      failedSendCount: 0,
      pendingInviteAcceptances: expect.any(Number),
      senders: expect.arrayContaining([
        expect.objectContaining({ accountName: "Ada Lovelace" }),
      ]),
    });
    expect(leadCount).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ orgId: "org-1" }) }));
    expect(campaignLeadCount).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ campaign: { orgId: "org-1" }, status: "active" }) }),
    );
    expect(messageFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ orgId: "org-1" }) }),
    );
  });

  it("pauses campaign video sends via aiConfig", async () => {
    campaignFindFirst.mockResolvedValue({
      id: "campaign-1",
      aiConfig: { video: { mode: "personalized" } },
    });
    campaignUpdate.mockResolvedValue({ id: "campaign-1" });

    const response = await app.inject({
      method: "PATCH",
      url: "/dashboard/campaigns/campaign-1/video",
      payload: { paused: true },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ id: "campaign-1", paused: true });
    expect(campaignUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "campaign-1" },
        data: {
          aiConfig: {
            video: {
              mode: "personalized",
              paused: true,
            },
          },
        },
      }),
    );
  });

  it("builds primary campaign video summaries for unused and ready assets", () => {
    expect(
      buildPrimaryCampaignVideoSummary({
        aiConfig: null,
        assets: [],
        outboundContents: [],
      }),
    ).toEqual({
      id: null,
      status: "unused",
      videoUrl: null,
      thumbnailUrl: null,
      videosSent: 0,
      paused: false,
    });

    expect(
      buildPrimaryCampaignVideoSummary({
        aiConfig: { video: { paused: true } },
        assets: [
          {
            id: "video-1",
            status: "ready",
            videoUrl: "https://cdn.example/video.mp4",
            thumbnailUrl: "https://cdn.example/thumb.jpg",
          },
        ],
        outboundContents: [
          { message: "hi", attachments: [{ type: "video", videoUrl: "https://cdn.example/a.mp4" }] },
          { message: "hi", attachments: [] },
        ],
      }),
    ).toEqual({
      id: "video-1",
      status: "ready",
      videoUrl: "https://cdn.example/video.mp4",
      thumbnailUrl: "https://cdn.example/thumb.jpg",
      videosSent: 1,
      paused: true,
    });
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

  it("computes campaign rates only when there is a real denominator", () => {
    expect(campaignMetricRate(4, 16)).toBe(25);
    expect(campaignMetricRate(0, 0)).toBeNull();
    expect(campaignStatusFilter("drafts")).toEqual(["draft", "review"]);
    expect(campaignStatusFilter("all")).toBeUndefined();
  });

  it("returns organization-scoped campaign rows with persisted metrics", async () => {
    campaignFindMany.mockResolvedValueOnce([
      {
        id: "campaign-1",
        name: "Pipeline acceleration",
        status: "active",
        channels: ["linkedin"],
        aiConfig: null,
        socialAccountId: "sender-1",
        senderAccount: { id: "sender-1", platform: "linkedin", accountName: "Ada", status: "active" },
        createdAt: new Date("2026-07-20T10:00:00.000Z"),
        updatedAt: new Date("2026-07-20T11:00:00.000Z"),
        leads: [
          { lead: { status: "meeting", updatedAt: new Date("2026-07-20T11:00:00.000Z") } },
          { lead: { status: "replied", updatedAt: new Date("2026-07-20T11:00:00.000Z") } },
        ],
        messages: [
          { direction: "outbound", status: "sent", content: { message: "hi" } },
          { direction: "outbound", status: "delivered", content: { message: "hi" } },
          { direction: "inbound", status: "replied", content: { message: "thanks" } },
        ],
        videoAssets: [],
      },
    ]);

    const response = await app.inject({ method: "GET", url: "/dashboard/campaigns?status=running&channel=linkedin" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      campaigns: [{
        id: "campaign-1",
        prospectCount: 2,
        metrics: { sent: 2, replies: 1, meetings: 1, replyRate: 50, meetingRate: 50 },
        video: { status: "unused", videosSent: 0, paused: false },
      }],
      summary: { total: 1, running: 1, meetings: 1, archived: 0 },
    });
    expect(campaignFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: { orgId: "org-1" } }));
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
    campaignLeadFindMany.mockResolvedValueOnce([
      { id: "campaign-lead-1", campaignId: "campaign-1", leadId: "lead-1" },
    ]);
    const response = await app.inject({ method: "GET", url: "/dashboard/activity?limit=10" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      activity: expect.arrayContaining([
        expect.objectContaining({ id: "message:message-1", kind: "message" }),
        expect.objectContaining({ id: "lead:lead-1", kind: "prospect" }),
      ]),
      total: expect.any(Number),
      summary: expect.objectContaining({
        totalActivities: expect.any(Number),
        messagesSent: expect.any(Number),
        repliesReceived: expect.any(Number),
        meetingsBooked: expect.any(Number),
        videosSent: expect.any(Number),
        trends: expect.any(Object),
      }),
      filters: expect.objectContaining({
        campaigns: expect.any(Array),
        channels: expect.any(Array),
      }),
    });
    expect(response.json().activity[0]).toMatchObject({
      id: "message:message-1",
      action: "reply",
      href: "/dashboard/messages/campaign-lead-1",
    });
    expect(response.json()).not.toHaveProperty("forecast");
  });

  it("derives analytics from persisted message and lead records", async () => {
    const now = new Date();
    messageFindMany.mockResolvedValue([
      { direction: "outbound", status: "sent", channel: "linkedin", createdAt: now, campaignId: "campaign-1", leadId: "lead-1" },
      { direction: "outbound", status: "delivered", channel: "linkedin", createdAt: now, campaignId: "campaign-1", leadId: "lead-2" },
      { direction: "inbound", status: "replied", channel: "linkedin", createdAt: now, campaignId: "campaign-1", leadId: "lead-1" },
    ]);
    leadFindMany.mockResolvedValue([
      { id: "lead-2", status: "meeting", updatedAt: now },
    ]);
    campaignFindMany.mockResolvedValue([
      {
        id: "campaign-1",
        name: "Q3 outreach",
        status: "active",
        _count: { leads: 2 },
        leads: [{ leadId: "lead-2" }],
      },
    ]);

    const response = await app.inject({ method: "GET", url: "/dashboard/analytics" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      totals: { sent: 2, received: 1, delivered: 2, replies: 1, meetings: 1 },
      summary: {
        messagesSent: 2,
        repliesReceived: 1,
        replyRate: 50,
        meetingsBooked: 1,
        prospectsReached: 2,
      },
      channels: [
        expect.objectContaining({
          channel: "linkedin",
          messagesSent: 2,
          replies: 1,
          replyRate: 50,
          meetingsBooked: 1,
        }),
      ],
      campaigns: [
        expect.objectContaining({
          id: "campaign-1",
          messagesSent: 2,
          replies: 1,
          meetingsBooked: 1,
        }),
      ],
      activityTrend: expect.any(Array),
      replyRateTrend: expect.any(Array),
      filters: {
        campaigns: expect.any(Array),
        channels: expect.any(Array),
      },
      range: {
        startDate: expect.any(String),
        endDate: expect.any(String),
      },
      granularity: "day",
    });
  });

  it("applies analytics campaign, channel, and weekly granularity filters", async () => {
    messageFindMany.mockResolvedValue([]);
    leadFindMany.mockResolvedValue([]);
    campaignFindMany.mockResolvedValue([]);

    const response = await app.inject({
      method: "GET",
      url: "/dashboard/analytics?campaignId=campaign-9&channel=linkedin&granularity=week&startDate=2026-07-01&endDate=2026-07-14",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      granularity: "week",
      range: { startDate: "2026-07-01", endDate: "2026-07-14" },
      summary: {
        messagesSent: 0,
        repliesReceived: 0,
        replyRate: 0,
        meetingsBooked: 0,
        prospectsReached: 0,
      },
    });
    expect(messageFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          orgId: "org-1",
          campaignId: "campaign-9",
          channel: "linkedin",
        }),
      }),
    );
  });

  it("applies analytics multi-channel filters via channels query", async () => {
    messageFindMany.mockResolvedValue([]);
    leadFindMany.mockResolvedValue([]);
    campaignFindMany.mockResolvedValue([]);

    const response = await app.inject({
      method: "GET",
      url: "/dashboard/analytics?channels=linkedin,whatsapp&startDate=2026-07-01&endDate=2026-07-14",
    });

    expect(response.statusCode).toBe(200);
    expect(messageFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          orgId: "org-1",
          channel: { in: ["linkedin", "whatsapp"] },
        }),
      }),
    );
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
      members: [
        expect.objectContaining({
          id: "user-1",
          email: "nicolas@example.com",
          role: "owner",
        }),
      ],
    });
  });

  it("returns organization settings with team members", async () => {
    const response = await app.inject({ method: "GET", url: "/dashboard/settings" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      organization: {
        id: "org-1",
        name: "Acme",
        plan: "starter",
        subscriptionStatus: "active",
        hasBillingPortal: true,
      },
      members: [
        expect.objectContaining({
          id: "user-1",
          name: "Nicolas Miranda",
          role: "owner",
        }),
      ],
    });
    expect(userFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { orgId: "org-1" },
      }),
    );
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

describe("dashboard conversations", () => {
  it("returns inbox counts and leadId on the conversation list", async () => {
    campaignLeadFindMany.mockResolvedValueOnce([
      {
        id: "campaign-lead-1",
        campaignId: "campaign-1",
        leadId: "lead-1",
        linkedinChatId: "chat-1",
        status: "replied",
        lead: { firstName: "Hannah", lastName: "Lewis", title: "VP", company: "Common Thread", avatarUrl: null },
        campaign: {
          id: "campaign-1",
          name: "Pipeline Acceleration",
          senderAccount: { id: "account-1", accountName: "Nicolas", platform: "linkedin", status: "active", unipileId: "unipile-1" },
        },
      },
      {
        id: "campaign-lead-2",
        campaignId: "campaign-1",
        leadId: "lead-2",
        linkedinChatId: "chat-2",
        status: "active",
        lead: { firstName: "Maya", lastName: "Chen", title: "Founder", company: "Northstar", avatarUrl: null },
        campaign: {
          id: "campaign-1",
          name: "Pipeline Acceleration",
          senderAccount: { id: "account-1", accountName: "Nicolas", platform: "linkedin", status: "active", unipileId: "unipile-1" },
        },
      },
    ]);
    messageFindMany.mockResolvedValueOnce([
      {
        id: "msg-1",
        campaignId: "campaign-1",
        leadId: "lead-1",
        direction: "inbound",
        status: "delivered",
        origin: "prospect",
        content: { message: "Sounds good" },
        readAt: null,
        handledAt: null,
        sentAt: new Date("2026-07-22T12:00:00.000Z"),
        createdAt: new Date("2026-07-22T12:00:00.000Z"),
      },
      {
        id: "msg-2",
        campaignId: "campaign-1",
        leadId: "lead-2",
        direction: "outbound",
        status: "sent",
        origin: "sequence",
        content: { message: "Hello Maya" },
        readAt: null,
        handledAt: null,
        sentAt: new Date("2026-07-21T12:00:00.000Z"),
        createdAt: new Date("2026-07-21T12:00:00.000Z"),
      },
    ]);

    const response = await app.inject({ method: "GET", url: "/dashboard/conversations?state=all&limit=10" });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.counts).toEqual({ all: 2, unread: 1, needsReply: 1 });
    expect(body.total).toBe(2);
    expect(body.conversations[0]).toMatchObject({
      id: "campaign-lead-1",
      leadId: "lead-1",
      unreadCount: 1,
      needsReply: true,
    });
  });

  it("includes leadId on conversation detail", async () => {
    campaignLeadFindFirst.mockResolvedValueOnce({
      id: "campaign-lead-1",
      campaignId: "campaign-1",
      leadId: "lead-1",
      status: "replied",
      currentStep: 2,
      linkedinChatId: "chat-1",
      lead: {
        firstName: "Hannah",
        lastName: "Lewis",
        title: "VP",
        company: "Common Thread",
        location: "North America",
        linkedinUrl: "https://linkedin.com/in/hannah",
        avatarUrl: null,
        status: "replied",
      },
      campaign: {
        id: "campaign-1",
        name: "Pipeline Acceleration",
        senderAccount: { id: "account-1", accountName: "Nicolas", platform: "linkedin", status: "active", unipileId: "unipile-1" },
      },
    });
    messageFindMany.mockResolvedValueOnce([
      {
        id: "msg-1",
        content: { message: "Hello" },
        direction: "outbound",
        origin: "sequence",
        status: "sent",
        readAt: null,
        handledAt: null,
        sentAt: new Date("2026-07-22T10:00:00.000Z"),
        createdAt: new Date("2026-07-22T10:00:00.000Z"),
        manualDeliveryAttempt: null,
      },
    ]);
    messageUpdateMany.mockResolvedValueOnce({ count: 0 });
    getDailySendLimitStatus.mockResolvedValueOnce({ limit: 50, remaining: 40, resetAt: "2026-07-23T00:00:00.000Z" });

    const response = await app.inject({ method: "GET", url: "/dashboard/conversations/campaign-lead-1" });

    expect(response.statusCode).toBe(200);
    expect(response.json().conversation).toMatchObject({
      id: "campaign-lead-1",
      leadId: "lead-1",
      prospect: { name: "Hannah Lewis" },
    });
  });
});

describe("overview date ranges and trends", () => {
  it("builds a complete persisted activity series for the selected date range", () => {
    expect(
      buildOverviewActivityTrend(
        new Date("2026-07-20T00:00:00.000Z"),
        new Date("2026-07-22T23:59:59.999Z"),
        [
          { createdAt: new Date("2026-07-20T10:00:00.000Z"), direction: "outbound" },
          { createdAt: new Date("2026-07-21T10:00:00.000Z"), direction: "inbound" },
          { createdAt: new Date("2026-07-21T11:00:00.000Z"), direction: "outbound" },
        ],
      ),
    ).toEqual([
      { date: "2026-07-20", sent: 1, replies: 0 },
      { date: "2026-07-21", sent: 1, replies: 1 },
      { date: "2026-07-22", sent: 0, replies: 0 },
    ]);
  });

  it("uses an inclusive requested date range and the immediately preceding comparison window", () => {
    expect(
      resolveOverviewDateRange(
        { startDate: "2026-07-10", endDate: "2026-07-16", activityKind: "all" },
        new Date("2026-07-22T10:00:00.000Z"),
      ),
    ).toMatchObject({
      start: new Date("2026-07-10T00:00:00.000Z"),
      end: new Date("2026-07-16T23:59:59.999Z"),
      previousStart: new Date("2026-07-03T00:00:00.000Z"),
      previousEnd: new Date("2026-07-09T23:59:59.999Z"),
    });
  });

  it("reports only calculated week-over-week deltas", () => {
    expect(overviewMetricTrend(12, 10)).toEqual({ direction: "up", percent: 20 });
    expect(overviewMetricTrend(8, 10)).toEqual({ direction: "down", percent: 20 });
    expect(overviewMetricTrend(0, 0)).toEqual({ direction: "flat", percent: 0 });
    expect(overviewMetricTrend(3, 0)).toEqual({ direction: "new", percent: null });
  });
});
