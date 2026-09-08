import { z } from "zod";
import { DashboardCampaignsQuerySchema, campaignStatusFilter, isCampaignArchived, SENT_MESSAGE_STATUSES, campaignMetricRate } from "../state/dashboard-list.js";
import { prisma } from "../../../platform/persistence/prisma.js";
import { buildPrimaryCampaignVideoSummary } from "../../../lib/campaign-video-summary.js";

export async function listDashboardCampaigns(orgId: string, query: z.infer<typeof DashboardCampaignsQuerySchema>) {
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

  return ({
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
}
