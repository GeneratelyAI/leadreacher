import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { authenticatedRoute } from "../lib/openapi.js";
import { prisma } from "../lib/prisma.js";
import { analyticsInsightsQueue, QUEUE_ANALYTICS_INSIGHTS } from "../lib/queue.js";
import { requireOrgId } from "../lib/request-org.js";
import { readCachedAnalyticsInsights } from "../services/analytics-insights.js";
import {
  overviewMetricTrend,
  resolveOverviewDateRange,
  type OverviewMetricTrend,
} from "./dashboard-support.js";

const SENT_MESSAGE_STATUSES = ["sent", "delivered", "opened", "replied"];

type ActivityMessage = {
  createdAt: Date;
  direction: string;
  leadId?: string;
};

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
  messages: ActivityMessage[],
  meetings: Array<{ updatedAt: Date }>,
  granularity: "day" | "week" = "day",
): Array<{ date: string; messagesSent: number; repliesReceived: number; meetingsBooked: number; prospectsReached: number; replyRate: number }> {
  const firstDay = new Date(`${start.toISOString().slice(0, 10)}T00:00:00.000Z`);
  const lastDay = new Date(`${end.toISOString().slice(0, 10)}T00:00:00.000Z`);
  const counts = new Map<string, {
    messagesSent: number;
    repliesReceived: number;
    meetingsBooked: number;
    prospectIds: Set<string>;
  }>();

  for (const cursor = new Date(firstDay); cursor <= lastDay; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const key = bucketKey(cursor, granularity);
    if (!counts.has(key)) counts.set(key, {
      messagesSent: 0,
      repliesReceived: 0,
      meetingsBooked: 0,
      prospectIds: new Set<string>(),
    });
  }
  for (const message of messages) {
    const key = bucketKey(message.createdAt, granularity);
    const day = counts.get(key);
    if (!day) continue;
    if (message.direction === "outbound") {
      day.messagesSent += 1;
      if (message.leadId) day.prospectIds.add(message.leadId);
    }
    if (message.direction === "inbound") day.repliesReceived += 1;
  }
  for (const meeting of meetings) {
    const day = counts.get(bucketKey(meeting.updatedAt, granularity));
    if (day) day.meetingsBooked += 1;
  }
  return [...counts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, values]) => ({
      date,
      messagesSent: values.messagesSent,
      repliesReceived: values.repliesReceived,
      meetingsBooked: values.meetingsBooked,
      prospectsReached: values.prospectIds.size,
      replyRate: values.messagesSent === 0 ? 0 : Math.round((values.repliesReceived / values.messagesSent) * 1000) / 10,
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
  return { direction: delta > 0 ? "up" : "down", percent: Math.abs(delta) };
}

const AnalyticsQuerySchema = z.object({
  startDate: z.string().date().optional(),
  endDate: z.string().date().optional(),
  campaignId: z.string().trim().min(1).optional(),
  channel: z.string().trim().max(40).optional(),
  channels: z.union([z.string(), z.array(z.string())]).optional().transform((value) => {
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

export async function registerDashboardAnalyticsRoutes(app: FastifyInstance): Promise<void> {
  const r = app.withTypeProvider<ZodTypeProvider>();
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
}
