import { prisma } from "../../../platform/persistence/prisma.js";
import { buildPrimaryCampaignVideoSummary } from "../../../lib/campaign-video-summary.js";

export async function getOverviewPrimaryCampaign(orgId: string, primaryCampaign: { id: string; aiConfig: unknown } | null, currentDateWhere: { gte: Date; lte: Date }) {
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

  return { primaryStats, primaryCampaignChannelSendCounts, primaryCampaignVideo };
}
