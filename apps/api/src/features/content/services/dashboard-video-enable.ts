import { z } from "zod";
import { CampaignVideoEnableSchema } from "../state/dashboard-video.js";
import { prisma } from "../../../platform/persistence/prisma.js";
import { NotFoundError } from "../../../platform/http/errors.js";
import { asRecord } from "../../../platform/persistence/json.js";
import { videoGenerationQueue } from "../../../lib/queue.js";
import { publishDashboardEvent } from "../../../lib/dashboard-events.js";

export async function enableDashboardVideo(orgId: string, campaignId: string, mode: z.infer<typeof CampaignVideoEnableSchema>["mode"]) {
  const [campaign, firstCampaignLead] = await Promise.all([
    prisma.campaign.findFirst({
      where: { id: campaignId, orgId },
      select: { id: true, aiConfig: true },
    }),
    prisma.campaignLead.findFirst({
      where: { campaignId, campaign: { orgId } },
      orderBy: { createdAt: "asc" },
      select: { leadId: true },
    }),
  ]);
  if (!campaign) throw new NotFoundError("Campaign not found");
  if (!firstCampaignLead) {
    throw new NotFoundError("Add a prospect before enabling a campaign video");
  }

  const aiConfig = asRecord(campaign.aiConfig) ?? {};
  const currentVideo = asRecord(aiConfig.video) ?? {};
  const nextAiConfig = {
    ...aiConfig,
    video: {
      ...currentVideo,
      enabled: true,
      source: "generated",
      mode,
      tone: typeof currentVideo.tone === "string" ? currentVideo.tone : "professional",
      paused: false,
    },
  };

  await prisma.campaign.update({
    where: { id: campaign.id },
    data: { aiConfig: nextAiConfig },
  });
  const isPersonalized = mode === "personalized";
  await videoGenerationQueue.add(
    isPersonalized
      ? "enable-personalized-campaign-video"
      : "enable-standard-campaign-video",
    isPersonalized
      ? {
          orgId,
          campaignId,
          pipeline: "personalized",
          jobType: "template-orchestrate" as const,
        }
      : {
          orgId,
          campaignId,
          leadId: firstCampaignLead.leadId,
          pipeline: "standard",
          jobType: "orchestrate" as const,
        },
    {
      jobId: isPersonalized
        ? `personalized-campaign-video-${campaignId}`
        : `standard-campaign-video-${campaignId}`,
      attempts: 3,
    },
  );
  await publishDashboardEvent({ orgId, type: "video.updated", resources: { campaignId } });

  return ({ id: campaign.id, status: "generating" });
}
