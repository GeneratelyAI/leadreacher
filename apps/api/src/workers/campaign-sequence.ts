import { Job, Worker } from "bullmq";
import { UnipileAdapter } from "../adapters/unipile.js";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { redisSubscriber } from "../lib/redis.js";
import {
  type CampaignSequenceJob,
  campaignSequenceQueue,
  QUEUE_CAMPAIGN_SEQUENCE,
} from "../lib/queue.js";

export function startCampaignSequenceWorker(): Worker<CampaignSequenceJob> {
  const worker = new Worker<CampaignSequenceJob>(
    QUEUE_CAMPAIGN_SEQUENCE,
    async (job: Job<CampaignSequenceJob>) => {
      const { campaignLeadId, orgId, step } = job.data;

      const campaignLead = await prisma.campaignLead.findUnique({
        where: { id: campaignLeadId },
        include: { lead: true, campaign: true },
      });

      if (!campaignLead) {
        throw new Error(`CampaignLead not found: ${campaignLeadId}`);
      }

      if (
        campaignLead.status === "replied" ||
        campaignLead.status === "completed"
      ) {
        return { skipped: true, reason: campaignLead.status };
      }

      const sequence = campaignLead.campaign.sequence as Array<{
        type: string;
        message: string;
        delayHours: number;
      }>;
      const currentStep = sequence[step];

      if (!currentStep) {
        await prisma.campaignLead.update({
          where: { id: campaignLeadId },
          data: { status: "completed", currentStep: step },
        });
        return { completed: true };
      }

      const socialAccount = await prisma.socialAccount.findFirst({
        where: { orgId, platform: "linkedin", status: "active" },
      });

      if (!socialAccount?.unipileId) {
        throw new Error(`No active LinkedIn account for org: ${orgId}`);
      }

      const adapter = new UnipileAdapter({
        dsn: env.UNIPILE_DSN,
        apiKey: env.UNIPILE_API_KEY,
      });

      if (step === 0) {
        await adapter.sendConnectionInvite(
          socialAccount.unipileId,
          campaignLead.lead.providerLinkedinId ?? "",
          currentStep.message,
        );

        // After invite accepted (new_relation webhook), startChat is called separately.
        // Store providerLinkedinId as externalId on the message for webhook matching.

        await prisma.message.create({
          data: {
            campaignId: campaignLead.campaignId,
            leadId: campaignLead.leadId,
            orgId,
            channel: "linkedin",
            content: { type: "text", message: currentStep.message },
            status: "sent",
            stepIndex: step,
            sentAt: new Date(),
            externalId: campaignLead.lead.providerLinkedinId ?? undefined,
          },
        });
      } else {
        const chatId = campaignLead.linkedinChatId;
        if (!chatId) {
          throw new Error(
            `No chatId on CampaignLead ${campaignLeadId} — connection not yet accepted`,
          );
        }
        const result = await adapter.sendMessageToChat(
          chatId,
          currentStep.message,
        );

        await prisma.message.create({
          data: {
            campaignId: campaignLead.campaignId,
            leadId: campaignLead.leadId,
            orgId,
            channel: "linkedin",
            content: { type: "text", message: currentStep.message },
            status: "sent",
            stepIndex: step,
            sentAt: new Date(),
            externalId: result.message_id,
          },
        });
      }

      await prisma.campaignLead.update({
        where: { id: campaignLeadId },
        data: { currentStep: step + 1 },
      });

      const nextStep = sequence[step + 1];
      if (nextStep) {
        const delayMs = (nextStep.delayHours ?? 24) * 60 * 60 * 1000;
        await campaignSequenceQueue.add(
          QUEUE_CAMPAIGN_SEQUENCE,
          { campaignLeadId, orgId, step: step + 1 },
          { delay: delayMs },
        );
      }

      return { sent: true, step };
    },
    { connection: redisSubscriber },
  );

  worker.on("failed", (job, error) => {
    console.error(`Job ${job?.id} failed:`, error.message);
  });

  return worker;
}
