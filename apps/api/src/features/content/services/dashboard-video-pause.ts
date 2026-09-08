import { z } from "zod";
import { CampaignVideoPatchSchema } from "../state/dashboard-video.js";
import { prisma } from "../../../platform/persistence/prisma.js";
import { NotFoundError } from "../../../platform/http/errors.js";
import { asRecord } from "../../../platform/persistence/json.js";

export async function pauseDashboardVideo(orgId: string, campaignId: string, body: z.infer<typeof CampaignVideoPatchSchema>) {

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

  return ({ id: campaign.id, paused: body.paused });
}
