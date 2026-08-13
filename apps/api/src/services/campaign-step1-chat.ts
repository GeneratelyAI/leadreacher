import type { UnipileAdapter } from "../adapters/unipile.js";
import { prisma } from "../lib/prisma.js";
import {
  campaignSequenceJobId,
  campaignSequenceQueue,
  QUEUE_CAMPAIGN_SEQUENCE,
} from "../lib/queue.js";
import type { SequenceStep } from "../lib/sequence.js";
import {
  acquireDeliveryReservation,
  markDeliveryReservationUnknown,
} from "./delivery-attempt.js";
import { getReadyCampaignVideoForDelivery } from "./campaign-video.js";
import {
  checkAndIncrementDailySendLimit,
  millisecondsUntilNextUtcDay,
  utcDay,
} from "../lib/rate-limiter.js";
import { requireOrganizationEntitlement } from "./entitlements.js";
import { personalizeSequenceStep } from "./personalize-sequence-step.js";
import { publishDashboardEvent } from "../lib/dashboard-events.js";

type DeliverStep1Params = {
  adapter: UnipileAdapter;
  campaignLeadId: string;
  orgId: string;
  campaignId: string;
  leadId: string;
  attendeeProviderId: string;
  unipileAccountId: string;
  sequence: SequenceStep[];
  existingChatId: string | null;
};

export async function deliverSequenceStep1ViaChat(
  params: DeliverStep1Params,
): Promise<{ delivered: true; chatId: string } | { skipped: true; reason: string }> {
  const {
    adapter,
    campaignLeadId,
    orgId,
    campaignId,
    leadId,
    attendeeProviderId,
    unipileAccountId,
    sequence,
    existingChatId,
  } = params;

  if (existingChatId) {
    return { skipped: true, reason: "linkedinChatId already set" };
  }

  await requireOrganizationEntitlement(orgId);

  const step1 = sequence[1];
  if (!step1) {
    return { skipped: true, reason: "no sequence step 1" };
  }

  const [campaign, lead] = await Promise.all([
    prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { id: true, name: true, aiConfig: true },
    }),
    prisma.lead.findUnique({
      where: { id: leadId },
      select: {
        firstName: true,
        lastName: true,
        title: true,
        company: true,
        industry: true,
        companySize: true,
        location: true,
        enrichmentData: true,
      },
    }),
  ]);
  if (!campaign || !lead) {
    throw new Error("Campaign or lead is unavailable for sequence personalization");
  }
  const preparedStep = await personalizeSequenceStep({
    orgId,
    channel: "linkedin",
    campaign,
    lead,
    step: 1,
    sequenceStep: step1,
  });

  const campaignVideo = await getReadyCampaignVideoForDelivery({
    campaignId,
    leadId,
  });
  const messageText = preparedStep.message;
  const personalization = preparedStep.personalization
    ? { personalization: preparedStep.personalization.tags }
    : {};

  const messageLimit = await checkAndIncrementDailySendLimit(
    unipileAccountId,
    "message",
  );
  if (!messageLimit.allowed) {
    const delay = millisecondsUntilNextUtcDay();
    await campaignSequenceQueue.add(
      QUEUE_CAMPAIGN_SEQUENCE,
      { campaignLeadId, orgId, step: 0 },
      {
        delay,
        jobId: `${campaignSequenceJobId(campaignLeadId, 0)}-daily-limit-${utcDay(new Date(Date.now() + delay))}`,
      },
    );
    return { skipped: true, reason: "daily send limit reached for this sender" };
  }

  const reservation = await acquireDeliveryReservation(campaignLeadId, 1);
  if (!reservation.acquired) {
    return {
      skipped: true,
      reason: `delivery reservation already ${reservation.state}`,
    };
  }

  let chat: { chat_id: string };
  try {
    chat = await adapter.startChat(
      unipileAccountId,
      attendeeProviderId,
      messageText,
      campaignVideo
        ? {
            videoMessage: {
              buffer: campaignVideo.buffer,
              filename: campaignVideo.filename,
              contentType: campaignVideo.contentType,
            },
          }
        : undefined,
    );
  } catch (error) {
    await markDeliveryReservationUnknown(reservation.attemptId);
    throw error;
  }

  try {
    await prisma.$transaction([
      prisma.campaignLead.update({
        where: { id: campaignLeadId },
        data: {
          linkedinChatId: chat.chat_id,
          providerChatId: chat.chat_id,
          currentStep: 2,
        },
      }),
      prisma.message.create({
        data: {
          campaignId,
          leadId,
          orgId,
          channel: "linkedin",
          content: campaignVideo
            ? {
                type: "text",
                message: messageText,
                attachments: [
                  {
                    type: "video",
                    contentType: campaignVideo.contentType,
                    filename: campaignVideo.filename,
                    videoUrl: campaignVideo.videoUrl,
                    ...(campaignVideo.thumbnailUrl ? { thumbnailUrl: campaignVideo.thumbnailUrl } : {}),
                  },
                ],
                ...personalization,
              }
            : { type: "text", message: messageText, ...personalization },
          status: "sent",
          stepIndex: 1,
          sentAt: new Date(),
          externalId: chat.chat_id,
        },
      }),
      prisma.deliveryAttempt.update({
        where: { id: reservation.attemptId },
        data: {
          state: "sent",
          providerRef: chat.chat_id,
          sentAt: new Date(),
        },
      }),
    ]);
  } catch (error: unknown) {
    await markDeliveryReservationUnknown(reservation.attemptId, chat.chat_id);
    throw error;
  }

  const step2 = sequence[2];
  if (step2) {
    const delayMs = step2.delayHours * 60 * 60 * 1000;
    await campaignSequenceQueue.add(
      QUEUE_CAMPAIGN_SEQUENCE,
      {
        campaignLeadId,
        orgId,
        step: 2,
      },
      {
        delay: delayMs,
        jobId: campaignSequenceJobId(campaignLeadId, 2),
      },
    );
  }

  await publishDashboardEvent({
    orgId,
    type: "campaign.metrics.updated",
    resources: { campaignId, campaignLeadId },
  });

  return { delivered: true, chatId: chat.chat_id };
}
