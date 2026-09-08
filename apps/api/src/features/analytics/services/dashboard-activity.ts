import { z } from "zod";
import { ActivityListQuerySchema, type DashboardActivity, activityMetadata, activityKindFromEventType, metadataString, type ActivitySummaryKey, type ActivitySummaryTrend } from "../state/activity.js";
import { resolveOverviewDateRange, overviewMetricTrend } from "../public/date-range.js";
import { type Prisma } from "@prisma/client";
import { prisma } from "../../../platform/persistence/prisma.js";
import { conversationKey } from "../../messages/public/conversation-key.js";
import { messageHasVideoAttachment } from "../state/activity-content.js";

export async function getDashboardActivity(orgId: string, query: z.infer<typeof ActivityListQuerySchema>) {
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

  return ({
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
}
