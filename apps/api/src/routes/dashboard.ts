import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { NotFoundError } from "../lib/errors.js";
import {
  CampaignIdParamsSchema,
  authenticatedRoute,
  errorResponses
} from "../lib/openapi.js";
import { prisma } from "../lib/prisma.js";
import { cacheDashboardChrome, invalidateDashboardChrome, readDashboardChrome } from "../lib/dashboard-cache.js";
import { getDailySendLimitStatus } from "../lib/rate-limiter.js";
import { requireOrgId } from "../lib/request-org.js";
import { buildPrimaryCampaignVideoSummary } from "../lib/campaign-video-summary.js";
import { chatEventChannel } from "../lib/chat-events.js";
import { createRedisSubscriber } from "../lib/redis.js";
import { registerDashboardSettingsRoutes } from "./dashboard-settings.js";
import { registerDashboardProspectRoutes } from "./dashboard-prospects.js";
import { registerDashboardAnalyticsRoutes } from "./dashboard-analytics.js";
import { registerDashboardConversationRoutes } from "./dashboard-conversations.js";
import {
  leadSearchWhere,
  conversationKey,
  overviewMetricTrend,
  resolveOverviewDateRange,
  type OverviewMetricTrend,
} from "./dashboard-support.js";

export { leadSearchWhere, overviewMetricTrend, resolveOverviewDateRange } from "./dashboard-support.js";
export { buildAnalyticsActivityTrend } from "./dashboard-analytics.js";

type EngineStatus = "running" | "ready" | "needs_attention";

type DashboardActivity = {
  id: string;
  kind: "message" | "prospect" | "video" | "campaign";
  title: string;
  detail: string;
  occurredAt: Date;
  avatarUrl?: string | null;
  channel?: string;
  action?: "reply" | "view";
  href?: string;
};

type ActivityMessage = {
  id: string;
  direction: string;
  channel: string;
  createdAt: Date;
  campaignLeadId?: string;
  lead: { id?: string; firstName: string; lastName: string; company: string; avatarUrl: string | null };
  campaign: { id?: string; name: string };
};

type ActivityLead = {
  id: string;
  firstName: string;
  lastName: string;
  company: string;
  avatarUrl: string | null;
  createdAt: Date;
};

type ActivityVideo = {
  id: string;
  status: string;
  needsReview: boolean;
  updatedAt: Date;
  campaign: { name: string } | null;
  lead: { firstName: string; lastName: string; avatarUrl: string | null } | null;
};

type ActivityCampaign = {
  id: string;
  name: string;
  status: string;
  updatedAt: Date;
  _count: { leads: number };
};

const ActivityListQuerySchema = z.object({
  kind: z.enum(["all", "message", "prospect", "video", "campaign"]).default("all"),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  offset: z.coerce.number().int().min(0).default(0),
  startDate: z.string().date().optional(),
  endDate: z.string().date().optional(),
  channel: z.string().trim().max(40).optional(),
  campaignId: z.string().trim().min(1).optional(),
});

type ActivitySummaryKey =
  | "totalActivities"
  | "messagesSent"
  | "repliesReceived"
  | "meetingsBooked"
  | "videosSent";

type ActivitySummaryTrend = {
  direction: "up" | "down" | "flat" | "new";
  percent: number | null;
};

const OverviewQuerySchema = z.object({
  startDate: z.string().date().optional(),
  endDate: z.string().date().optional(),
  activityKind: z.enum(["all", "message", "prospect", "video", "campaign"]).default("all"),
});

const DashboardSearchQuerySchema = z.object({
  query: z.string().trim().min(2).max(120),
});

const DashboardCampaignsQuerySchema = z.object({
  status: z.enum(["all", "drafts", "running", "paused", "completed", "archived"]).default("all"),
  search: z.string().trim().max(120).optional(),
  channel: z.string().trim().max(40).optional(),
});

const CampaignVideoPatchSchema = z.object({
  paused: z.boolean(),
});

const SENT_MESSAGE_STATUSES = ["sent", "delivered", "opened", "replied"];

type DashboardChrome = {
  organization: { name: string; plan: string };
  engine: { status: EngineStatus; label: string; detail: string };
  unreadNotificationCount: number;
  channels: Array<{ id: string; platform: string; accountName: string; status: string }>;
  activity: Array<{
    id: string;
    kind: "message";
    title: string;
    detail: string;
    occurredAt: Date;
    avatarUrl: string | null;
    channel: string;
    action: "reply" | "view";
    href: string;
  }>;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function campaignMetricRate(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

export function campaignStatusFilter(status: z.infer<typeof DashboardCampaignsQuerySchema>["status"]): string[] | undefined {
  if (status === "all" || status === "archived") return undefined;
  if (status === "drafts") return ["draft", "review"];
  if (status === "running") return ["active"];
  return [status];
}

function isCampaignArchived(aiConfig: unknown): boolean {
  return asRecord(aiConfig)?.archived === true;
}

type OverviewMetricKey =
  | "prospects"
  | "outreachInProgress"
  | "replies"
  | "meetingsBooked"
  | "outreachSent"
  | "customers";

type OverviewActivityMessage = {
  createdAt: Date;
  direction: string;
  leadId?: string;
};

export function buildOverviewActivityTrend(
  start: Date,
  end: Date,
  messages: OverviewActivityMessage[],
): Array<{ date: string; sent: number; replies: number }> {
  const firstDay = new Date(`${start.toISOString().slice(0, 10)}T00:00:00.000Z`);
  const lastDay = new Date(`${end.toISOString().slice(0, 10)}T00:00:00.000Z`);
  const counts = new Map<string, { sent: number; replies: number }>();

  for (const cursor = new Date(firstDay); cursor <= lastDay; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    counts.set(cursor.toISOString().slice(0, 10), { sent: 0, replies: 0 });
  }

  for (const message of messages) {
    const date = message.createdAt.toISOString().slice(0, 10);
    const day = counts.get(date);
    if (!day) continue;
    if (message.direction === "outbound") day.sent += 1;
    if (message.direction === "inbound") day.replies += 1;
  }

  return [...counts].map(([date, values]) => ({ date, ...values }));
}

type MessageContent = { message: string; attachments: Array<{ type: string; videoUrl?: string; filename?: string }> };

function jsonText(value: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const record = value as Record<string, unknown>;
  for (const key of ["message", "body", "text"]) {
    if (typeof record[key] === "string" && record[key].trim()) {
      return record[key].trim();
    }
  }
  return "";
}

function messageContent(value: unknown): MessageContent {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { message: "Message content unavailable", attachments: [] };
  }
  const record = value as Record<string, unknown>;
  const rawAttachments = Array.isArray(record.attachments) ? record.attachments : [];
  const attachments = rawAttachments.flatMap((attachment) => {
    if (!attachment || typeof attachment !== "object" || Array.isArray(attachment)) return [];
    const item = attachment as Record<string, unknown>;
    if (typeof item.type !== "string") return [];
    return [{
      type: item.type,
      ...(typeof item.videoUrl === "string" ? { videoUrl: item.videoUrl } : {}),
      ...(typeof item.filename === "string" ? { filename: item.filename } : {}),
    }];
  });
  return { message: jsonText(value) || "Message content unavailable", attachments };
}

function leadName(lead: { firstName: string; lastName: string }): string {
  return `${lead.firstName} ${lead.lastName}`.trim() || "A prospect";
}

function activityKindFromEventType(eventType: string): DashboardActivity["kind"] {
  if (eventType.startsWith("message.")) return "message";
  if (eventType.startsWith("prospect.")) return "prospect";
  if (eventType.startsWith("video.")) return "video";
  return "campaign";
}

function activityMetadata(value: Prisma.JsonValue | null): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function metadataString(metadata: Record<string, unknown>, key: string): string | null {
  const value = metadata[key];
  return typeof value === "string" && value.trim() ? value : null;
}

export function resolveDashboardEngine(input: {
  subscriptionStatus: string | null;
  activeChannelCount: number;
  activeCampaignCount: number;
}): { status: EngineStatus; label: string; detail: string } {
  if (input.subscriptionStatus !== "active") {
    return {
      status: "needs_attention",
      label: "Billing needs attention",
      detail: "Activate your subscription before outreach can run.",
    };
  }

  if (input.activeChannelCount === 0) {
    return {
      status: "needs_attention",
      label: "Connect a channel",
      detail: "Connect at least one healthy channel before launching outreach.",
    };
  }

  if (input.activeCampaignCount === 0) {
    return {
      status: "ready",
      label: "Ready to launch",
      detail: "Your workspace is configured. Create and launch a campaign when ready.",
    };
  }

  return {
    status: "running",
    label: "Acquisition engine running",
    detail: "Your active campaign is progressing through its outreach sequence.",
  };
}

export function sortDashboardActivity(items: DashboardActivity[]): DashboardActivity[] {
  return items.sort((left, right) => right.occurredAt.getTime() - left.occurredAt.getTime());
}

function buildDashboardActivity(input: {
  messages: ActivityMessage[];
  leads: ActivityLead[];
  videos: ActivityVideo[];
  campaigns: ActivityCampaign[];
}): DashboardActivity[] {
  return sortDashboardActivity([
    ...input.messages.map((message) => {
      const name = leadName(message.lead);
      const direction = message.direction === "inbound" ? "Reply received" : "Outreach sent";
      return {
        id: `message:${message.id}`,
        kind: "message" as const,
        title: `${direction} ${message.direction === "inbound" ? "from" : "to"} ${name}`,
        detail: `${message.channel} · ${message.campaign.name}`,
        occurredAt: message.createdAt,
        avatarUrl: message.lead.avatarUrl,
        channel: message.channel,
        action: message.direction === "inbound" && message.campaignLeadId ? "reply" as const : "view" as const,
        href: message.campaignLeadId
          ? `/dashboard/messages/${message.campaignLeadId}`
          : message.lead.id
            ? `/dashboard/prospects/${message.lead.id}`
            : "/dashboard/activity",
      };
    }),
    ...input.leads.map((lead) => ({
      id: `lead:${lead.id}`,
      kind: "prospect" as const,
      title: `Prospect added: ${leadName(lead)}`,
      detail: lead.company || "Company not provided",
      occurredAt: lead.createdAt,
      avatarUrl: lead.avatarUrl,
      action: "view" as const,
      href: `/dashboard/prospects/${lead.id}`,
    })),
    ...input.videos.map((video) => ({
      id: `video:${video.id}`,
      kind: "video" as const,
      title: video.needsReview
        ? "Video needs review"
        : video.status === "failed"
          ? "Video generation failed"
          : video.status === "ready" || video.status === "approved"
            ? "Video ready"
            : "Video generation updated",
      detail: video.lead
        ? `For ${leadName(video.lead)}`
        : video.campaign?.name ?? "Campaign video",
      occurredAt: video.updatedAt,
      avatarUrl: video.lead?.avatarUrl ?? null,
      action: "view" as const,
      href: "/dashboard/campaigns",
    })),
    ...input.campaigns.map((campaign) => ({
      id: `campaign:${campaign.id}`,
      kind: "campaign" as const,
      title: `${campaign.name} is ${campaign.status}`,
      detail: `${campaign._count.leads} enrolled ${campaign._count.leads === 1 ? "prospect" : "prospects"}`,
      occurredAt: campaign.updatedAt,
      action: "view" as const,
      href: "/dashboard/campaigns",
    })),
  ]);
}

function messageHasVideoAttachment(content: unknown): boolean {
  return messageContent(content).attachments.some((attachment) => attachment.type === "video");
}

function inDateRange(value: Date, start: Date, end: Date): boolean {
  const time = value.getTime();
  return time >= start.getTime() && time <= end.getTime();
}

export const dashboardRoutes: FastifyPluginAsync = async (app) => {
  const r = app.withTypeProvider<ZodTypeProvider>();
  const dashboardRequestTimes = new WeakMap<object, number>();

  app.addHook("onRequest", async (request) => {
    dashboardRequestTimes.set(request, performance.now());
  });
  app.addHook("onSend", async (request, reply, payload) => {
    const startedAt = dashboardRequestTimes.get(request);
    if (startedAt !== undefined) {
      reply.header("Server-Timing", `app;dur=${(performance.now() - startedAt).toFixed(1)}`);
    }
    return payload;
  });
  app.addHook("onResponse", async (request, reply) => {
    const startedAt = dashboardRequestTimes.get(request);
    const elapsed = startedAt === undefined ? null : performance.now() - startedAt;
    if (elapsed !== null && elapsed >= 250) {
      request.log.info({ dashboardRoute: request.routeOptions.url, statusCode: reply.statusCode, durationMs: Math.round(elapsed) }, "slow dashboard request");
    }
  });

  r.get("/dashboard/chrome", {
    schema: { ...authenticatedRoute("Dashboard", "Lightweight dashboard shell data") },
  }, async (request, reply) => {
    const orgId = requireOrgId(request);
    const cached = await readDashboardChrome<DashboardChrome>(orgId);
    if (cached) {
      reply.header("Cache-Control", "private, max-age=0");
      return reply.send(cached);
    }

    const [organization, activeChannelCount, activeCampaignCount, channels, unreadNotificationCount, messages] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: orgId },
        select: { name: true, plan: true, subscriptionStatus: true },
      }),
      prisma.socialAccount.count({ where: { orgId, status: "active" } }),
      prisma.campaign.count({ where: { orgId, status: "active" } }),
      prisma.socialAccount.findMany({
        where: { orgId },
        orderBy: { createdAt: "asc" },
        select: { id: true, platform: true, accountName: true, status: true },
      }),
      prisma.message.count({
        where: { orgId, direction: "inbound", OR: [{ readAt: null }, { handledAt: null }] },
      }),
      prisma.message.findMany({
        where: { orgId },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          direction: true,
          channel: true,
          createdAt: true,
          lead: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
          campaign: { select: { name: true } },
        },
      }),
    ]);

    const value: DashboardChrome = {
      organization: { name: organization?.name ?? "Workspace", plan: organization?.plan ?? "starter" },
      engine: resolveDashboardEngine({
        subscriptionStatus: organization?.subscriptionStatus ?? null,
        activeChannelCount,
        activeCampaignCount,
      }),
      unreadNotificationCount,
      channels,
      activity: messages.map((message) => {
        const name = leadName(message.lead);
        const inbound = message.direction === "inbound";
        return {
          id: `message:${message.id}`,
          kind: "message" as const,
          title: `${inbound ? "Reply received from" : "Outreach sent to"} ${name}`,
          detail: `${message.channel} · ${message.campaign.name}`,
          occurredAt: message.createdAt,
          avatarUrl: message.lead.avatarUrl,
          channel: message.channel,
          action: inbound ? "reply" as const : "view" as const,
          href: inbound ? "/dashboard/messages?state=needs_reply" : `/dashboard/prospects/${message.lead.id}`,
        };
      }),
    };

    await cacheDashboardChrome(orgId, value);
    reply.header("Cache-Control", "private, max-age=0");
    return reply.send(value);
  });

  r.get("/dashboard/campaigns", {
    schema: {
      ...authenticatedRoute("Dashboard", "List campaigns with operator summary"),
      querystring: DashboardCampaignsQuerySchema,
    },
  }, async (request, reply) => {
    const orgId = requireOrgId(request);
    const query = request.query;
    const statusFilter = campaignStatusFilter(query.status);
    const now = new Date();
    const currentStart = new Date(now);
    currentStart.setUTCDate(currentStart.getUTCDate() - 29);
    currentStart.setUTCHours(0, 0, 0, 0);
    const previousStart = new Date(currentStart);
    previousStart.setUTCDate(previousStart.getUTCDate() - 30);

    const campaigns = await prisma.campaign.findMany({
      where: { orgId },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        status: true,
        channels: true,
        aiConfig: true,
        createdAt: true,
        updatedAt: true,
        socialAccountId: true,
        senderAccount: {
          select: { id: true, platform: true, accountName: true, status: true },
        },
        leads: { select: { lead: { select: { status: true, updatedAt: true } } } },
        messages: { select: { direction: true, status: true, content: true } },
        videoAssets: {
          orderBy: { updatedAt: "desc" },
          take: 4,
          select: {
            id: true,
            status: true,
            videoUrl: true,
            thumbnailUrl: true,
            needsReview: true,
            criticScore: true,
          },
        },
        videoTemplates: {
          orderBy: { version: "desc" },
          take: 1,
          select: { id: true, status: true, needsReview: true, criticScore: true },
        },
      },
    });

    const visibleCampaigns = campaigns.filter((campaign) => {
      const archived = isCampaignArchived(campaign.aiConfig);
      if (query.status === "archived") return archived;
      return !archived;
    });

    const rows = visibleCampaigns
      .filter((campaign) => !statusFilter || statusFilter.includes(campaign.status))
      .filter((campaign) => !query.channel || campaign.channels.includes(query.channel))
      .filter((campaign) => !query.search || campaign.name.toLowerCase().includes(query.search.toLowerCase()))
      .map((campaign) => {
        const sent = campaign.messages.filter(
          (message) => message.direction === "outbound" && SENT_MESSAGE_STATUSES.includes(message.status),
        ).length;
        const replies = campaign.messages.filter((message) => message.direction === "inbound").length;
        const meetings = campaign.leads.filter(({ lead }) => lead.status === "meeting").length;
        const video = buildPrimaryCampaignVideoSummary({
          aiConfig: campaign.aiConfig,
          assets: campaign.videoAssets,
          template: campaign.videoTemplates[0] ?? null,
          outboundContents: campaign.messages
            .filter((message) => message.direction === "outbound")
            .map((message) => message.content),
        });
        return {
          id: campaign.id,
          name: campaign.name,
          status: campaign.status,
          channels: campaign.channels,
          createdAt: campaign.createdAt,
          updatedAt: campaign.updatedAt,
          prospectCount: campaign.leads.length,
          archived: isCampaignArchived(campaign.aiConfig),
          senderAccount: campaign.senderAccount,
          video,
          metrics: {
            sent,
            replies,
            meetings,
            replyRate: campaignMetricRate(replies, sent),
            meetingRate: campaignMetricRate(meetings, sent),
          },
        };
      });

    const activePool = campaigns.filter((campaign) => !isCampaignArchived(campaign.aiConfig));
    const runningCurrent = activePool.filter(
      (campaign) => campaign.status === "active" && campaign.createdAt >= currentStart,
    ).length;
    const runningPrevious = activePool.filter(
      (campaign) => campaign.status === "active" && campaign.createdAt >= previousStart && campaign.createdAt < currentStart,
    ).length;
    const meetingsCurrent = activePool.reduce(
      (total, campaign) => total + campaign.leads.filter(({ lead }) => lead.status === "meeting" && lead.updatedAt >= currentStart).length,
      0,
    );
    const meetingsPrevious = activePool.reduce(
      (total, campaign) => total + campaign.leads.filter(({ lead }) => lead.status === "meeting" && lead.updatedAt >= previousStart && lead.updatedAt < currentStart).length,
      0,
    );

    return reply.send({
      campaigns: rows,
      summary: {
        total: activePool.length,
        running: activePool.filter((campaign) => campaign.status === "active").length,
        drafts: activePool.filter((campaign) => ["draft", "review"].includes(campaign.status)).length,
        paused: activePool.filter((campaign) => campaign.status === "paused").length,
        completed: activePool.filter((campaign) => campaign.status === "completed").length,
        archived: campaigns.filter((campaign) => isCampaignArchived(campaign.aiConfig)).length,
        meetings: activePool.reduce(
          (total, campaign) => total + campaign.leads.filter(({ lead }) => lead.status === "meeting").length,
          0,
        ),
        deltas: {
          running: { current: runningCurrent, previous: runningPrevious },
          meetings: { current: meetingsCurrent, previous: meetingsPrevious },
        },
      },
    });
  });

  r.get("/dashboard/overview", {
    schema: {
      ...authenticatedRoute("Dashboard", "Workspace overview metrics"),
      querystring: OverviewQuerySchema,
    },
  }, async (request, reply) => {
    const orgId = requireOrgId(request);
    const query = request.query;
    const range = resolveOverviewDateRange(query);
    const currentDateWhere = { gte: range.start, lte: range.end };
    const previousDateWhere = { gte: range.previousStart, lte: range.previousEnd };
    const contactedStatuses = ["contacted", "connected", "replied", "meeting", "converted"];

    const [
      organization,
      prospectCount,
      previousProspectCount,
      outreachInProgress,
      previousOutreachInProgress,
      replyCount,
      previousReplyCount,
      meetingCount,
      previousMeetingCount,
      sentOutreachCount,
      previousSentOutreachCount,
      customerCount,
      previousCustomerCount,
      activeCampaignCount,
      campaigns,
      channels,
      failedVideoCount,
      reviewVideoCount,
      unreadNotificationCount,
      recentMessages,
      recentLeads,
      recentVideos,
      activityMessages,
    ] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: orgId },
        select: { name: true, plan: true, subscriptionStatus: true, stripeCustomerId: true },
      }),
      prisma.lead.count({ where: { orgId, status: { in: contactedStatuses }, updatedAt: currentDateWhere } }),
      prisma.lead.count({ where: { orgId, status: { in: contactedStatuses }, updatedAt: previousDateWhere } }),
      prisma.campaignLead.count({
        where: { campaign: { orgId }, status: "active", createdAt: currentDateWhere },
      }),
      prisma.campaignLead.count({
        where: { campaign: { orgId }, status: "active", createdAt: previousDateWhere },
      }),
      prisma.message.count({ where: { orgId, direction: "inbound", createdAt: currentDateWhere } }),
      prisma.message.count({ where: { orgId, direction: "inbound", createdAt: previousDateWhere } }),
      prisma.lead.count({ where: { orgId, status: "meeting", updatedAt: currentDateWhere } }),
      prisma.lead.count({ where: { orgId, status: "meeting", updatedAt: previousDateWhere } }),
      prisma.message.count({ where: { orgId, direction: "outbound", createdAt: currentDateWhere } }),
      prisma.message.count({ where: { orgId, direction: "outbound", createdAt: previousDateWhere } }),
      prisma.lead.count({ where: { orgId, status: "converted", updatedAt: currentDateWhere } }),
      prisma.lead.count({ where: { orgId, status: "converted", updatedAt: previousDateWhere } }),
      prisma.campaign.count({ where: { orgId, status: "active" } }),
      prisma.campaign.findMany({
        where: { orgId, status: { in: ["active", "draft", "review"] } },
        orderBy: { updatedAt: "desc" },
        take: 12,
        select: {
          id: true,
          name: true,
          status: true,
          channels: true,
          aiConfig: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { leads: true } },
        },
      }),
      prisma.socialAccount.findMany({
        where: { orgId },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          platform: true,
          accountName: true,
          avatarUrl: true,
          status: true,
          unipileId: true,
        },
      }),
      prisma.videoAsset.count({ where: { orgId, status: "failed" } }),
      prisma.videoAsset.count({ where: { orgId, needsReview: true } }),
      prisma.message.count({
        where: {
          orgId,
          direction: "inbound",
          OR: [{ readAt: null }, { handledAt: null }],
        },
      }),
      prisma.message.findMany({
        where: {
          orgId,
          createdAt: currentDateWhere,
        },
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true,
          direction: true,
          channel: true,
          status: true,
          createdAt: true,
          leadId: true,
          campaignId: true,
          lead: { select: { id: true, firstName: true, lastName: true, company: true, avatarUrl: true } },
          campaign: { select: { id: true, name: true } },
        },
      }),
      prisma.lead.findMany({
        where: { orgId, createdAt: currentDateWhere },
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          company: true,
          avatarUrl: true,
          createdAt: true,
        },
      }),
      prisma.videoAsset.findMany({
        where: { orgId, updatedAt: currentDateWhere },
        orderBy: { updatedAt: "desc" },
        take: 8,
        select: {
          id: true,
          status: true,
          needsReview: true,
          videoUrl: true,
          thumbnailUrl: true,
          updatedAt: true,
          campaign: { select: { id: true, name: true } },
          lead: { select: { firstName: true, lastName: true, avatarUrl: true } },
        },
      }),
      prisma.message.findMany({
        where: { orgId, createdAt: currentDateWhere },
        select: { createdAt: true, direction: true },
      }),
    ]);

    const activeChannels = channels.filter((channel) => channel.status === "active");
    const primaryCampaign =
      campaigns.find((campaign) => campaign.status === "active") ?? campaigns[0] ?? null;
    const engine = resolveDashboardEngine({
      subscriptionStatus: organization?.subscriptionStatus ?? null,
      activeChannelCount: activeChannels.length,
      activeCampaignCount,
    });

    const attention = [
      ...(organization?.subscriptionStatus === "active"
        ? []
        : [{
            kind: "billing" as const,
            title: "Subscription needs attention",
            detail: "Activate your subscription to run outreach.",
          }]),
      ...(activeChannels.length === 0
        ? [{
            kind: "channels" as const,
            title: "No active channels",
            detail: "Connect a healthy channel before launching outreach.",
          }]
        : channels
            .filter((channel) => channel.status !== "active")
            .map((channel) => ({
              kind: "channels" as const,
              title: `${channel.platform} needs attention`,
              detail: `${channel.accountName} is ${channel.status}.`,
            }))),
      ...(activeCampaignCount === 0
        ? [{
            kind: "campaign" as const,
            title: "No active campaign",
            detail: "Review your strategy, then create and launch a campaign.",
          }]
        : []),
      ...(failedVideoCount > 0
        ? [{
            kind: "video" as const,
            title: `${failedVideoCount} video ${failedVideoCount === 1 ? "asset has" : "assets have"} failed`,
            detail: "Review the affected campaign before sending outreach.",
          }]
        : []),
      ...(reviewVideoCount > 0
        ? [{
            kind: "video" as const,
            title: `${reviewVideoCount} video ${reviewVideoCount === 1 ? "asset needs" : "assets need"} review`,
            detail: "Quality review is required before those videos can be used.",
          }]
        : []),
    ];

    const recentCampaignLeads = recentMessages.length
      ? await prisma.campaignLead.findMany({
          where: {
            campaign: { orgId },
            OR: recentMessages.map((message) => ({ campaignId: message.campaignId, leadId: message.leadId })),
          },
          select: { id: true, campaignId: true, leadId: true },
        })
      : [];
    const campaignLeadByConversation = new Map(
      recentCampaignLeads.map((campaignLead) => [conversationKey(campaignLead.campaignId, campaignLead.leadId), campaignLead.id]),
    );

    const activity = buildDashboardActivity({
      messages: recentMessages.map((message) => ({
        ...message,
        campaignLeadId: campaignLeadByConversation.get(conversationKey(message.campaignId, message.leadId)),
      })),
      leads: recentLeads,
      videos: recentVideos,
      campaigns,
    })
      .filter((item) => query.activityKind === "all" || item.kind === query.activityKind)
      .slice(0, 8);

    const metrics = {
      prospects: prospectCount,
      outreachInProgress,
      replies: replyCount,
      meetingsBooked: meetingCount,
      outreachSent: sentOutreachCount,
      customers: customerCount,
    };
    const previousMetrics = {
      prospects: previousProspectCount,
      outreachInProgress: previousOutreachInProgress,
      replies: previousReplyCount,
      meetingsBooked: previousMeetingCount,
      outreachSent: previousSentOutreachCount,
      customers: previousCustomerCount,
    };
    const trends = Object.fromEntries(
      (Object.keys(metrics) as OverviewMetricKey[]).map((key) => [key, overviewMetricTrend(metrics[key], previousMetrics[key])]),
    ) as Record<OverviewMetricKey, OverviewMetricTrend>;
    const activityTrend = buildOverviewActivityTrend(range.start, range.end, activityMessages);

    const [primaryCampaignStats, primaryCampaignMessages, primaryCampaignVideoAssets, primaryCampaignVideoTemplate, primaryCampaignVideoMessages] =
      primaryCampaign
        ? await Promise.all([
            prisma.campaignLead.findMany({
              where: { campaignId: primaryCampaign.id },
              select: { status: true, lead: { select: { status: true } } },
            }),
            prisma.message.findMany({
              where: { campaignId: primaryCampaign.id, createdAt: currentDateWhere },
              select: { direction: true, channel: true },
            }),
            prisma.videoAsset.findMany({
              where: { orgId, campaignId: primaryCampaign.id },
              orderBy: { updatedAt: "desc" },
              take: 12,
              select: {
                id: true,
                status: true,
                videoUrl: true,
                thumbnailUrl: true,
                needsReview: true,
                criticScore: true,
              },
            }),
            prisma.campaignVideoTemplate.findFirst({
              where: { orgId, campaignId: primaryCampaign.id },
              orderBy: { version: "desc" },
              select: { id: true, status: true, needsReview: true, criticScore: true },
            }),
            prisma.message.findMany({
              where: { campaignId: primaryCampaign.id, direction: "outbound" },
              select: { content: true },
            }),
          ])
        : [[], [], [], null, []];
    const primaryCampaignChannelSendCounts = primaryCampaignMessages.reduce<Record<string, number>>((counts, message) => {
      if (message.direction === "outbound") {
        counts[message.channel] = (counts[message.channel] ?? 0) + 1;
      }
      return counts;
    }, {});
    const primaryStats = primaryCampaign
      ? {
          prospects: primaryCampaignStats.length,
          contacted: primaryCampaignStats.filter((campaignLead) => campaignLead.lead.status !== "new").length,
          replies: primaryCampaignStats.filter((campaignLead) => campaignLead.lead.status === "replied").length,
          meetings: primaryCampaignStats.filter((campaignLead) => campaignLead.lead.status === "meeting").length,
          customers: primaryCampaignStats.filter((campaignLead) => campaignLead.lead.status === "converted").length,
        }
      : null;
    const primaryCampaignVideo = primaryCampaign
      ? buildPrimaryCampaignVideoSummary({
          aiConfig: primaryCampaign.aiConfig,
          assets: primaryCampaignVideoAssets,
          template: primaryCampaignVideoTemplate,
          outboundContents: primaryCampaignVideoMessages.map((message) => message.content),
        })
      : null;

    const healthSince = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const [
      needsReplyMessages,
      failedDeliveryAttempts,
      failedManualAttempts,
      failedDeliveryCount,
      failedManualCount,
      stalledCampaignLeads,
      stalledCount,
      pendingInviteCount,
      needsReplyMessageCount,
    ] = await Promise.all([
      prisma.message.findMany({
        where: {
          orgId,
          direction: "inbound",
          handledAt: null,
        },
        orderBy: { createdAt: "desc" },
        take: 12,
        select: {
          id: true,
          campaignId: true,
          leadId: true,
          createdAt: true,
          content: true,
          lead: { select: { firstName: true, lastName: true, company: true, avatarUrl: true } },
          campaign: { select: { id: true, name: true } },
        },
      }),
      prisma.deliveryAttempt.findMany({
        where: {
          state: { in: ["failed", "unknown"] },
          reservedAt: { gte: healthSince },
          campaignLead: { campaign: { orgId } },
        },
        orderBy: { reservedAt: "desc" },
        take: 5,
        select: {
          id: true,
          state: true,
          stepIndex: true,
          reservedAt: true,
          campaignLead: {
            select: {
              id: true,
              campaign: { select: { id: true, name: true } },
              lead: { select: { firstName: true, lastName: true } },
            },
          },
        },
      }),
      prisma.manualDeliveryAttempt.findMany({
        where: {
          state: { in: ["failed", "unknown"] },
          reservedAt: { gte: healthSince },
          campaignLead: { campaign: { orgId } },
        },
        orderBy: { reservedAt: "desc" },
        take: 5,
        select: {
          id: true,
          state: true,
          reservedAt: true,
          campaignLead: {
            select: {
              id: true,
              campaign: { select: { id: true, name: true } },
              lead: { select: { firstName: true, lastName: true } },
            },
          },
        },
      }),
      prisma.deliveryAttempt.count({
        where: {
          state: { in: ["failed", "unknown"] },
          reservedAt: { gte: healthSince },
          campaignLead: { campaign: { orgId } },
        },
      }),
      prisma.manualDeliveryAttempt.count({
        where: {
          state: { in: ["failed", "unknown"] },
          reservedAt: { gte: healthSince },
          campaignLead: { campaign: { orgId } },
        },
      }),
      prisma.campaignLead.findMany({
        where: {
          status: "active",
          currentStep: { gte: 1 },
          campaign: { orgId, status: "active" },
          lead: { status: "contacted" },
        },
        orderBy: { createdAt: "asc" },
        take: 5,
        select: {
          id: true,
          currentStep: true,
          createdAt: true,
          campaign: { select: { id: true, name: true } },
          lead: { select: { firstName: true, lastName: true, company: true } },
        },
      }),
      prisma.campaignLead.count({
        where: {
          status: "active",
          currentStep: { gte: 1 },
          campaign: { orgId, status: "active" },
          lead: { status: "contacted" },
        },
      }),
      prisma.campaignLead.count({
        where: {
          status: "active",
          campaign: { orgId, status: "active" },
          lead: { status: "contacted" },
        },
      }),
      prisma.message.count({
        where: {
          orgId,
          direction: "inbound",
          handledAt: null,
        },
      }),
    ]);

    const needsReplyCampaignLeads = needsReplyMessages.length
      ? await prisma.campaignLead.findMany({
          where: {
            campaign: { orgId },
            OR: needsReplyMessages.map((message) => ({
              campaignId: message.campaignId,
              leadId: message.leadId,
            })),
          },
          select: { id: true, campaignId: true, leadId: true },
        })
      : [];
    const needsReplyLeadByConversation = new Map(
      needsReplyCampaignLeads.map((item) => [conversationKey(item.campaignId, item.leadId), item.id]),
    );
    const seenNeedsReply = new Set<string>();
    const needsReply = needsReplyMessages.flatMap((message) => {
      const key = conversationKey(message.campaignId, message.leadId);
      if (seenNeedsReply.has(key)) return [];
      seenNeedsReply.add(key);
      const campaignLeadId = needsReplyLeadByConversation.get(key);
      if (!campaignLeadId) return [];
      const content = message.content as { message?: string } | null;
      return [{
        campaignLeadId,
        prospectName: [message.lead.firstName, message.lead.lastName].filter(Boolean).join(" ") || "Prospect",
        company: message.lead.company,
        avatarUrl: message.lead.avatarUrl,
        campaignName: message.campaign.name,
        preview: content?.message?.slice(0, 120) ?? "Inbound reply",
        occurredAt: message.createdAt,
      }];
    }).slice(0, 5);

    const reconnectAccounts = channels
      .filter((channel) => channel.status !== "active")
      .map((channel) => ({
        id: channel.id,
        platform: channel.platform,
        accountName: channel.accountName,
        status: channel.status,
      }));

    const failedSends = [
      ...failedDeliveryAttempts.map((attempt) => ({
        id: attempt.id,
        kind: "automation" as const,
        state: attempt.state,
        campaignLeadId: attempt.campaignLead.id,
        campaignName: attempt.campaignLead.campaign.name,
        prospectName: [attempt.campaignLead.lead.firstName, attempt.campaignLead.lead.lastName].filter(Boolean).join(" ") || "Prospect",
        occurredAt: attempt.reservedAt,
      })),
      ...failedManualAttempts.map((attempt) => ({
        id: attempt.id,
        kind: "operator" as const,
        state: attempt.state,
        campaignLeadId: attempt.campaignLead.id,
        campaignName: attempt.campaignLead.campaign.name,
        prospectName: [attempt.campaignLead.lead.firstName, attempt.campaignLead.lead.lastName].filter(Boolean).join(" ") || "Prospect",
        occurredAt: attempt.reservedAt,
      })),
    ]
      .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
      .slice(0, 5);

    const stalled = stalledCampaignLeads.map((item) => ({
      campaignLeadId: item.id,
      campaignId: item.campaign.id,
      campaignName: item.campaign.name,
      prospectName: [item.lead.firstName, item.lead.lastName].filter(Boolean).join(" ") || "Prospect",
      company: item.lead.company,
      currentStep: item.currentStep,
      waitingSince: item.createdAt,
    }));

    const linkedInSenders = channels.filter(
      (channel) => channel.platform.toLowerCase() === "linkedin" && channel.unipileId,
    );
    const senderLimits = await Promise.all(
      linkedInSenders.map(async (channel) => {
        const [invite, message] = await Promise.all([
          getDailySendLimitStatus(channel.unipileId!, "invite"),
          getDailySendLimitStatus(channel.unipileId!, "message"),
        ]);
        return {
          id: channel.id,
          accountName: channel.accountName,
          status: channel.status,
          invite,
          message,
        };
      }),
    );

    const actions = {
      needsReply,
      needsReplyCount: needsReplyMessageCount,
      reconnectAccounts,
      failedSends,
      failedSendCount: failedDeliveryCount + failedManualCount,
      stalled,
      stalledCount,
    };

    const sendingHealth = {
      senders: senderLimits,
      unhealthyAccounts: reconnectAccounts,
      failedSendCount: failedDeliveryCount + failedManualCount,
      pendingInviteAcceptances: pendingInviteCount,
    };

    return reply.send({
      organization: {
        name: organization?.name ?? "LeadReacher workspace",
        plan: organization?.plan ?? "starter",
        subscriptionStatus: organization?.subscriptionStatus ?? null,
        hasBillingPortal: Boolean(organization?.stripeCustomerId),
      },
      engine,
      metrics,
      trends,
      activityTrend,
      dateRange: {
        startDate: range.start.toISOString().slice(0, 10),
        endDate: range.end.toISOString().slice(0, 10),
      },
      unreadNotificationCount,
      primaryCampaign: primaryCampaign
        ? {
            id: primaryCampaign.id,
            name: primaryCampaign.name,
            status: primaryCampaign.status,
            channels: primaryCampaign.channels,
            prospectCount: primaryCampaign._count.leads,
            createdAt: primaryCampaign.createdAt,
            updatedAt: primaryCampaign.updatedAt,
            startedAt: primaryCampaign.createdAt,
            stats: primaryStats,
            channelSendCounts: primaryCampaignChannelSendCounts,
            video: primaryCampaignVideo,
          }
        : null,
      channels: channels.map(({ unipileId: _unipileId, ...channel }) => channel),
      attention,
      activity,
      actions,
      sendingHealth,
    });
  });

  r.patch("/dashboard/campaigns/:campaignId/video", {
    schema: {
      ...authenticatedRoute("Dashboard", "Pause or resume campaign video"),
      params: CampaignIdParamsSchema,
      body: CampaignVideoPatchSchema,
    },
  }, async (request, reply) => {
    const orgId = requireOrgId(request);
    const { campaignId } = request.params;
    const body = request.body;

    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, orgId },
      select: { id: true, aiConfig: true },
    });
    if (!campaign) throw new NotFoundError("Campaign not found");

    const aiConfig = asRecord(campaign.aiConfig) ?? {};
    const videoConfig = asRecord(aiConfig.video) ?? {};
    const nextAiConfig = {
      ...aiConfig,
      video: {
        ...videoConfig,
        paused: body.paused,
      },
    };

    await prisma.campaign.update({
      where: { id: campaign.id },
      data: { aiConfig: nextAiConfig },
    });

    return reply.send({ id: campaign.id, paused: body.paused });
  });

  r.get("/dashboard/activity", {
    schema: {
      ...authenticatedRoute("Dashboard", "List operator activity feed"),
      querystring: ActivityListQuerySchema,
    },
  }, async (request, reply) => {
    const orgId = requireOrgId(request);
    const query = request.query;
    const hasExplicitRange = Boolean(query.startDate || query.endDate);
    const range = resolveOverviewDateRange({
      startDate: query.startDate,
      endDate: query.endDate,
      activityKind: "all",
    });
    const currentDateWhere = { gte: range.start, lte: range.end };
    const previousDateWhere = { gte: range.previousStart, lte: range.previousEnd };
    const baseActivityWhere: Prisma.ActivityEventWhereInput = {
      orgId,
      ...(hasExplicitRange ? { occurredAt: currentDateWhere } : {}),
      ...(query.channel ? { channel: query.channel } : {}),
      ...(query.campaignId ? { campaignId: query.campaignId } : {}),
    };
    const activityWhere: Prisma.ActivityEventWhereInput = {
      ...baseActivityWhere,
      ...(query.kind === "all"
        ? {}
        : { eventType: { startsWith: `${query.kind === "prospect" ? "prospect" : query.kind}.` } }),
    };

    const [
      activityRows,
      activityTotal,
      totalActivities,
      previousTotalActivities,
      messagesSent,
      previousMessagesSent,
      repliesReceived,
      previousRepliesReceived,
      meetingsBooked,
      previousMeetingsBooked,
      videoMessages,
      previousVideoMessages,
      campaignOptions,
      channelRows,
    ] = await Promise.all([
      prisma.activityEvent.findMany({
        where: activityWhere,
        orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
        skip: query.offset,
        take: query.limit,
      }),
      prisma.activityEvent.count({ where: activityWhere }),
      prisma.activityEvent.count({ where: baseActivityWhere }),
      prisma.activityEvent.count({
        where: {
          orgId,
          occurredAt: previousDateWhere,
          ...(query.channel ? { channel: query.channel } : {}),
          ...(query.campaignId ? { campaignId: query.campaignId } : {}),
        },
      }),
      prisma.message.count({
        where: { orgId, direction: "outbound", createdAt: currentDateWhere },
      }),
      prisma.message.count({
        where: { orgId, direction: "outbound", createdAt: previousDateWhere },
      }),
      prisma.message.count({
        where: { orgId, direction: "inbound", createdAt: currentDateWhere },
      }),
      prisma.message.count({
        where: { orgId, direction: "inbound", createdAt: previousDateWhere },
      }),
      prisma.lead.count({
        where: { orgId, status: "meeting", updatedAt: currentDateWhere },
      }),
      prisma.lead.count({
        where: { orgId, status: "meeting", updatedAt: previousDateWhere },
      }),
      prisma.message.findMany({
        where: { orgId, direction: "outbound", createdAt: currentDateWhere },
        select: { content: true },
        take: 100,
      }),
      prisma.message.findMany({
        where: { orgId, direction: "outbound", createdAt: previousDateWhere },
        select: { content: true },
        take: 100,
      }),
      prisma.campaign.findMany({
        where: { orgId },
        orderBy: { updatedAt: "desc" },
        take: 50,
        select: { id: true, name: true },
      }),
      prisma.message.findMany({
        where: { orgId },
        distinct: ["channel"],
        select: { channel: true },
        take: 20,
      }),
    ]);

    const messageActivityRows = activityRows.filter(
      (row) => row.eventType.startsWith("message.") && row.campaignId && row.leadId,
    );
    const campaignLeads = messageActivityRows.length
      ? await prisma.campaignLead.findMany({
          where: {
            campaign: { orgId },
            OR: messageActivityRows.map((row) => ({
              campaignId: row.campaignId!,
              leadId: row.leadId!,
            })),
          },
          select: { id: true, campaignId: true, leadId: true },
        })
      : [];
    const campaignLeadByConversation = new Map(
      campaignLeads.map((campaignLead) => [conversationKey(campaignLead.campaignId, campaignLead.leadId), campaignLead.id]),
    );

    const activity = activityRows.map((row): DashboardActivity => {
      const metadata = activityMetadata(row.metadata);
      const campaignLeadId = row.campaignId && row.leadId
        ? campaignLeadByConversation.get(conversationKey(row.campaignId, row.leadId))
        : undefined;
      const isReply = row.eventType === "message.inbound" && campaignLeadId;
      return {
        id: row.id,
        kind: activityKindFromEventType(row.eventType),
        title: row.title,
        detail: row.detail,
        occurredAt: row.occurredAt,
        avatarUrl: metadataString(metadata, "avatarUrl"),
        ...(row.channel ? { channel: row.channel } : {}),
        action: isReply ? "reply" : "view",
        href: isReply
          ? `/dashboard/messages/${campaignLeadId}`
          : row.eventType.startsWith("prospect.") && row.leadId
            ? `/dashboard/prospects/${row.leadId}`
            : row.eventType.startsWith("campaign.") || row.eventType.startsWith("video.")
              ? "/dashboard/campaigns"
              : "/dashboard/activity",
      };
    });
    const videosSent = videoMessages.filter((message) => messageHasVideoAttachment(message.content)).length;
    const previousVideosSent = previousVideoMessages.filter((message) => messageHasVideoAttachment(message.content)).length;
    const summaryMetrics = {
      totalActivities,
      messagesSent,
      repliesReceived,
      meetingsBooked,
      videosSent,
    };
    const previousSummaryMetrics = {
      totalActivities: previousTotalActivities,
      messagesSent: previousMessagesSent,
      repliesReceived: previousRepliesReceived,
      meetingsBooked: previousMeetingsBooked,
      videosSent: previousVideosSent,
    };

    const trends = Object.fromEntries(
      (Object.keys(summaryMetrics) as ActivitySummaryKey[]).map((key) => [
        key,
        overviewMetricTrend(summaryMetrics[key], previousSummaryMetrics[key]),
      ]),
    ) as Record<ActivitySummaryKey, ActivitySummaryTrend>;

    return reply.send({
      activity,
      total: activityTotal,
      limit: query.limit,
      offset: query.offset,
      summary: {
        ...summaryMetrics,
        trends,
      },
      filters: {
        campaigns: campaignOptions,
        channels: channelRows.map((row) => row.channel).filter(Boolean),
      },
      range: {
        startDate: range.start.toISOString().slice(0, 10),
        endDate: range.end.toISOString().slice(0, 10),
      },
    });
  });

  r.get("/dashboard/search", {
    schema: {
      ...authenticatedRoute("Dashboard", "Search prospects and campaigns"),
      querystring: DashboardSearchQuerySchema,
    },
  }, async (request, reply) => {
    const orgId = requireOrgId(request);
    const query = request.query;
    const [prospects, campaigns] = await Promise.all([
      prisma.lead.findMany({
        where: {
          orgId,
          ...leadSearchWhere(query.query),
        },
        take: 5,
        orderBy: { updatedAt: "desc" },
        select: { id: true, firstName: true, lastName: true, company: true, avatarUrl: true },
      }),
      prisma.campaign.findMany({
        where: { orgId, name: { contains: query.query, mode: "insensitive" } },
        take: 5,
        orderBy: { updatedAt: "desc" },
        select: { id: true, name: true, status: true },
      }),
    ]);

    return reply.send({
      prospects: prospects.map((prospect) => ({
        id: prospect.id,
        name: leadName(prospect),
        company: prospect.company,
        avatarUrl: prospect.avatarUrl,
      })),
      campaigns,
    });
  });

  r.get("/dashboard/events", {
    schema: authenticatedRoute("Dashboard", "Stream live dashboard events"),
  }, async (request, reply) => {
    const orgId = requireOrgId(request);
    const subscriber = createRedisSubscriber();
    reply.hijack();
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    reply.raw.write(": connected\n\n");

    const heartbeat = setInterval(() => reply.raw.write(": keepalive\n\n"), 20_000);
    const cleanup = () => {
      clearInterval(heartbeat);
      subscriber.disconnect();
    };
    request.raw.once("close", cleanup);
    subscriber.on("message", (_channel, payload) => {
      if (!reply.raw.destroyed) reply.raw.write(`data: ${payload}\n\n`);
    });
    subscriber.on("error", (error) => request.log.warn({ error }, "dashboard event subscriber error"));
    await subscriber.subscribe(chatEventChannel(orgId));
  });

  await registerDashboardProspectRoutes(app);
  await registerDashboardConversationRoutes(app);
  await registerDashboardAnalyticsRoutes(app);
  await registerDashboardSettingsRoutes(app);
};
