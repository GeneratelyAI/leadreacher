import { Prisma } from "@prisma/client";
import type { UnipileAdapter } from "../adapters/unipile.js";
import { prisma } from "../lib/prisma.js";
import {
  campaignSequenceJobId,
  campaignSequenceQueue,
  QUEUE_CAMPAIGN_SEQUENCE,
} from "../lib/queue.js";
import type { SequenceStep } from "../lib/sequence.js";

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

  const step1 = sequence[1];
  if (!step1) {
    return { skipped: true, reason: "no sequence step 1" };
  }

  const chat = await adapter.startChat(
    unipileAccountId,
    attendeeProviderId,
    step1.message,
  );

  try {
    await prisma.campaignLead.update({
      where: { id: campaignLeadId },
      data: {
        linkedinChatId: chat.chat_id,
        currentStep: 2,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { skipped: true, reason: "concurrent delivery" };
    }
    throw error;
  }

  await prisma.message.create({
    data: {
      campaignId,
      leadId,
      orgId,
      channel: "linkedin",
      content: { type: "text", message: step1.message },
      status: "sent",
      stepIndex: 1,
      sentAt: new Date(),
      externalId: chat.chat_id,
    },
  });

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

  return { delivered: true, chatId: chat.chat_id };
}
