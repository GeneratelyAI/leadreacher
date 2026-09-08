import { prisma } from "../../../platform/persistence/prisma.js";
import { overviewMetricTrend, resolveOverviewDateRange } from "../public/date-range.js";
import { resolveAnalyticsChannels, type AnalyticsQuery } from "../state/analytics-query.js";
import { analyticsReplyRate, analyticsRateTrend, buildAnalyticsActivityTrend } from "../state/analytics-metrics.js";

const SENT_MESSAGE_STATUSES = ["sent", "delivered", "opened", "replied"];

export async function analyticsReport(orgId: string, query: AnalyticsQuery) {
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

  return {
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
  };
}
