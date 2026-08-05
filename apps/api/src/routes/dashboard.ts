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
import { cacheDashboardChrome, invalidateDashboardChrome, readDashboardChrome } from "../lib/dashboard-cache.js";
import { checkAndIncrementDailySendLimit, getDailySendLimitStatus } from "../lib/rate-limiter.js";
import {
  analyticsInsightsQueue,
  QUEUE_ANALYTICS_INSIGHTS,
} from "../lib/queue.js";
import { requireOrgId } from "../lib/request-org.js";
import { isOutreachChannel } from "../lib/channels.js";
import { buildPrimaryCampaignVideoSummary } from "../lib/campaign-video-summary.js";
import { readCachedAnalyticsInsights } from "../services/analytics-insights.js";
import {
  deliverOperatorMessage,
  resolveExistingOperatorDelivery,
  startOperatorLinkedInConversation,
} from "../services/operator-message-delivery.js";
import { requireOrganizationEntitlement } from "../services/entitlements.js";
import { getCampaignSenderForChannel } from "../services/campaign-channel-accounts.js";
import { runReplyDraftAgent } from "../modules/agents/reply-draft-agent.js";
import { chatEventChannel } from "../lib/chat-events.js";
import { createRedisSubscriber } from "../lib/redis.js";

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
  channel: z.enum(["linkedin", "whatsapp", "facebook", "instagram", "email"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const ConversationMessagesQuerySchema = z.object({
  cursor: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
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

export function leadSearchWhere(rawQuery: string): Prisma.LeadWhereInput {
  const terms = rawQuery.trim().split(/\s+/).filter(Boolean);
  return {
    AND: terms.map((term) => ({
      OR: [
        { firstName: { contains: term, mode: "insensitive" } },
        { lastName: { contains: term, mode: "insensitive" } },
        { company: { contains: term, mode: "insensitive" } },
        { title: { contains: term, mode: "insensitive" } },
      ],
    })),
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
    ...(query.query ? leadSearchWhere(query.query) : {}),
  };
}

function conversationKey(campaignId: string, leadId: string): string {
  return `${campaignId}:${leadId}`;
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

  r.get("/dashboard/prospects", {
    schema: {
      ...authenticatedRoute("Dashboard", "List prospects for review"),
      querystring: ProspectListQuerySchema,
    },
  }, async (request, reply) => {
    const orgId = requireOrgId(request);
    const query = request.query;
    const where = prospectListWhere(orgId, query);
    const [leads, total, allLeadsTotal, reviewCounts, bookedLeadsTotal, reachedLeads] = await Promise.all([
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
      prisma.lead.count({ where: { orgId, status: "meeting" } }),
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
        booked: bookedLeadsTotal,
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
    await invalidateDashboardChrome(orgId);
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
    await invalidateDashboardChrome(orgId);
    return reply.send({ updated: result.count, reviewStatus: body.reviewStatus });
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
        OR: [
          { providerChatId: { not: null } },
          { linkedinChatId: { not: null } },
          { emailThreadKey: { not: null } },
        ],
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
        providerChatId: true,
        emailThreadKey: true,
        status: true,
        lead: { select: { firstName: true, lastName: true, title: true, company: true, avatarUrl: true } },
        campaign: {
          select: {
            id: true,
            name: true,
            senderAccount: { select: { id: true, accountName: true, avatarUrl: true, platform: true, status: true, unipileId: true } },
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

    const conversationWhere = campaignLeads.map((item) => ({
      campaignId: item.campaignId,
      leadId: item.leadId,
    }));
    const baseMessageWhere = {
      orgId,
      OR: conversationWhere,
      ...(query.channel ? { channel: query.channel } : {}),
    };
    const [latestGroups, unreadGroups, needsReplyGroups] = await Promise.all([
      prisma.message.groupBy({
        by: ["campaignId", "leadId"],
        where: baseMessageWhere,
        _max: { createdAt: true },
      }),
      prisma.message.groupBy({
        by: ["campaignId", "leadId"],
        where: { ...baseMessageWhere, direction: "inbound", readAt: null },
        _count: { _all: true },
      }),
      prisma.message.groupBy({
        by: ["campaignId", "leadId"],
        where: { ...baseMessageWhere, direction: "inbound", handledAt: null },
        _count: { _all: true },
      }),
    ]);
    const latestMessages = latestGroups.length > 0
      ? await prisma.message.findMany({
          where: {
            orgId,
            OR: latestGroups.flatMap((group) => group._max.createdAt
              ? [{ campaignId: group.campaignId, leadId: group.leadId, createdAt: group._max.createdAt }]
              : []),
          },
          select: {
            id: true,
            campaignId: true,
            leadId: true,
            channel: true,
            direction: true,
            status: true,
            origin: true,
            content: true,
            sentAt: true,
            createdAt: true,
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        })
      : [];
    const latestByConversation = new Map<string, (typeof latestMessages)[number]>();
    for (const message of latestMessages) {
      const key = conversationKey(message.campaignId, message.leadId);
      if (!latestByConversation.has(key)) latestByConversation.set(key, message);
    }
    const unreadByConversation = new Map(
      unreadGroups.map((group) => [conversationKey(group.campaignId, group.leadId), group._count._all]),
    );
    const needsReplyConversations = new Set(
      needsReplyGroups.map((group) => conversationKey(group.campaignId, group.leadId)),
    );

    const allConversations = campaignLeads.flatMap((campaignLead) => {
      const key = conversationKey(campaignLead.campaignId, campaignLead.leadId);
      const latest = latestByConversation.get(key);
      if (!latest) return [];
      const unreadCount = unreadByConversation.get(key) ?? 0;
      const needsReply = needsReplyConversations.has(key);
      return [{
        id: campaignLead.id,
        leadId: campaignLead.leadId,
        campaignLeadStatus: campaignLead.status,
        chatId: campaignLead.providerChatId ?? campaignLead.linkedinChatId,
        channel: latest.channel,
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
        providerChatId: true,
        emailThreadKey: true,
        lead: {
          select: {
            firstName: true,
            lastName: true,
            title: true,
            company: true,
            location: true,
            linkedinUrl: true,
            email: true,
            avatarUrl: true,
            status: true,
            providerLinkedinId: true,
          },
        },
        campaign: {
          select: {
            id: true,
            name: true,
            status: true,
            senderAccount: { select: { id: true, accountName: true, avatarUrl: true, platform: true, status: true, unipileId: true } },
          },
        },
      },
    });
    if (!campaignLead) throw new NotFoundError("Conversation");

    const messagePage = await prisma.message.findMany({
      where: { orgId, campaignId: campaignLead.campaignId, leadId: campaignLead.leadId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 51,
      select: {
        id: true,
        content: true,
        channel: true,
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
    const hasOlderMessages = messagePage.length > 50;
    const recentMessages = messagePage.slice(0, 50);
    const messages = [...recentMessages].reverse();
    await prisma.message.updateMany({
      where: { orgId, campaignId: campaignLead.campaignId, leadId: campaignLead.leadId, direction: "inbound", readAt: null },
      data: { readAt: new Date() },
    });
    await invalidateDashboardChrome(orgId);

    const latestChannel = messages.at(-1)?.channel ?? "linkedin";
    const sender = isOutreachChannel(latestChannel)
      ? await getCampaignSenderForChannel({
          campaignId: campaignLead.campaignId,
          channel: latestChannel,
          legacyLinkedInAccount: campaignLead.campaign.senderAccount,
        })
      : null;
    const senderLimit = latestChannel === "linkedin" && sender?.unipileId
      ? await getDailySendLimitStatus(sender.unipileId, "message")
      : null;
    const hasInboundMessage = messages.some((message) => message.direction === "inbound");

    return reply.send({
      conversation: {
        id: campaignLead.id,
        leadId: campaignLead.leadId,
        status: campaignLead.status,
        currentStep: campaignLead.currentStep,
        chatId: campaignLead.providerChatId ?? campaignLead.linkedinChatId,
        channel: latestChannel,
        prospect: { ...campaignLead.lead, name: leadName(campaignLead.lead) },
        campaign: { id: campaignLead.campaign.id, name: campaignLead.campaign.name },
        sender,
        senderLimit,
        canReply: Boolean(
          hasInboundMessage &&
          sender?.status === "active" &&
          sender.unipileId &&
          (latestChannel === "email"
            ? campaignLead.lead.email
            : campaignLead.providerChatId ?? campaignLead.linkedinChatId),
        ),
        canStartConversation: Boolean(
          messages.length === 0 &&
          campaignLead.status === "active" &&
          campaignLead.lead.providerLinkedinId &&
          sender?.status === "active" &&
          sender.unipileId,
        ),
        messages: messages.map((message) => ({
          ...message,
          content: messageContent(message.content),
          occurredAt: message.sentAt ?? message.createdAt,
        })),
        nextCursor: hasOlderMessages ? recentMessages.at(-1)?.id ?? null : null,
      },
    });
  });

  r.get("/dashboard/conversations/:campaignLeadId/messages", {
    schema: {
      ...authenticatedRoute("Dashboard", "Page older conversation messages"),
      params: CampaignLeadIdParamsSchema,
      querystring: ConversationMessagesQuerySchema,
    },
  }, async (request, reply) => {
    const orgId = requireOrgId(request);
    const { campaignLeadId } = request.params;
    const { cursor, limit } = request.query;
    const campaignLead = await prisma.campaignLead.findFirst({
      where: { id: campaignLeadId, campaign: { orgId } },
      select: { campaignId: true, leadId: true },
    });
    if (!campaignLead) throw new NotFoundError("Conversation");

    const page = await prisma.message.findMany({
      where: { orgId, campaignId: campaignLead.campaignId, leadId: campaignLead.leadId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      take: limit + 1,
      select: {
        id: true,
        content: true,
        channel: true,
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
    const hasMore = page.length > limit;
    const selected = page.slice(0, limit);
    return reply.send({
      messages: [...selected].reverse().map((message) => ({
        ...message,
        content: messageContent(message.content),
        occurredAt: message.sentAt ?? message.createdAt,
      })),
      nextCursor: hasMore ? selected.at(-1)?.id ?? null : null,
    });
  });

  r.post("/dashboard/conversations/:campaignLeadId/start", {
    schema: {
      ...authenticatedRoute("Dashboard", "Start an operator LinkedIn conversation"),
      params: CampaignLeadIdParamsSchema,
      body: OperatorReplyBodySchema,
    },
  }, async (request, reply) => {
    const orgId = requireOrgId(request);
    const { campaignLeadId } = request.params;
    const body = request.body;
    const existingDelivery = await prisma.message.findFirst({
      where: { orgId, idempotencyKey: body.idempotencyKey },
      select: {
        id: true,
        status: true,
        manualDeliveryAttempt: { select: { state: true } },
      },
    });
    if (existingDelivery) {
      return reply.status(201).send(resolveExistingOperatorDelivery(existingDelivery));
    }

    const campaignLead = await prisma.campaignLead.findFirst({
      where: { id: campaignLeadId, campaign: { orgId } },
      select: {
        id: true,
        campaignId: true,
        leadId: true,
        status: true,
        linkedinChatId: true,
        providerChatId: true,
        lead: { select: { providerLinkedinId: true } },
        campaign: {
          select: {
            status: true,
            senderAccount: { select: { id: true, platform: true, status: true, unipileId: true } },
          },
        },
      },
    });
    if (!campaignLead) throw new NotFoundError("Conversation");
    if (campaignLead.status !== "active") {
      throw new ValidationError("This prospect needs an active campaign membership before messaging");
    }
    const priorMessage = await prisma.message.findFirst({
      where: { orgId, campaignId: campaignLead.campaignId, leadId: campaignLead.leadId },
      select: { id: true },
    });
    if (priorMessage || campaignLead.providerChatId || campaignLead.linkedinChatId) {
      throw new ValidationError("This conversation has already started");
    }
    if (!campaignLead.lead.providerLinkedinId) {
      throw new ValidationError("This prospect does not have a LinkedIn provider identifier");
    }

    const sender = await getCampaignSenderForChannel({
      campaignId: campaignLead.campaignId,
      channel: "linkedin",
      legacyLinkedInAccount: campaignLead.campaign.senderAccount,
    });
    if (!sender?.unipileId || sender.status !== "active") {
      throw new ValidationError("This campaign needs an active LinkedIn sender before messaging");
    }
    await requireOrganizationEntitlement(orgId);
    const limit = await checkAndIncrementDailySendLimit(sender.unipileId, "message");
    if (!limit.allowed) {
      const status = await getDailySendLimitStatus(sender.unipileId, "message");
      throw new DailySendLimitError(status.resetAt);
    }

    const adapter = new UnipileAdapter({ dsn: env.UNIPILE_DSN, apiKey: env.UNIPILE_API_KEY });
    const result = await startOperatorLinkedInConversation(adapter, {
      orgId,
      campaignId: campaignLead.campaignId,
      campaignLeadId: campaignLead.id,
      leadId: campaignLead.leadId,
      senderAccountId: sender.unipileId,
      recipientProviderId: campaignLead.lead.providerLinkedinId,
      message: body.message,
      idempotencyKey: body.idempotencyKey,
    });
    await invalidateDashboardChrome(orgId);
    return reply.status(201).send(result);
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
      where: { orgId, campaignId: campaignLead.campaignId, leadId: campaignLead.leadId },
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
      select: {
        id: true,
        status: true,
        manualDeliveryAttempt: { select: { state: true } },
      },
    });
    if (existingReply) {
      return reply.status(201).send(resolveExistingOperatorDelivery(existingReply));
    }
    const campaignLead = await prisma.campaignLead.findFirst({
      where: { id: campaignLeadId, campaign: { orgId } },
      select: {
        id: true,
        campaignId: true,
        leadId: true,
        linkedinChatId: true,
        providerChatId: true,
        emailThreadKey: true,
        lead: { select: { id: true, email: true, firstName: true, lastName: true } },
        campaign: {
          select: {
            senderAccount: { select: { id: true, platform: true, status: true, unipileId: true } },
          },
        },
      },
    });
    if (!campaignLead) throw new NotFoundError("Conversation");
    const latestInbound = await prisma.message.findFirst({
      where: { orgId, campaignId: campaignLead.campaignId, leadId: campaignLead.leadId, direction: "inbound" },
      orderBy: { createdAt: "desc" },
      select: { channel: true, content: true },
    });
    if (!latestInbound) {
      throw new ValidationError("A prospect reply is required before sending an operator response");
    }
    if (!isOutreachChannel(latestInbound.channel)) {
      throw new ValidationError(`Unsupported conversation channel: ${latestInbound.channel}`);
    }
    const channel = latestInbound.channel;
    const sender = await getCampaignSenderForChannel({
      campaignId: campaignLead.campaignId,
      channel,
      legacyLinkedInAccount: campaignLead.campaign.senderAccount,
    });
    if (!sender?.unipileId || sender.status !== "active") {
      throw new ValidationError(`This campaign needs an active ${channel} sender before replying`);
    }
    const chatId = campaignLead.providerChatId ?? campaignLead.linkedinChatId ?? undefined;
    if (channel !== "email" && !chatId) {
      throw new ValidationError(`This prospect does not have a ${channel} chat yet`);
    }
    if (channel === "email" && !campaignLead.lead.email) {
      throw new ValidationError("This prospect does not have an email address");
    }
    await requireOrganizationEntitlement(orgId);
    if (channel === "linkedin") {
      const limit = await checkAndIncrementDailySendLimit(sender.unipileId, "message");
      if (!limit.allowed) {
        const status = await getDailySendLimitStatus(sender.unipileId, "message");
        throw new DailySendLimitError(status.resetAt);
      }
    }

    const adapter = new UnipileAdapter({ dsn: env.UNIPILE_DSN, apiKey: env.UNIPILE_API_KEY });
    const result = await deliverOperatorMessage(adapter, {
      orgId,
      campaignId: campaignLead.campaignId,
      campaignLeadId: campaignLead.id,
      leadId: campaignLead.leadId,
      channel,
      chatId,
      senderAccountId: sender.unipileId,
      recipientEmail: campaignLead.lead.email ?? undefined,
      recipientName: leadName(campaignLead.lead),
      subject: (() => {
        if (!latestInbound.content || typeof latestInbound.content !== "object" || Array.isArray(latestInbound.content)) return undefined;
        const subject = (latestInbound.content as Record<string, unknown>).subject;
        return typeof subject === "string" && subject.trim() ? `Re: ${subject.replace(/^Re:\s*/i, "")}` : undefined;
      })(),
      message: body.message,
      idempotencyKey: body.idempotencyKey,
    });
    await invalidateDashboardChrome(orgId);
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
