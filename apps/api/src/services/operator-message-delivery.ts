import type { UnipileAdapter } from "../adapters/unipile.js";
import { isUniqueConstraintError } from "../lib/inbound-message.js";
import {
  DeliveryFailedError,
  DeliveryPendingError,
  DeliveryUnknownError,
} from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";

type DeliverOperatorMessageInput = {
  orgId: string;
  campaignId: string;
  campaignLeadId: string;
  leadId: string;
  channel: string;
  chatId?: string;
  senderAccountId: string;
  recipientEmail?: string;
  recipientName?: string;
  subject?: string;
  message: string;
  idempotencyKey: string;
};

type ExistingOperatorDelivery = {
  id: string;
  status: string;
  manualDeliveryAttempt: { state: string } | null;
};

export function resolveExistingOperatorDelivery(existing: ExistingOperatorDelivery): {
  messageId: string;
} {
  const state = existing.manualDeliveryAttempt?.state;
  if (existing.status === "sent" && state === "sent") {
    return { messageId: existing.id };
  }
  if (state === "unknown") throw new DeliveryUnknownError();
  if (state === "failed") throw new DeliveryFailedError();
  throw new DeliveryPendingError();
}

export async function deliverOperatorMessage(
  adapter: UnipileAdapter,
  input: DeliverOperatorMessageInput,
): Promise<{ messageId: string }> {
  let prepared: { id: string };
  try {
    prepared = await prisma.$transaction(async (tx) => {
      const message = await tx.message.create({
        data: {
          campaignId: input.campaignId,
          leadId: input.leadId,
          orgId: input.orgId,
          channel: input.channel,
          content: input.channel === "email"
            ? { type: "email", subject: input.subject ?? "Re: Your conversation", body: input.message }
            : { type: "text", message: input.message },
          direction: "outbound",
          origin: "operator",
          status: "queued",
          stepIndex: -1,
          idempotencyKey: input.idempotencyKey,
        },
        select: { id: true },
      });
      await tx.manualDeliveryAttempt.create({
        data: {
          messageId: message.id,
          campaignLeadId: input.campaignLeadId,
        },
      });
      return message;
    });
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;

    const existing = await prisma.message.findFirst({
      where: { orgId: input.orgId, idempotencyKey: input.idempotencyKey },
      select: {
        id: true,
        status: true,
        manualDeliveryAttempt: { select: { state: true } },
      },
    });
    if (existing) return resolveExistingOperatorDelivery(existing);
    throw error;
  }

  let providerRef: string;
  try {
    if (input.channel === "email") {
      if (!input.recipientEmail) throw new Error("The prospect has no email address");
      const result = await adapter.sendEmail({
        accountId: input.senderAccountId,
        toEmail: input.recipientEmail,
        toName: input.recipientName,
        subject: input.subject ?? "Re: Your conversation",
        body: input.message,
      });
      providerRef = result.email_id ?? result.provider_id ?? result.id ?? `email:${Date.now()}`;
    } else {
      if (!input.chatId) throw new Error(`This ${input.channel} conversation has no provider chat`);
      const result = await adapter.sendMessageToChat(input.chatId, input.message);
      providerRef = result.message_id;
    }
  } catch (error) {
    await prisma.$transaction([
      prisma.manualDeliveryAttempt.update({
        where: { messageId: prepared.id },
        data: { state: "unknown" },
      }),
      prisma.message.update({
        where: { id: prepared.id },
        data: { status: "skipped" },
      }),
    ]);
    throw error;
  }

  await prisma.$transaction([
    prisma.manualDeliveryAttempt.update({
      where: { messageId: prepared.id },
      data: {
        state: "sent",
        providerRef,
        sentAt: new Date(),
      },
    }),
    prisma.message.update({
      where: { id: prepared.id },
      data: {
        status: "sent",
        externalId: providerRef,
        sentAt: new Date(),
      },
    }),
    prisma.message.updateMany({
      where: {
        campaignId: input.campaignId,
        leadId: input.leadId,
        direction: "inbound",
        handledAt: null,
      },
      data: { handledAt: new Date() },
    }),
    prisma.auditLog.create({
      data: {
        orgId: input.orgId,
        action: "message.operator_send",
        resource: "Message",
        resourceId: prepared.id,
        metadata: { campaignLeadId: input.campaignLeadId, channel: input.channel },
      },
    }),
  ]);

  return { messageId: prepared.id };
}
