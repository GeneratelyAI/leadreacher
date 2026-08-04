import { DelayedError, Job, Worker } from "bullmq";
import { UnipileAdapter } from "../adapters/unipile.js";
import { env, getBullMqIdleDrainDelaySeconds } from "../config/env.js";
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
import { channelForStepType } from "../lib/channels.js";
import { parseSequence } from "../lib/sequence.js";
import { resolveProviderId } from "../lib/provider-id.js";
import { leadLinkedinIdentifier } from "../lib/linkedin-identifier.js";
import {
  checkAndIncrementDailySendLimit,
  millisecondsUntilNextUtcDay,
  utcDay,
} from "../lib/rate-limiter.js";
import { deliverSequenceStep1ViaChat } from "../services/campaign-step1-chat.js";
import {
  getOrganizationEntitlement,
  synchronizeBillingSuspension,
} from "../services/entitlements.js";
import { getCampaignSenderForChannel } from "../services/campaign-channel-accounts.js";
import {
  deliverEmailChannelStep,
  deliverMessagingChannelStep,
} from "../services/deliver-channel-step.js";
import {
  acquireDeliveryReservation,
  markDeliveryReservationUnknown,
} from "../services/delivery-attempt.js";
import { ensurePersonalizedVideoReady } from "../services/personalized-video.js";

const PERSONALIZED_VIDEO_WAIT_MS = 30_000;

async function rescheduleAfterDailyLimit(
  job: Job<CampaignSequenceJob>,
  reason: string,
): Promise<{ skipped: true; reason: string }> {
  const delay = millisecondsUntilNextUtcDay();
  const retryDate = utcDay(new Date(Date.now() + delay));
  await campaignSequenceQueue.add(
    QUEUE_CAMPAIGN_SEQUENCE,
    job.data,
    {
      delay,
      jobId: `${campaignSequenceJobId(job.data.campaignLeadId, job.data.step)}-daily-limit-${retryDate}`,
    },
  );
  return { skipped: true, reason };
}

export function startCampaignSequenceWorker(): Worker<CampaignSequenceJob> {
  const worker = new Worker<CampaignSequenceJob>(
    QUEUE_CAMPAIGN_SEQUENCE,
    async (job: Job<CampaignSequenceJob>) => {
      const { campaignLeadId, orgId, step } = job.data;

      const campaignLead = await prisma.campaignLead.findUnique({
        where: { id: campaignLeadId },
        include: { lead: true, campaign: { include: { senderAccount: true } } },
      });

      if (!campaignLead) {
        throw new Error(`CampaignLead not found: ${campaignLeadId}`);
      }

      const entitlement = await getOrganizationEntitlement(orgId);
      if (!entitlement.entitled) {
        await synchronizeBillingSuspension(orgId);
        return { skipped: true, reason: "subscription required" };
      }

      if (campaignLead.campaign.status !== "active") {
        return {
          skipped: true,
          reason: `campaign is ${campaignLead.campaign.status}`,
        };
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

      const channel = channelForStepType(currentStep.type);
      if (!channel) {
        throw new Error(
          `Unsupported sequence step type "${currentStep.type}" on CampaignLead ${campaignLeadId}`,
        );
      }

      if (step === 0 && channel === "linkedin") {
        const personalizedVideo = await ensurePersonalizedVideoReady({
          orgId,
          campaignId: campaignLead.campaignId,
          leadId: campaignLead.leadId,
        });
        if (personalizedVideo.state === "pending") {
          await job.moveToDelayed(
            Date.now() + PERSONALIZED_VIDEO_WAIT_MS,
            job.token,
          );
          throw new DelayedError();
        }
        if (personalizedVideo.state === "failed") {
          throw new Error(`Personalized video is unavailable: ${personalizedVideo.reason}`);
        }
      }

      const socialAccount = await getCampaignSenderForChannel({
        campaignId: campaignLead.campaignId,
        channel,
        legacyLinkedInAccount: campaignLead.campaign.senderAccount,
      });

      if (!socialAccount?.unipileId || socialAccount.status !== "active") {
        throw new Error(
          `Campaign ${campaignLead.campaignId} has no active ${channel} sender`,
        );
      }

      const adapter = new UnipileAdapter({
        dsn: env.UNIPILE_DSN,
        apiKey: env.UNIPILE_API_KEY,
      });

      const existingChatId =
        campaignLead.providerChatId ?? campaignLead.linkedinChatId ?? null;

      if (channel === "whatsapp" || channel === "facebook" || channel === "instagram") {
        return deliverMessagingChannelStep({
          adapter,
          channel,
          campaignLeadId,
          orgId,
          campaignId: campaignLead.campaignId,
          leadId: campaignLead.leadId,
          lead: campaignLead.lead,
          step,
          sequence,
          currentStep,
          sender: socialAccount,
          existingChatId,
        });
      }

      if (channel === "email") {
        return deliverEmailChannelStep({
          adapter,
          campaignLeadId,
          orgId,
          campaignId: campaignLead.campaignId,
          leadId: campaignLead.leadId,
          lead: campaignLead.lead,
          step,
          sequence,
          currentStep,
          sender: socialAccount,
        });
      }

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
            existingChatId,
          });

          if (
            "skipped" in step1Result &&
            step1Result.reason === "daily send limit reached for this sender"
          ) {
            return { skipped: true, reason: step1Result.reason };
          }

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

        const inviteLimit = await checkAndIncrementDailySendLimit(
          socialAccount.unipileId,
          "invite",
        );
        if (!inviteLimit.allowed) {
          return rescheduleAfterDailyLimit(
            job,
            "daily send limit reached for this sender",
          );
        }

        const reservation = await acquireDeliveryReservation(campaignLeadId, step);
        if (!reservation.acquired) {
          return {
            skipped: true,
            reason: `delivery reservation already ${reservation.state}`,
          };
        }

        try {
          await adapter.sendConnectionInvite(
            socialAccount.unipileId,
            inviteProviderId,
            currentStep.message,
          );

          await prisma.$transaction([
            prisma.message.create({
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
            }),
            prisma.lead.update({
              where: { id: campaignLead.leadId },
              data: {
                status: LEAD_STATUS_CONTACTED,
                ...(campaignLead.lead.providerLinkedinId
                  ? {}
                  : { providerLinkedinId: inviteProviderId }),
              },
            }),
            // Step 1 is triggered by new_relation after the invite is accepted.
            prisma.campaignLead.update({
              where: { id: campaignLeadId },
              data: { currentStep: 1 },
            }),
            prisma.deliveryAttempt.update({
              where: { id: reservation.attemptId },
              data: {
                state: "sent",
                providerRef: inviteProviderId,
                sentAt: new Date(),
              },
            }),
          ]);
        } catch (error) {
          // Unipile does not return an invitation operation ID. Retain the
          // recipient provider ID for audit correlation, but never treat it as
          // provider-positive delivery confirmation.
          await markDeliveryReservationUnknown(
            reservation.attemptId,
            inviteProviderId,
          );
          throw error;
        }

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

      const chatId = existingChatId;
      if (!chatId) {
        throw new Error(
          `No chatId on CampaignLead ${campaignLeadId} — connection not yet accepted`,
        );
      }

      const messageLimit = await checkAndIncrementDailySendLimit(
        socialAccount.unipileId,
        "message",
      );
      if (!messageLimit.allowed) {
        return rescheduleAfterDailyLimit(
          job,
          "daily send limit reached for this sender",
        );
      }

      const reservation = await acquireDeliveryReservation(campaignLeadId, step);
      if (!reservation.acquired) {
        return {
          skipped: true,
          reason: `delivery reservation already ${reservation.state}`,
        };
      }

      let providerRef: string | undefined;
      try {
        const result = await adapter.sendMessageToChat(chatId, currentStep.message);
        providerRef = result.message_id;
        await prisma.$transaction([
          prisma.message.create({
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
          }),
          prisma.campaignLead.update({
            where: { id: campaignLeadId },
            data: { currentStep: step + 1 },
          }),
          prisma.deliveryAttempt.update({
            where: { id: reservation.attemptId },
            data: {
              state: "sent",
              providerRef: result.message_id,
              sentAt: new Date(),
            },
          }),
        ]);
      } catch (error) {
        await markDeliveryReservationUnknown(reservation.attemptId, providerRef);
        throw error;
      }

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
    {
      connection: redisSubscriber,
      drainDelay: getBullMqIdleDrainDelaySeconds(),
    },
  );

  worker.on("failed", (job, error) => {
    console.error(`Job ${job?.id} failed:`, error.message);
  });

  return worker;
}
