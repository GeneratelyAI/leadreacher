import { Worker } from "bullmq";
import {
  UnipileAdapter,
  type UnipileChat,
  type UnipileMessage,
} from "../adapters/unipile.js";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { redisSubscriber } from "../lib/redis.js";
import {
  campaignSequenceJobId,
  campaignSequenceQueue,
  QUEUE_CAMPAIGN_SEQUENCE,
  QUEUE_RECONCILE_DELIVERY_ATTEMPTS,
  scheduleDeliveryAttemptReconciliation,
} from "../lib/queue.js";
import { parseSequence } from "../lib/sequence.js";

const STALE_RESERVATION_MS = 10 * 60 * 1000;
const BATCH_SIZE = 100;

export function isConfirmedUnipileChat(
  chat: UnipileChat,
  expectedChatId: string,
): boolean {
  return chat.id === expectedChatId;
}

export function isConfirmedUnipileMessage(
  message: UnipileMessage,
  expectedMessageId: string,
): boolean {
  return (
    message.id === expectedMessageId ||
    message.message_id === expectedMessageId
  );
}

async function reconcileUnknownAttempt(
  adapter: UnipileAdapter,
  attempt: {
    id: string;
    campaignLeadId: string;
    stepIndex: number;
    state: string;
    providerRef: string;
    updatedAt: Date;
    campaignLead: {
      campaignId: string;
      leadId: string;
      currentStep: number;
      linkedinChatId: string | null;
      campaign: { orgId: string; sequence: unknown };
    };
  },
): Promise<boolean> {
  try {
    // A sent invitation only records the recipient's provider ID, not a
    // provider-issued invitation ID. Unipile documents no read endpoint that
    // can positively confirm that invitation, so it remains unknown.
    if (attempt.stepIndex === 0) {
      return false;
    }

    const confirmed =
      attempt.stepIndex === 1
        ? isConfirmedUnipileChat(
            await adapter.getChat(attempt.providerRef),
            attempt.providerRef,
          )
        : isConfirmedUnipileMessage(
            await adapter.getMessage(attempt.providerRef),
            attempt.providerRef,
          );

    if (!confirmed) {
      return false;
    }

    const sequence = parseSequence(attempt.campaignLead.campaign.sequence);
    const sequenceStep = sequence[attempt.stepIndex];
    if (!sequenceStep) {
      throw new Error(
        `Missing sequence step ${attempt.stepIndex} for delivery attempt ${attempt.id}`,
      );
    }

    const staleRecoveryCutoff = new Date(Date.now() - STALE_RESERVATION_MS);
    const restored = await prisma.$transaction(async (tx) => {
      // Claim the provider-confirmed reservation in the same transaction as
      // state restoration. If this process dies, the transaction rolls back;
      // an old recovering reservation is safely retried on the next pass.
      const claimed = await tx.deliveryAttempt.updateMany({
        where:
          attempt.state === "unknown"
            ? { id: attempt.id, state: "unknown" }
            : {
                id: attempt.id,
                state: "recovering",
                updatedAt: { lte: staleRecoveryCutoff },
              },
        data: { state: "recovering" },
      });
      if (claimed.count === 0) {
        return false;
      }

      const campaignLead = await tx.campaignLead.findUnique({
        where: { id: attempt.campaignLeadId },
        select: { currentStep: true, linkedinChatId: true },
      });
      if (!campaignLead) {
        throw new Error(`CampaignLead ${attempt.campaignLeadId} not found`);
      }

      if (
        attempt.stepIndex === 1 &&
        campaignLead.linkedinChatId &&
        campaignLead.linkedinChatId !== attempt.providerRef
      ) {
        throw new Error(
          `CampaignLead ${attempt.campaignLeadId} already has a different LinkedIn chat`,
        );
      }

      const existingMessage = await tx.message.findFirst({
        where: {
          campaignId: attempt.campaignLead.campaignId,
          leadId: attempt.campaignLead.leadId,
          stepIndex: attempt.stepIndex,
          externalId: attempt.providerRef,
        },
        select: { id: true },
      });
      if (!existingMessage) {
        await tx.message.create({
          data: {
            campaignId: attempt.campaignLead.campaignId,
            leadId: attempt.campaignLead.leadId,
            orgId: attempt.campaignLead.campaign.orgId,
            channel: "linkedin",
            content: { type: "text", message: sequenceStep.message },
            status: "sent",
            stepIndex: attempt.stepIndex,
            sentAt: new Date(),
            externalId: attempt.providerRef,
          },
        });
      }

      const nextCurrentStep = Math.max(
        campaignLead.currentStep,
        attempt.stepIndex + 1,
      );
      await tx.campaignLead.update({
        where: { id: attempt.campaignLeadId },
        data: {
          currentStep: nextCurrentStep,
          ...(attempt.stepIndex === 1 && !campaignLead.linkedinChatId
            ? { linkedinChatId: attempt.providerRef }
            : {}),
        },
      });
      return true;
    });
    if (!restored) {
      return false;
    }

    const nextStep = sequence[attempt.stepIndex + 1];
    if (nextStep) {
      const jobId = campaignSequenceJobId(
        attempt.campaignLeadId,
        attempt.stepIndex + 1,
      );
      const existingJob = await campaignSequenceQueue.getJob(jobId);
      if (!existingJob) {
        await campaignSequenceQueue.add(
          QUEUE_CAMPAIGN_SEQUENCE,
          {
            campaignLeadId: attempt.campaignLeadId,
            orgId: attempt.campaignLead.campaign.orgId,
            step: attempt.stepIndex + 1,
          },
          {
            delay: nextStep.delayHours * 60 * 60 * 1000,
            jobId,
          },
        );
      }
    }

    const changed = await prisma.deliveryAttempt.updateMany({
      where: { id: attempt.id, state: "recovering" },
      data: { state: "sent", sentAt: new Date() },
    });
    if (changed.count === 0) {
      return false;
    }

    await prisma.auditLog.create({
      data: {
        orgId: attempt.campaignLead.campaign.orgId,
        action: "campaign.delivery.recovered",
        resource: "CampaignLead",
        resourceId: attempt.campaignLeadId,
        metadata: {
          deliveryAttemptId: attempt.id,
          stepIndex: attempt.stepIndex,
          providerRef: attempt.providerRef,
          source: "unipile-read-confirmation",
        },
      },
    });
    return true;
  } catch (error) {
    // A timeout, 404, or malformed response is inconclusive. It must never be
    // converted into a false "sent" or a false "failed" outcome.
    console.error(
      JSON.stringify({
        event: "reconcile-delivery-attempts",
        path: "provider-confirmation-inconclusive",
        deliveryAttemptId: attempt.id,
        stepIndex: attempt.stepIndex,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    return false;
  }
}

export async function reconcileDeliveryAttempts(): Promise<{
  markedUnknown: number;
  confirmedSent: number;
}> {
  const cutoff = new Date(Date.now() - STALE_RESERVATION_MS);
  const attempts = await prisma.deliveryAttempt.findMany({
    where: { state: "reserved", reservedAt: { lte: cutoff } },
    include: { campaignLead: { include: { campaign: true } } },
    take: BATCH_SIZE,
  });

  let markedUnknown = 0;
  for (const attempt of attempts) {
    const changed = await prisma.deliveryAttempt.updateMany({
      where: { id: attempt.id, state: "reserved" },
      data: { state: "unknown" },
    });
    if (changed.count === 0) {
      continue;
    }
    markedUnknown += 1;

    await prisma.auditLog.create({
      data: {
        orgId: attempt.campaignLead.campaign.orgId,
        action: "campaign.delivery.unknown",
        resource: "CampaignLead",
        resourceId: attempt.campaignLeadId,
        metadata: {
          deliveryAttemptId: attempt.id,
          stepIndex: attempt.stepIndex,
          reason: "stale-reservation-without-provider-confirmation",
        },
      },
    });
  }

  const unknownAttempts = await prisma.deliveryAttempt.findMany({
    where: {
      providerRef: { not: null },
      OR: [
        { state: "unknown" },
        { state: "recovering", updatedAt: { lte: cutoff } },
      ],
    },
    include: { campaignLead: { include: { campaign: true } } },
    take: BATCH_SIZE,
  });
  const adapter = new UnipileAdapter({
    dsn: env.UNIPILE_DSN,
    apiKey: env.UNIPILE_API_KEY,
  });

  let confirmedSent = 0;
  for (const attempt of unknownAttempts) {
    const providerRef = attempt.providerRef;
    if (!providerRef) {
      continue;
    }
    if (
      await reconcileUnknownAttempt(adapter, {
        ...attempt,
        providerRef,
      })
    ) {
      confirmedSent += 1;
    }
  }

  return { markedUnknown, confirmedSent };
}

/**
 * A stale reservation means the process may have died after the provider call.
 * It is made visible for recovery/review, never resent blindly.
 */
export function startDeliveryAttemptReconciliationWorker(): Worker {
  const worker = new Worker(
    QUEUE_RECONCILE_DELIVERY_ATTEMPTS,
    async () => reconcileDeliveryAttempts(),
    { connection: redisSubscriber },
  );

  void scheduleDeliveryAttemptReconciliation();
  return worker;
}
