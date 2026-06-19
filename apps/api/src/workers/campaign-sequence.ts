import { Job, Worker } from "bullmq";
import { UnipileAdapter } from "../adapters/unipile.js";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { redisSubscriber } from "../lib/redis.js";
import {
  type CampaignSequenceJob,
  campaignSequenceJobId,
  campaignSequenceQueue,
  QUEUE_CAMPAIGN_SEQUENCE,
} from "../lib/queue.js";
import {
  LEAD_STATUS_CONNECTED,
  LEAD_STATUS_CONTACTED,
} from "../lib/lead-status.js";
import { parseSequence } from "../lib/sequence.js";
import { resolveProviderId } from "../lib/provider-id.js";
import { deliverSequenceStep1ViaChat } from "../services/campaign-step1-chat.js";

function leadLinkedinIdentifier(lead: {
  providerLinkedinId: string | null;
  linkedinUrl: string | null;
}): string | null {
  if (lead.providerLinkedinId) {
    return lead.providerLinkedinId;
  }
  if (!lead.linkedinUrl) {
    return null;
  }
  const match = lead.linkedinUrl.match(/linkedin\.com\/in\/([^/?#]+)/i);
  return match?.[1] ?? null;
}

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

      const sequence = parseSequence(campaignLead.campaign.sequence);
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
        const identifier = leadLinkedinIdentifier(campaignLead.lead);
        if (!identifier) {
          console.error(
            JSON.stringify({
              event: "campaign-sequence-step0",
              path: "getProfile-failed-retrying",
              campaignLeadId,
              reason: "no linkedin identifier",
            }),
          );
          throw new Error(
            `No LinkedIn identifier for CampaignLead ${campaignLeadId}`,
          );
        }

        let networkDistance: string | undefined;
        let isRelationship: boolean | undefined;
        let profileProviderId: string | undefined;

        try {
          const profile = await adapter.getProfile(
            socialAccount.unipileId,
            identifier,
          );
          networkDistance = profile.network_distance;
          isRelationship = profile.is_relationship;
          profileProviderId = profile.provider_id;
        } catch (error) {
          console.error(
            JSON.stringify({
              event: "campaign-sequence-step0",
              path: "getProfile-failed-retrying",
              campaignLeadId,
              identifier,
              error: error instanceof Error ? error.message : String(error),
            }),
          );
          throw error;
        }

        if (networkDistance === "FIRST_DEGREE") {
          const attendeeProviderId = resolveProviderId(
            campaignLead.lead.providerLinkedinId,
            profileProviderId,
          );
          if (!attendeeProviderId) {
            throw new Error(
              `No provider id for already-connected lead on CampaignLead ${campaignLeadId}`,
            );
          }

          await prisma.lead.update({
            where: { id: campaignLead.leadId },
            data: {
              status: LEAD_STATUS_CONNECTED,
              // Persist the fetched provider_id so future webhook matching works.
              ...(campaignLead.lead.providerLinkedinId
                ? {}
                : { providerLinkedinId: attendeeProviderId }),
            },
          });

          const step1Result = await deliverSequenceStep1ViaChat({
            adapter,
            campaignLeadId,
            orgId,
            campaignId: campaignLead.campaignId,
            leadId: campaignLead.leadId,
            attendeeProviderId,
            unipileAccountId: socialAccount.unipileId,
            sequence,
            existingChatId: campaignLead.linkedinChatId,
          });

          console.log(
            JSON.stringify({
              event: "campaign-sequence-step0",
              path: "already-connected",
              campaignLeadId,
              network_distance: networkDistance,
              is_relationship: isRelationship,
              step1: step1Result,
            }),
          );

          return {
            sent: true,
            step,
            path: "already-connected",
            step1: step1Result,
          };
        }

        const inviteProviderId = resolveProviderId(
          campaignLead.lead.providerLinkedinId,
          profileProviderId,
        );
        if (!inviteProviderId) {
          throw new Error(
            `No provider_id available to send invite for CampaignLead ${campaignLeadId}`,
          );
        }

        await adapter.sendConnectionInvite(
          socialAccount.unipileId,
          inviteProviderId,
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
            externalId: inviteProviderId,
          },
        });

        await prisma.lead.update({
          where: { id: campaignLead.leadId },
          data: {
            status: LEAD_STATUS_CONTACTED,
            // Persist the fetched provider_id so the new_relation webhook can
            // match this lead after the invite is accepted.
            ...(campaignLead.lead.providerLinkedinId
              ? {}
              : { providerLinkedinId: inviteProviderId }),
          },
        });

        // Step 1 is triggered by the new_relation webhook after the invite is accepted.
        await prisma.campaignLead.update({
          where: { id: campaignLeadId },
          data: { currentStep: 1 },
        });

        console.log(
          JSON.stringify({
            event: "campaign-sequence-step0",
            path: "invite-sent",
            campaignLeadId,
            network_distance: networkDistance,
            is_relationship: isRelationship,
          }),
        );

        return { sent: true, step, path: "invite-sent" };
      }

      const chatId = campaignLead.linkedinChatId;
      if (!chatId) {
        throw new Error(
          `No chatId on CampaignLead ${campaignLeadId} — connection not yet accepted`,
        );
      }

      const result = await adapter.sendMessageToChat(chatId, currentStep.message);

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

      await prisma.campaignLead.update({
        where: { id: campaignLeadId },
        data: { currentStep: step + 1 },
      });

      const nextStep = sequence[step + 1];
      if (nextStep) {
        const delayMs = nextStep.delayHours * 60 * 60 * 1000;
        await campaignSequenceQueue.add(
          QUEUE_CAMPAIGN_SEQUENCE,
          { campaignLeadId, orgId, step: step + 1 },
          {
            delay: delayMs,
            jobId: campaignSequenceJobId(campaignLeadId, step + 1),
          },
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
