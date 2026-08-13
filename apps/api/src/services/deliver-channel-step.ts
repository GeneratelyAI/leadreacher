import type { Lead } from "@prisma/client";
import type { UnipileAdapter } from "../adapters/unipile.js";
import type { OutreachChannel } from "../lib/channels.js";
import { emailThreadKey, resolveLeadAttendeeId } from "../lib/lead-channel-identity.js";
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
import type { PersonalizedSequenceStep } from "./personalize-sequence-step.js";
import {
  checkAndIncrementDailySendLimit,
  millisecondsUntilNextUtcDay,
  utcDay,
  checkInstagramAutomatedMessageLimit,
  checkWhatsAppAutomatedMessageLimit,
} from "../lib/rate-limiter.js";

type SenderAccount = {
  id: string;
  unipileId: string;
  createdAt?: Date;
};

async function enqueueNextStep(input: {
  campaignLeadId: string;
  orgId: string;
  step: number;
  sequence: SequenceStep[];
}): Promise<void> {
  const next = input.sequence[input.step + 1];
  if (!next) return;
  await campaignSequenceQueue.add(
    QUEUE_CAMPAIGN_SEQUENCE,
    {
      campaignLeadId: input.campaignLeadId,
      orgId: input.orgId,
      step: input.step + 1,
    },
    {
      delay: next.delayHours * 60 * 60 * 1000,
      jobId: campaignSequenceJobId(input.campaignLeadId, input.step + 1),
    },
  );
}

async function rescheduleDailyLimit(input: {
  campaignLeadId: string;
  orgId: string;
  step: number;
}): Promise<{ skipped: true; reason: string }> {
  const delay = millisecondsUntilNextUtcDay();
  await campaignSequenceQueue.add(
    QUEUE_CAMPAIGN_SEQUENCE,
    input,
    {
      delay,
      jobId: `${campaignSequenceJobId(input.campaignLeadId, input.step)}-daily-limit-${utcDay(new Date(Date.now() + delay))}`,
    },
  );
  return { skipped: true, reason: "daily send limit reached for this sender" };
}

async function rescheduleChannelLimit(input: {
  campaignLeadId: string;
  orgId: string;
  step: number;
  delayMs: number;
  channel: OutreachChannel;
}): Promise<{ skipped: true; reason: string }> {
  await campaignSequenceQueue.add(
    QUEUE_CAMPAIGN_SEQUENCE,
    { campaignLeadId: input.campaignLeadId, orgId: input.orgId, step: input.step },
    {
      delay: input.delayMs,
      jobId: `${campaignSequenceJobId(input.campaignLeadId, input.step)}-${input.channel}-limit-${Date.now() + input.delayMs}`,
    },
  );
  return { skipped: true, reason: `${input.channel} automation limit reached` };
}

export async function deliverMessagingChannelStep(input: {
  adapter: UnipileAdapter;
  channel: Exclude<OutreachChannel, "email" | "linkedin">;
  campaignLeadId: string;
  orgId: string;
  campaignId: string;
  leadId: string;
  lead: Lead;
  step: number;
  sequence: SequenceStep[];
  currentStep: PersonalizedSequenceStep;
  sender: SenderAccount;
  existingChatId: string | null;
}): Promise<{ sent: true; chatId: string } | { skipped: true; reason: string }> {
  const attendeeId = resolveLeadAttendeeId(input.channel, input.lead);
  if (!attendeeId) {
    await prisma.campaignLead.update({
      where: { id: input.campaignLeadId },
      data: {
        status: "skipped",
        currentStep: input.step,
        skipReason: `missing ${input.channel} identity on lead`,
        skippedAt: new Date(),
      },
    });
    return {
      skipped: true,
      reason: `missing ${input.channel} identity on lead`,
    };
  }

  if (input.channel === "instagram") {
    const limit = await checkInstagramAutomatedMessageLimit({
      unipileId: input.sender.unipileId,
      connectedAt: input.sender.createdAt,
    });
    if (!limit.allowed) {
      return rescheduleChannelLimit({
        campaignLeadId: input.campaignLeadId,
        orgId: input.orgId,
        step: input.step,
        delayMs: limit.retryAfterMs,
        channel: input.channel,
      });
    }
  }

  if (input.channel === "whatsapp") {
    const limit = await checkWhatsAppAutomatedMessageLimit({
      unipileId: input.sender.unipileId,
      connectedAt: input.sender.createdAt,
      isNewChat: !input.existingChatId,
    });
    if (!limit.allowed) {
      return rescheduleChannelLimit({ campaignLeadId: input.campaignLeadId, orgId: input.orgId, step: input.step, delayMs: limit.retryAfterMs, channel: input.channel });
    }
  }

  if (input.channel !== "instagram" && input.channel !== "whatsapp") {
    const messageLimit = await checkAndIncrementDailySendLimit(
      input.sender.unipileId,
      "message",
    );
    if (!messageLimit.allowed) {
      return rescheduleDailyLimit({
        campaignLeadId: input.campaignLeadId,
        orgId: input.orgId,
        step: input.step,
      });
    }
  }

  const reservation = await acquireDeliveryReservation(
    input.campaignLeadId,
    input.step,
  );
  if (!reservation.acquired) {
    return {
      skipped: true,
      reason: `delivery reservation already ${reservation.state}`,
    };
  }

  let providerRef: string | undefined;
  let chatId = input.existingChatId;

  try {
    if (chatId) {
      const result = await input.adapter.sendMessageToChat(
        chatId,
        input.currentStep.message,
      );
      providerRef = result.message_id;
    } else {
      const chat = await input.adapter.startChat(
        input.sender.unipileId,
        attendeeId,
        input.currentStep.message,
      );
      chatId = chat.chat_id;
      providerRef = chat.chat_id;
    }

    await prisma.$transaction([
      prisma.message.create({
        data: {
          campaignId: input.campaignId,
          leadId: input.leadId,
          orgId: input.orgId,
          channel: input.channel,
          content: {
            type: "text",
            message: input.currentStep.message,
            ...(input.currentStep.personalization
              ? { personalization: input.currentStep.personalization.tags }
              : {}),
          },
          status: "sent",
          stepIndex: input.step,
          sentAt: new Date(),
          externalId: providerRef,
        },
      }),
      prisma.campaignLead.update({
        where: { id: input.campaignLeadId },
        data: {
          currentStep: input.step + 1,
          providerChatId: chatId,
          ...(input.channel === "whatsapp"
            ? {}
            : {}),
        },
      }),
      prisma.lead.update({
        where: { id: input.leadId },
        data: {
          status: "contacted",
          ...(input.channel === "whatsapp" && !input.lead.providerWhatsappId
            ? { providerWhatsappId: attendeeId }
            : {}),
          ...(input.channel === "facebook" && !input.lead.providerFacebookId
            ? { providerFacebookId: attendeeId }
            : {}),
          ...(input.channel === "instagram" && !input.lead.providerInstagramId
            ? { providerInstagramId: attendeeId }
            : {}),
        },
      }),
      prisma.deliveryAttempt.update({
        where: { id: reservation.attemptId },
        data: {
          state: "sent",
          providerRef,
          sentAt: new Date(),
        },
      }),
    ]);
  } catch (error) {
    await markDeliveryReservationUnknown(reservation.attemptId, providerRef);
    throw error;
  }

  await enqueueNextStep({
    campaignLeadId: input.campaignLeadId,
    orgId: input.orgId,
    step: input.step,
    sequence: input.sequence,
  });

  return { sent: true, chatId: chatId! };
}

export async function deliverEmailChannelStep(input: {
  adapter: UnipileAdapter;
  campaignLeadId: string;
  orgId: string;
  campaignId: string;
  leadId: string;
  lead: Lead;
  step: number;
  sequence: SequenceStep[];
  currentStep: PersonalizedSequenceStep;
  sender: SenderAccount;
}): Promise<{ sent: true; emailId: string } | { skipped: true; reason: string }> {
  const email = resolveLeadAttendeeId("email", input.lead);
  if (!email) {
    await prisma.campaignLead.update({
      where: { id: input.campaignLeadId },
      data: {
        status: "skipped",
        currentStep: input.step,
        skipReason: "missing email on lead",
        skippedAt: new Date(),
      },
    });
    return { skipped: true, reason: "missing email on lead" };
  }

  if (!input.currentStep.subject?.trim()) {
    throw new Error(`Email step ${input.step} is missing subject`);
  }

  const messageLimit = await checkAndIncrementDailySendLimit(
    input.sender.unipileId,
    "message",
  );
  if (!messageLimit.allowed) {
    return rescheduleDailyLimit({
      campaignLeadId: input.campaignLeadId,
      orgId: input.orgId,
      step: input.step,
    });
  }

  const reservation = await acquireDeliveryReservation(
    input.campaignLeadId,
    input.step,
  );
  if (!reservation.acquired) {
    return {
      skipped: true,
      reason: `delivery reservation already ${reservation.state}`,
    };
  }

  let providerRef: string | undefined;
  try {
    const result = await input.adapter.sendEmail({
      accountId: input.sender.unipileId,
      toEmail: email,
      toName: `${input.lead.firstName} ${input.lead.lastName}`.trim(),
      subject: input.currentStep.subject,
      body: input.currentStep.message,
    });
    providerRef =
      result.email_id ?? result.provider_id ?? result.id ?? `email:${email}:${Date.now()}`;

    const threadKey = emailThreadKey(input.sender.unipileId, email);

    await prisma.$transaction([
      prisma.message.create({
        data: {
          campaignId: input.campaignId,
          leadId: input.leadId,
          orgId: input.orgId,
          channel: "email",
          content: {
            type: "email",
            subject: input.currentStep.subject,
            body: input.currentStep.message,
            ...(input.currentStep.personalization
              ? { personalization: input.currentStep.personalization.tags }
              : {}),
          },
          status: "sent",
          stepIndex: input.step,
          sentAt: new Date(),
          externalId: providerRef,
        },
      }),
      prisma.campaignLead.update({
        where: { id: input.campaignLeadId },
        data: {
          currentStep: input.step + 1,
          emailThreadKey: threadKey,
        },
      }),
      prisma.lead.update({
        where: { id: input.leadId },
        data: { status: "contacted" },
      }),
      prisma.deliveryAttempt.update({
        where: { id: reservation.attemptId },
        data: {
          state: "sent",
          providerRef,
          sentAt: new Date(),
        },
      }),
    ]);
  } catch (error) {
    await markDeliveryReservationUnknown(reservation.attemptId, providerRef);
    throw error;
  }

  await enqueueNextStep({
    campaignLeadId: input.campaignLeadId,
    orgId: input.orgId,
    step: input.step,
    sequence: input.sequence,
  });

  return { sent: true, emailId: providerRef! };
}
