import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { UnipileAdapter } from "../adapters/unipile.js";
import { env } from "../config/env.js";
import { DailySendLimitError, NotFoundError, ValidationError } from "../lib/errors.js";
import {
  CampaignIdParamsSchema,
  CampaignLeadIdParamsSchema,
  ErrorResponseSchema,
  LeadIdParamsSchema,
  authenticatedRoute,
  errorResponses
} from "../lib/openapi.js";
import { prisma } from "../lib/prisma.js";
import { checkAndIncrementDailySendLimit, getDailySendLimitStatus } from "../lib/rate-limiter.js";
import {
  analyticsInsightsQueue,
  QUEUE_ANALYTICS_INSIGHTS,
} from "../lib/queue.js";
import { requireOrgId } from "../lib/request-org.js";
import { buildPrimaryCampaignVideoSummary } from "../lib/campaign-video-summary.js";
import { readCachedAnalyticsInsights } from "../services/analytics-insights.js";
import { deliverOperatorMessage } from "../services/operator-message-delivery.js";
import { runReplyDraftAgent } from "../modules/agents/reply-draft-agent.js";

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

const UpdateDashboardSettingsSchema = z.object({
  organizationName: z.string().trim().min(1).max(120),
});

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

type OverviewMetricTrend = {
  direction: "up" | "down" | "flat" | "new";
  percent: number | null;
};

type OverviewActivityMessage = {
  createdAt: Date;
  direction: string;
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

function bucketKey(date: Date, granularity: "day" | "week"): string {
  if (granularity === "day") return date.toISOString().slice(0, 10);
  const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const weekday = day.getUTCDay();
  const offset = weekday === 0 ? -6 : 1 - weekday;
  day.setUTCDate(day.getUTCDate() + offset);
  return day.toISOString().slice(0, 10);
}

export function buildAnalyticsActivityTrend(
  start: Date,
  end: Date,
  messages: OverviewActivityMessage[],
  meetings: Array<{ updatedAt: Date }>,
  granularity: "day" | "week" = "day",
): Array<{ date: string; messagesSent: number; repliesReceived: number; meetingsBooked: number; replyRate: number }> {
  const firstDay = new Date(`${start.toISOString().slice(0, 10)}T00:00:00.000Z`);
  const lastDay = new Date(`${end.toISOString().slice(0, 10)}T00:00:00.000Z`);
  const counts = new Map<string, { messagesSent: number; repliesReceived: number; meetingsBooked: number }>();

  for (const cursor = new Date(firstDay); cursor <= lastDay; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const key = bucketKey(cursor, granularity);
    if (!counts.has(key)) counts.set(key, { messagesSent: 0, repliesReceived: 0, meetingsBooked: 0 });
  }

  for (const message of messages) {
    const key = bucketKey(message.createdAt, granularity);
    const day = counts.get(key);
    if (!day) continue;
    if (message.direction === "outbound") day.messagesSent += 1;
    if (message.direction === "inbound") day.repliesReceived += 1;
  }

  for (const meeting of meetings) {
    const key = bucketKey(meeting.updatedAt, granularity);
    const day = counts.get(key);
    if (!day) continue;
    day.meetingsBooked += 1;
  }

  return [...counts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, values]) => ({
      date,
      ...values,
      replyRate: values.messagesSent === 0
        ? 0
        : Math.round((values.repliesReceived / values.messagesSent) * 1000) / 10,
    }));
}

function analyticsReplyRate(sent: number, replies: number): number {
  if (sent === 0) return 0;
  return Math.round((replies / sent) * 1000) / 10;
}

function analyticsRateTrend(current: number, previous: number): OverviewMetricTrend {
  const delta = Math.round((current - previous) * 10) / 10;
  if (previous === 0 && current === 0) return { direction: "flat", percent: 0 };
  if (previous === 0 && current > 0) return { direction: "new", percent: null };
  if (delta === 0) return { direction: "flat", percent: 0 };
  return {
    direction: delta > 0 ? "up" : "down",
    percent: Math.abs(delta),
  };
}

const AnalyticsQuerySchema = z.object({
  startDate: z.string().date().optional(),
  endDate: z.string().date().optional(),
  campaignId: z.string().trim().min(1).optional(),
  /** @deprecated Prefer `channels`. Kept for single-value back-compat. */
  channel: z.string().trim().max(40).optional(),
  channels: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((value) => {
      if (!value) return [] as string[];
      const parts = Array.isArray(value) ? value : value.split(",");
      return [...new Set(parts.map((part) => part.trim()).filter(Boolean))].slice(0, 20);
    }),
  granularity: z.enum(["day", "week"]).default("day"),
});

function resolveAnalyticsChannels(query: z.infer<typeof AnalyticsQuerySchema>): string[] {
  if (query.channels.length > 0) return query.channels;
  if (query.channel) return [query.channel];
  return [];
}

const ProspectListQuerySchema = z.object({
  query: z.string().trim().max(120).optional(),
  reviewStatus: z.enum(["pending", "approved", "excluded"]).optional(),
  status: z.string().trim().max(40).optional(),
  source: z.string().trim().max(40).optional(),
  campaignId: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const ReviewProspectSchema = z.object({
  reviewStatus: z.enum(["approved", "excluded"]),
});

const BulkReviewProspectsSchema = z.object({
  leadIds: z.array(z.string().min(1)).min(1).max(100),
  reviewStatus: z.enum(["approved", "excluded"]),
});

const ConversationListQuerySchema = z.object({
  query: z.string().trim().max(120).optional(),
  campaignId: z.string().trim().min(1).optional(),
  state: z.enum(["all", "unread", "needs_reply"]).default("all"),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const OperatorReplyBodySchema = z.object({
  message: z.string().trim().min(1).max(600),
  idempotencyKey: z.string().uuid(),
});

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

export function resolveOverviewDateRange(
  query: z.infer<typeof OverviewQuerySchema>,
  now = new Date(),
): { start: Date; end: Date; previousStart: Date; previousEnd: Date } {
  const defaultEnd = new Date(now);
  defaultEnd.setUTCHours(23, 59, 59, 999);
  const defaultStart = new Date(defaultEnd);
  defaultStart.setUTCDate(defaultStart.getUTCDate() - 6);
  defaultStart.setUTCHours(0, 0, 0, 0);

  const start = query.startDate ? new Date(`${query.startDate}T00:00:00.000Z`) : defaultStart;
  const end = query.endDate ? new Date(`${query.endDate}T23:59:59.999Z`) : defaultEnd;
  if (end < start) {
    throw new ValidationError("The end date must be on or after the start date");
  }

  const duration = end.getTime() - start.getTime() + 1;
  return {
    start,
    end,
    previousStart: new Date(start.getTime() - duration),
    previousEnd: new Date(start.getTime() - 1),
  };
}

export function overviewMetricTrend(current: number, previous: number): OverviewMetricTrend {
  if (previous === 0) {
    return current > 0
      ? { direction: "new", percent: null }
      : { direction: "flat", percent: 0 };
  }

  const percent = Math.round(Math.abs(((current - previous) / previous) * 100));
  if (percent === 0) return { direction: "flat", percent: 0 };
  return {
    direction: current > previous ? "up" : "down",
    percent,
  };
}

function prospectListWhere(
  orgId: string,
  query: z.infer<typeof ProspectListQuerySchema>,
): Prisma.LeadWhereInput {
  return {
    orgId,
    ...(query.reviewStatus ? { reviewStatus: query.reviewStatus } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.source ? { source: query.source } : {}),
    ...(query.campaignId ? { campaigns: { some: { campaignId: query.campaignId } } } : {}),
    ...(query.query
      ? {
          OR: [
            { firstName: { contains: query.query, mode: "insensitive" } },
            { lastName: { contains: query.query, mode: "insensitive" } },
            { company: { contains: query.query, mode: "insensitive" } },
            { title: { contains: query.query, mode: "insensitive" } },
          ],
        }
      : {}),
  };
}

function conversationKey(campaignId: string, leadId: string): string {
  return `${campaignId}:${leadId}`;
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
          select: { id: true, status: true, videoUrl: true, thumbnailUrl: true },
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

    const [primaryCampaignStats, primaryCampaignMessages, primaryCampaignVideoAssets, primaryCampaignVideoMessages] =
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
              },
            }),
            prisma.message.findMany({
              where: { campaignId: primaryCampaign.id, direction: "outbound" },
              select: { content: true },
            }),
          ])
        : [[], [], [], []];
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
          outboundContents: primaryCampaignVideoMessages.map((message) => message.content),
        })
      : null;

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
      channels,
      attention,
      activity,
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
    const sourceLimit = Math.min(250, Math.max(100, query.limit + query.offset + 50));
    const messageWhere = {
      orgId,
      ...(hasExplicitRange ? { createdAt: currentDateWhere } : {}),
      ...(query.channel ? { channel: query.channel } : {}),
      ...(query.campaignId ? { campaignId: query.campaignId } : {}),
    };
    const leadWhere = {
      orgId,
      ...(hasExplicitRange ? { createdAt: currentDateWhere } : {}),
      ...(query.campaignId ? { campaigns: { some: { campaignId: query.campaignId } } } : {}),
    };
    const videoWhere = {
      orgId,
      ...(hasExplicitRange ? { updatedAt: currentDateWhere } : {}),
      ...(query.campaignId ? { campaignId: query.campaignId } : {}),
    };
    const campaignWhere = {
      orgId,
      ...(hasExplicitRange ? { updatedAt: currentDateWhere } : {}),
      ...(query.campaignId ? { id: query.campaignId } : {}),
    };

    const [
      messages,
      leads,
      videos,
      campaigns,
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
      prisma.message.findMany({
        where: messageWhere,
        orderBy: { createdAt: "desc" },
        take: sourceLimit,
        select: {
          id: true,
          direction: true,
          channel: true,
          createdAt: true,
          leadId: true,
          campaignId: true,
          lead: { select: { id: true, firstName: true, lastName: true, company: true, avatarUrl: true } },
          campaign: { select: { id: true, name: true } },
        },
      }),
      prisma.lead.findMany({
        where: leadWhere,
        orderBy: { createdAt: "desc" },
        take: sourceLimit,
        select: { id: true, firstName: true, lastName: true, company: true, avatarUrl: true, createdAt: true },
      }),
      prisma.videoAsset.findMany({
        where: videoWhere,
        orderBy: { updatedAt: "desc" },
        take: sourceLimit,
        select: {
          id: true,
          status: true,
          needsReview: true,
          updatedAt: true,
          campaign: { select: { name: true } },
          lead: { select: { firstName: true, lastName: true, avatarUrl: true } },
        },
      }),
      prisma.campaign.findMany({
        where: campaignWhere,
        orderBy: { updatedAt: "desc" },
        take: sourceLimit,
        select: { id: true, name: true, status: true, updatedAt: true, _count: { select: { leads: true } } },
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
        take: 500,
      }),
      prisma.message.findMany({
        where: { orgId, direction: "outbound", createdAt: previousDateWhere },
        select: { content: true },
        take: 500,
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

    const campaignLeads = messages.length
      ? await prisma.campaignLead.findMany({
          where: {
            campaign: { orgId },
            OR: messages.map((message) => ({ campaignId: message.campaignId, leadId: message.leadId })),
          },
          select: { id: true, campaignId: true, leadId: true },
        })
      : [];
    const campaignLeadByConversation = new Map(
      campaignLeads.map((campaignLead) => [conversationKey(campaignLead.campaignId, campaignLead.leadId), campaignLead.id]),
    );

    const all = buildDashboardActivity({
      messages: messages.map((message) => ({
        ...message,
        campaignLeadId: campaignLeadByConversation.get(conversationKey(message.campaignId, message.leadId)),
      })),
      leads,
      videos,
      campaigns,
    }).filter((item) => {
      if (hasExplicitRange && !inDateRange(item.occurredAt, range.start, range.end)) return false;
      if (query.channel && item.kind === "message" && item.channel !== query.channel) return false;
      return true;
    });

    const filtered = query.kind === "all" ? all : all.filter((item) => item.kind === query.kind);
    const videosSent = videoMessages.filter((message) => messageHasVideoAttachment(message.content)).length;
    const previousVideosSent = previousVideoMessages.filter((message) => messageHasVideoAttachment(message.content)).length;
    const summaryMetrics = {
      totalActivities: all.length,
      messagesSent,
      repliesReceived,
      meetingsBooked,
      videosSent,
    };
    const previousSummaryMetrics = {
      totalActivities: previousMessagesSent + previousRepliesReceived + previousMeetingsBooked + previousVideosSent,
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
      activity: filtered.slice(query.offset, query.offset + query.limit),
      total: filtered.length,
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
          OR: [
            { firstName: { contains: query.query, mode: "insensitive" } },
            { lastName: { contains: query.query, mode: "insensitive" } },
            { company: { contains: query.query, mode: "insensitive" } },
          ],
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

  r.get("/dashboard/prospects", {
    schema: {
      ...authenticatedRoute("Dashboard", "List prospects for review"),
      querystring: ProspectListQuerySchema,
    },
  }, async (request, reply) => {
    const orgId = requireOrgId(request);
    const query = request.query;
    const where = prospectListWhere(orgId, query);
    const [leads, total, allLeadsTotal, reviewCounts, reachedLeads] = await Promise.all([
      prisma.lead.findMany({
        where,
        orderBy: [{ reviewStatus: "asc" }, { createdAt: "desc" }],
        take: query.limit,
        skip: query.offset,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          title: true,
          company: true,
          location: true,
          linkedinUrl: true,
          email: true,
          phone: true,
          avatarUrl: true,
          source: true,
          status: true,
          reviewStatus: true,
          reviewedAt: true,
          createdAt: true,
          updatedAt: true,
          campaigns: {
            select: {
              id: true,
              status: true,
              campaign: { select: { id: true, name: true, status: true } },
            },
            orderBy: { createdAt: "desc" },
            take: 3,
          },
          messages: {
            select: { createdAt: true },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      }),
      prisma.lead.count({ where }),
      prisma.lead.count({ where: { orgId } }),
      prisma.lead.groupBy({
        by: ["reviewStatus"],
        where: { orgId },
        _count: { _all: true },
      }),
      prisma.message.findMany({
        where: {
          orgId,
          direction: "outbound",
          status: { in: ["sent", "delivered", "opened", "replied"] },
        },
        distinct: ["leadId"],
        select: { leadId: true },
      }),
    ]);

    const counts = reviewCounts.reduce(
      (result, group) => {
        if (group.reviewStatus === "pending" || group.reviewStatus === "approved" || group.reviewStatus === "excluded") {
          result[group.reviewStatus] = group._count._all;
        }
        return result;
      },
      { pending: 0, approved: 0, excluded: 0 },
    );

    return reply.send({
      leads: leads.map((lead) => ({
        ...lead,
        lastActivityAt: lead.messages[0]?.createdAt ?? lead.updatedAt,
        campaigns: lead.campaigns.map((membership) => ({
          campaignLeadId: membership.id,
          campaignLeadStatus: membership.status,
          ...membership.campaign,
        })),
        messages: undefined,
      })),
      total,
      counts: {
        all: allLeadsTotal,
        pending: counts.pending,
        approved: counts.approved,
        excluded: counts.excluded,
        reached: reachedLeads.length,
      },
      limit: query.limit,
      offset: query.offset,
    });
  });

  r.get("/dashboard/prospects/:leadId", {
    schema: {
      ...authenticatedRoute("Dashboard", "Get prospect detail"),
      params: LeadIdParamsSchema,
    },
  }, async (request, reply) => {
    const orgId = requireOrgId(request);
    const { leadId } = request.params;
    const lead = await prisma.lead.findFirst({
      where: { id: leadId, orgId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        title: true,
        company: true,
        industry: true,
        companySize: true,
        location: true,
        linkedinUrl: true,
        email: true,
        phone: true,
        avatarUrl: true,
        source: true,
        status: true,
        reviewStatus: true,
        reviewedAt: true,
        tags: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
        campaigns: {
          select: {
            id: true,
            status: true,
            currentStep: true,
            linkedinChatId: true,
            createdAt: true,
            campaign: { select: { id: true, name: true, status: true } },
          },
          orderBy: { createdAt: "desc" },
        },
        messages: {
          select: {
            id: true,
            campaignId: true,
            direction: true,
            origin: true,
            status: true,
            content: true,
            sentAt: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 12,
        },
        videoAssets: {
          select: { id: true, status: true, videoUrl: true, thumbnailUrl: true, updatedAt: true },
          orderBy: { updatedAt: "desc" },
          take: 6,
        },
      },
    });
    if (!lead) throw new NotFoundError("Prospect");

    return reply.send({
      lead: {
        ...lead,
        messages: lead.messages.map((message) => ({
          ...message,
          content: messageContent(message.content),
          occurredAt: message.sentAt ?? message.createdAt,
        })),
      },
    });
  });

  r.patch("/dashboard/prospects/:leadId/review", {
    schema: {
      ...authenticatedRoute("Dashboard", "Update prospect review status"),
      params: LeadIdParamsSchema,
      body: ReviewProspectSchema,
    },
  }, async (request, reply) => {
    const orgId = requireOrgId(request);
    const { leadId } = request.params;
    const body = request.body;
    const existing = await prisma.lead.findFirst({ where: { id: leadId, orgId }, select: { id: true } });
    if (!existing) throw new NotFoundError("Prospect");

    const lead = await prisma.lead.update({
      where: { id: leadId },
      data: { reviewStatus: body.reviewStatus, reviewedAt: new Date() },
      select: { id: true, reviewStatus: true, reviewedAt: true },
    });
    return reply.send({ lead });
  });

  r.post("/dashboard/prospects/review", {
    schema: {
      ...authenticatedRoute("Dashboard", "Bulk update prospect review status"),
      body: BulkReviewProspectsSchema,
    },
  }, async (request, reply) => {
    const orgId = requireOrgId(request);
    const body = request.body;
    const result = await prisma.lead.updateMany({
      where: { id: { in: [...new Set(body.leadIds)] }, orgId },
      data: { reviewStatus: body.reviewStatus, reviewedAt: new Date() },
    });
    return reply.send({ updated: result.count, reviewStatus: body.reviewStatus });
  });

  r.get("/dashboard/conversations", {
    schema: {
      ...authenticatedRoute("Dashboard", "List inbox conversations"),
      querystring: ConversationListQuerySchema,
    },
  }, async (request, reply) => {
    const orgId = requireOrgId(request);
    const query = request.query;
    const campaignLeads = await prisma.campaignLead.findMany({
      where: {
        linkedinChatId: { not: null },
        campaign: {
          orgId,
          ...(query.campaignId ? { id: query.campaignId } : {}),
        },
        ...(query.query
          ? {
              OR: [
                { lead: { firstName: { contains: query.query, mode: "insensitive" } } },
                { lead: { lastName: { contains: query.query, mode: "insensitive" } } },
                { lead: { company: { contains: query.query, mode: "insensitive" } } },
                { campaign: { name: { contains: query.query, mode: "insensitive" } } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        campaignId: true,
        leadId: true,
        linkedinChatId: true,
        status: true,
        lead: { select: { firstName: true, lastName: true, title: true, company: true, avatarUrl: true } },
        campaign: {
          select: {
            id: true,
            name: true,
            senderAccount: { select: { id: true, accountName: true, platform: true, status: true, unipileId: true } },
          },
        },
      },
    });

    if (campaignLeads.length === 0) {
      return reply.send({
        conversations: [],
        counts: { all: 0, unread: 0, needsReply: 0 },
        total: 0,
        limit: query.limit,
        offset: query.offset,
      });
    }

    const messages = await prisma.message.findMany({
      where: {
        orgId,
        campaignId: { in: [...new Set(campaignLeads.map((item) => item.campaignId))] },
        leadId: { in: [...new Set(campaignLeads.map((item) => item.leadId))] },
        channel: "linkedin",
      },
      select: {
        id: true,
        campaignId: true,
        leadId: true,
        direction: true,
        status: true,
        origin: true,
        content: true,
        readAt: true,
        handledAt: true,
        sentAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const messagesByConversation = new Map<string, typeof messages>();
    for (const message of messages) {
      const key = conversationKey(message.campaignId, message.leadId);
      const current = messagesByConversation.get(key) ?? [];
      current.push(message);
      messagesByConversation.set(key, current);
    }

    const allConversations = campaignLeads.flatMap((campaignLead) => {
      const conversationMessages = messagesByConversation.get(conversationKey(campaignLead.campaignId, campaignLead.leadId)) ?? [];
      const latest = conversationMessages[0];
      if (!latest) return [];
      const unreadCount = conversationMessages.filter((message) => message.direction === "inbound" && message.readAt === null).length;
      const needsReply = conversationMessages.some((message) => message.direction === "inbound" && message.handledAt === null);
      return [{
        id: campaignLead.id,
        leadId: campaignLead.leadId,
        campaignLeadStatus: campaignLead.status,
        chatId: campaignLead.linkedinChatId,
        prospect: {
          name: leadName(campaignLead.lead),
          title: campaignLead.lead.title,
          company: campaignLead.lead.company,
          avatarUrl: campaignLead.lead.avatarUrl,
        },
        campaign: { id: campaignLead.campaign.id, name: campaignLead.campaign.name },
        sender: campaignLead.campaign.senderAccount,
        latestMessage: {
          id: latest.id,
          content: messageContent(latest.content).message,
          direction: latest.direction,
          origin: latest.origin,
          occurredAt: latest.sentAt ?? latest.createdAt,
        },
        unreadCount,
        needsReply,
      }];
    }).sort((left, right) => new Date(right.latestMessage.occurredAt).getTime() - new Date(left.latestMessage.occurredAt).getTime());

    const counts = {
      all: allConversations.length,
      unread: allConversations.filter((conversation) => conversation.unreadCount > 0).length,
      needsReply: allConversations.filter((conversation) => conversation.needsReply).length,
    };

    const conversations = allConversations.filter((conversation) => {
      if (query.state === "unread") return conversation.unreadCount > 0;
      if (query.state === "needs_reply") return conversation.needsReply;
      return true;
    });

    return reply.send({
      conversations: conversations.slice(query.offset, query.offset + query.limit),
      counts,
      total: conversations.length,
      limit: query.limit,
      offset: query.offset,
    });
  });

  r.get("/dashboard/conversations/:campaignLeadId", {
    schema: {
      ...authenticatedRoute("Dashboard", "Get conversation thread"),
      params: CampaignLeadIdParamsSchema,
    },
  }, async (request, reply) => {
    const orgId = requireOrgId(request);
    const { campaignLeadId } = request.params;
    const campaignLead = await prisma.campaignLead.findFirst({
      where: { id: campaignLeadId, campaign: { orgId } },
      select: {
        id: true,
        campaignId: true,
        leadId: true,
        status: true,
        currentStep: true,
        linkedinChatId: true,
        lead: {
          select: {
            firstName: true,
            lastName: true,
            title: true,
            company: true,
            location: true,
            linkedinUrl: true,
            avatarUrl: true,
            status: true,
          },
        },
        campaign: {
          select: {
            id: true,
            name: true,
            senderAccount: { select: { id: true, accountName: true, platform: true, status: true, unipileId: true } },
          },
        },
      },
    });
    if (!campaignLead) throw new NotFoundError("Conversation");

    const messages = await prisma.message.findMany({
      where: { orgId, campaignId: campaignLead.campaignId, leadId: campaignLead.leadId, channel: "linkedin" },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        content: true,
        direction: true,
        origin: true,
        status: true,
        readAt: true,
        handledAt: true,
        sentAt: true,
        createdAt: true,
        manualDeliveryAttempt: { select: { state: true } },
      },
    });
    await prisma.message.updateMany({
      where: { orgId, campaignId: campaignLead.campaignId, leadId: campaignLead.leadId, direction: "inbound", readAt: null },
      data: { readAt: new Date() },
    });

    const sender = campaignLead.campaign.senderAccount;
    const senderLimit = sender?.unipileId
      ? await getDailySendLimitStatus(sender.unipileId, "message")
      : null;
    const hasInboundMessage = messages.some((message) => message.direction === "inbound");

    return reply.send({
      conversation: {
        id: campaignLead.id,
        leadId: campaignLead.leadId,
        status: campaignLead.status,
        currentStep: campaignLead.currentStep,
        chatId: campaignLead.linkedinChatId,
        prospect: { ...campaignLead.lead, name: leadName(campaignLead.lead) },
        campaign: { id: campaignLead.campaign.id, name: campaignLead.campaign.name },
        sender,
        senderLimit,
        canReply: Boolean(hasInboundMessage && campaignLead.linkedinChatId && sender?.status === "active" && sender.unipileId),
        messages: messages.map((message) => ({
          ...message,
          content: messageContent(message.content),
          occurredAt: message.sentAt ?? message.createdAt,
        })),
      },
    });
  });

  r.post("/dashboard/conversations/:campaignLeadId/drafts", {
    schema: {
      ...authenticatedRoute("Dashboard", "Generate AI reply draft"),
      params: CampaignLeadIdParamsSchema,
    },
  }, async (request, reply) => {
    const orgId = requireOrgId(request);
    const { campaignLeadId } = request.params;
    const campaignLead = await prisma.campaignLead.findFirst({
      where: { id: campaignLeadId, campaign: { orgId } },
      select: {
        campaignId: true,
        leadId: true,
        lead: { select: { firstName: true, lastName: true, company: true } },
        campaign: { select: { name: true } },
      },
    });
    if (!campaignLead) throw new NotFoundError("Conversation");
    const messages = await prisma.message.findMany({
      where: { orgId, campaignId: campaignLead.campaignId, leadId: campaignLead.leadId, channel: "linkedin" },
      orderBy: { createdAt: "asc" },
      select: { direction: true, content: true },
    });
    if (!messages.some((message) => message.direction === "inbound")) {
      throw new ValidationError("A prospect reply is required before drafting a response");
    }

    const result = await runReplyDraftAgent({
      orgId,
      campaignName: campaignLead.campaign.name,
      prospectName: leadName(campaignLead.lead),
      company: campaignLead.lead.company || "the prospect's company",
      conversation: messages.map((message) => ({ direction: message.direction === "inbound" ? "inbound" : "outbound", content: jsonText(message.content) || "Message content unavailable" })),
    });
    return reply.send(result);
  });

  r.post("/dashboard/conversations/:campaignLeadId/replies", {
    schema: {
      ...authenticatedRoute("Dashboard", "Send operator reply"),
      params: CampaignLeadIdParamsSchema,
      body: OperatorReplyBodySchema,
    },
  }, async (request, reply) => {
    const orgId = requireOrgId(request);
    const { campaignLeadId } = request.params;
    const body = request.body;
    const existingReply = await prisma.message.findFirst({
      where: { orgId, idempotencyKey: body.idempotencyKey },
      select: { id: true },
    });
    if (existingReply) {
      return reply.status(201).send({ messageId: existingReply.id });
    }
    const campaignLead = await prisma.campaignLead.findFirst({
      where: { id: campaignLeadId, campaign: { orgId } },
      select: {
        id: true,
        campaignId: true,
        leadId: true,
        linkedinChatId: true,
        lead: { select: { id: true } },
        campaign: {
          select: {
            senderAccount: { select: { id: true, status: true, unipileId: true } },
          },
        },
      },
    });
    if (!campaignLead) throw new NotFoundError("Conversation");
    if (!campaignLead.linkedinChatId) throw new ValidationError("This prospect does not have a LinkedIn chat yet");
    const sender = campaignLead.campaign.senderAccount;
    if (!sender || sender.status !== "active" || !sender.unipileId) {
      throw new ValidationError("This campaign needs an active LinkedIn sender before replying");
    }
    const hasInboundMessage = await prisma.message.count({
      where: { orgId, campaignId: campaignLead.campaignId, leadId: campaignLead.leadId, direction: "inbound" },
    });
    if (hasInboundMessage === 0) {
      throw new ValidationError("A prospect reply is required before sending an operator response");
    }
    const limit = await checkAndIncrementDailySendLimit(sender.unipileId, "message");
    if (!limit.allowed) {
      const status = await getDailySendLimitStatus(sender.unipileId, "message");
      throw new DailySendLimitError(status.resetAt);
    }

    const adapter = new UnipileAdapter({ dsn: env.UNIPILE_DSN, apiKey: env.UNIPILE_API_KEY });
    const result = await deliverOperatorMessage(adapter, {
      orgId,
      campaignId: campaignLead.campaignId,
      campaignLeadId: campaignLead.id,
      leadId: campaignLead.leadId,
      chatId: campaignLead.linkedinChatId,
      message: body.message,
      idempotencyKey: body.idempotencyKey,
    });
    return reply.status(201).send(result);
  });

  r.get("/dashboard/messages", {
    schema: {
      ...authenticatedRoute("Dashboard", "List recent messages"),
    },
  }, async (request, reply) => {
    const orgId = requireOrgId(request);
    const messages = await prisma.message.findMany({
      where: { orgId },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        channel: true,
        content: true,
        direction: true,
        status: true,
        stepIndex: true,
        sentAt: true,
        createdAt: true,
        lead: { select: { firstName: true, lastName: true, company: true } },
        campaign: { select: { id: true, name: true } },
      },
    });

    return reply.send({
      messages: messages.map((message) => ({
        id: message.id,
        channel: message.channel,
        content: jsonText(message.content) || "Message content unavailable",
        direction: message.direction,
        status: message.status,
        stepIndex: message.stepIndex,
        occurredAt: message.sentAt ?? message.createdAt,
        lead: {
          name: leadName(message.lead),
          company: message.lead.company,
        },
        campaign: message.campaign,
      })),
    });
  });

  r.get("/dashboard/analytics", {
    schema: {
      ...authenticatedRoute("Dashboard", "Analytics totals and breakdowns"),
      querystring: AnalyticsQuerySchema,
    },
  }, async (request, reply) => {
    const orgId = requireOrgId(request);
    const query = request.query;
    const range = resolveOverviewDateRange({
      startDate: query.startDate,
      endDate: query.endDate,
      activityKind: "all",
    });
    const currentDateWhere = { gte: range.start, lte: range.end };
    const previousDateWhere = { gte: range.previousStart, lte: range.previousEnd };
    const selectedChannels = resolveAnalyticsChannels(query);
    const messageFilter = {
      orgId,
      ...(query.campaignId ? { campaignId: query.campaignId } : {}),
      ...(selectedChannels.length === 1
        ? { channel: selectedChannels[0] }
        : selectedChannels.length > 1
          ? { channel: { in: selectedChannels } }
          : {}),
    };
    const meetingLeadFilter = {
      orgId,
      status: "meeting",
      ...(query.campaignId ? { campaigns: { some: { campaignId: query.campaignId } } } : {}),
    };

    const [
      messages,
      previousMessages,
      meetingLeads,
      previousMeetingLeads,
      campaigns,
      campaignOptions,
      channelRows,
    ] = await Promise.all([
      prisma.message.findMany({
        where: { ...messageFilter, createdAt: currentDateWhere },
        select: {
          direction: true,
          status: true,
          channel: true,
          createdAt: true,
          campaignId: true,
          leadId: true,
        },
      }),
      prisma.message.findMany({
        where: { ...messageFilter, createdAt: previousDateWhere },
        select: {
          direction: true,
          status: true,
          channel: true,
          createdAt: true,
          campaignId: true,
          leadId: true,
        },
      }),
      prisma.lead.findMany({
        where: { ...meetingLeadFilter, updatedAt: currentDateWhere },
        select: { id: true, status: true, updatedAt: true },
      }),
      prisma.lead.findMany({
        where: { ...meetingLeadFilter, updatedAt: previousDateWhere },
        select: { id: true, status: true, updatedAt: true },
      }),
      prisma.campaign.findMany({
        where: {
          orgId,
          ...(query.campaignId ? { id: query.campaignId } : {}),
        },
        select: {
          id: true,
          name: true,
          status: true,
          _count: { select: { leads: true } },
          leads: {
            where: { lead: { status: "meeting", updatedAt: currentDateWhere } },
            select: { leadId: true },
          },
        },
        orderBy: { updatedAt: "desc" },
        take: 50,
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

    const outbound = messages.filter((message) => message.direction === "outbound");
    const inbound = messages.filter((message) => message.direction === "inbound");
    const previousOutbound = previousMessages.filter((message) => message.direction === "outbound");
    const previousInbound = previousMessages.filter((message) => message.direction === "inbound");
    const delivered = outbound.filter((message) => SENT_MESSAGE_STATUSES.includes(message.status)).length;

    const messagesSent = outbound.length;
    const repliesReceived = inbound.length;
    const meetingsBooked = meetingLeads.length;
    const prospectsReached = new Set(outbound.map((message) => message.leadId)).size;
    const replyRate = analyticsReplyRate(messagesSent, repliesReceived);

    const previousMessagesSent = previousOutbound.length;
    const previousRepliesReceived = previousInbound.length;
    const previousMeetingsBooked = previousMeetingLeads.length;
    const previousProspectsReached = new Set(previousOutbound.map((message) => message.leadId)).size;
    const previousReplyRate = analyticsReplyRate(previousMessagesSent, previousRepliesReceived);

    const activityTrend = buildAnalyticsActivityTrend(
      range.start,
      range.end,
      messages,
      meetingLeads,
      query.granularity,
    );

    const meetingLeadIds = new Set(meetingLeads.map((lead) => lead.id));
    const channelCounts = new Map<string, {
      messagesSent: number;
      replies: number;
      meetingLeadIds: Set<string>;
    }>();
    for (const message of messages) {
      const current = channelCounts.get(message.channel) ?? {
        messagesSent: 0,
        replies: 0,
        meetingLeadIds: new Set<string>(),
      };
      if (message.direction === "outbound") {
        current.messagesSent += 1;
        if (meetingLeadIds.has(message.leadId)) current.meetingLeadIds.add(message.leadId);
      } else {
        current.replies += 1;
      }
      channelCounts.set(message.channel, current);
    }

    const channelRowsEnriched = [...channelCounts.entries()]
      .map(([channel, counts]) => ({
        channel,
        messagesSent: counts.messagesSent,
        replies: counts.replies,
        replyRate: analyticsReplyRate(counts.messagesSent, counts.replies),
        meetingsBooked: counts.meetingLeadIds.size,
        // Back-compat fields used by older clients
        sent: counts.messagesSent,
        received: counts.replies,
      }))
      .sort((left, right) => right.messagesSent - left.messagesSent);

    const campaignMetrics = campaigns.map((campaign) => {
      const campaignMessages = messages.filter((message) => message.campaignId === campaign.id);
      const sent = campaignMessages.filter((message) => message.direction === "outbound").length;
      const replies = campaignMessages.filter((message) => message.direction === "inbound").length;
      return {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        prospectCount: campaign._count.leads,
        messagesSent: sent,
        replies,
        replyRate: analyticsReplyRate(sent, replies),
        meetingsBooked: campaign.leads.length,
      };
    })
      .sort((left, right) => right.messagesSent - left.messagesSent)
      .slice(0, 8);

    return reply.send({
      totals: {
        sent: messagesSent,
        received: repliesReceived,
        delivered,
        replies: repliesReceived,
        meetings: meetingsBooked,
      },
      summary: {
        messagesSent,
        repliesReceived,
        replyRate,
        meetingsBooked,
        prospectsReached,
        trends: {
          messagesSent: overviewMetricTrend(messagesSent, previousMessagesSent),
          repliesReceived: overviewMetricTrend(repliesReceived, previousRepliesReceived),
          replyRate: analyticsRateTrend(replyRate, previousReplyRate),
          meetingsBooked: overviewMetricTrend(meetingsBooked, previousMeetingsBooked),
          prospectsReached: overviewMetricTrend(prospectsReached, previousProspectsReached),
        },
      },
      activityTrend,
      replyRateTrend: activityTrend.map((point) => ({
        date: point.date,
        replyRate: point.replyRate,
      })),
      channels: channelRowsEnriched,
      campaigns: campaignMetrics,
      filters: {
        campaigns: campaignOptions,
        channels: channelRows.map((row) => row.channel).filter(Boolean),
      },
      range: {
        startDate: range.start.toISOString().slice(0, 10),
        endDate: range.end.toISOString().slice(0, 10),
      },
      granularity: query.granularity,
    });
  });

  r.get("/dashboard/analytics/insights", {
    schema: {
      ...authenticatedRoute("Dashboard", "Analytics insights (cached or queued)"),
    },
  }, async (request, reply) => {
    const orgId = requireOrgId(request);
    const cached = await readCachedAnalyticsInsights(orgId);
    if (cached) {
      return reply.send(cached);
    }

    const sentCount = await prisma.message.count({
      where: {
        orgId,
        direction: "outbound",
        status: { in: ["sent", "delivered", "opened", "replied"] },
      },
    });
    if (sentCount === 0) {
      return reply.send({
        status: "no_data",
        whatsWorking: [],
        whatsNotWorking: [],
        whatToDoNext: [],
      });
    }

    await analyticsInsightsQueue.add(
      QUEUE_ANALYTICS_INSIGHTS,
      { orgId },
      {
        jobId: `analytics-insights-${orgId}`,
        removeOnComplete: true,
        removeOnFail: 100,
      },
    );
    return reply.send({
      status: "aggregating",
      whatsWorking: [],
      whatsNotWorking: [],
      whatToDoNext: [],
    });
  });

  r.get("/dashboard/settings", {
    schema: {
      ...authenticatedRoute("Dashboard", "Get organization settings"),
    },
  }, async (request, reply) => {
    const orgId = requireOrgId(request);
    const [organization, members] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: orgId },
        select: {
          id: true,
          name: true,
          plan: true,
          subscriptionStatus: true,
          currentPeriodEnd: true,
          stripeCustomerId: true,
        },
      }),
      prisma.user.findMany({
        where: { orgId },
        orderBy: [{ role: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
        },
      }),
    ]);

    return reply.send({
      organization: organization
        ? {
            id: organization.id,
            name: organization.name,
            plan: organization.plan,
            subscriptionStatus: organization.subscriptionStatus,
            currentPeriodEnd: organization.currentPeriodEnd,
            hasBillingPortal: Boolean(organization.stripeCustomerId),
          }
        : null,
      members: members.map((member) => ({
        id: member.id,
        name: member.name,
        email: member.email,
        role: member.role,
        createdAt: member.createdAt,
      })),
    });
  });

  r.patch("/dashboard/settings", {
    schema: {
      ...authenticatedRoute("Dashboard", "Update organization settings"),
      body: UpdateDashboardSettingsSchema,
    },
  }, async (request, reply) => {
    const orgId = requireOrgId(request);
    const { organizationName } = request.body;
    const [organization, members] = await Promise.all([
      prisma.organization.update({
        where: { id: orgId },
        data: { name: organizationName },
        select: { id: true, name: true, plan: true, subscriptionStatus: true, currentPeriodEnd: true, stripeCustomerId: true },
      }),
      prisma.user.findMany({
        where: { orgId },
        orderBy: [{ role: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
        },
      }),
    ]);

    return reply.send({
      organization: {
        id: organization.id,
        name: organization.name,
        plan: organization.plan,
        subscriptionStatus: organization.subscriptionStatus,
        currentPeriodEnd: organization.currentPeriodEnd,
        hasBillingPortal: Boolean(organization.stripeCustomerId),
      },
      members: members.map((member) => ({
        id: member.id,
        name: member.name,
        email: member.email,
        role: member.role,
        createdAt: member.createdAt,
      })),
    });
  });
};
