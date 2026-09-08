import { z } from "zod";
import { OverviewQuerySchema, type OverviewMetricKey, buildOverviewActivityTrend } from "../state/overview.js";
import { resolveOverviewDateRange, overviewMetricTrend, type OverviewMetricTrend } from "../public/date-range.js";
import { prisma } from "../../../platform/persistence/prisma.js";
import { resolveDashboardEngine } from "../../organizations/public/workspace-status.js";
import { conversationKey } from "../../messages/public/conversation-key.js";
import { buildDashboardActivity } from "../state/activity.js";
import { getOverviewPrimaryCampaign } from "./overview-primary-campaign.js";
import { getOverviewDeliveryHealth } from "./overview-delivery-health.js";
import { resolvePlanDisplayLabel } from "../../billing/public/pricing.js";

export async function getDashboardOverview(orgId: string, query: z.infer<typeof OverviewQuerySchema>) {
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
        readAt: null,
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

  const { primaryStats, primaryCampaignChannelSendCounts, primaryCampaignVideo } =
    await getOverviewPrimaryCampaign(orgId, primaryCampaign, currentDateWhere);

  const { actions, sendingHealth } = await getOverviewDeliveryHealth(orgId, channels);

  return ({
    organization: {
      name: organization?.name ?? "LeadReacher workspace",
      plan: resolvePlanDisplayLabel(organization?.plan),
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
}
