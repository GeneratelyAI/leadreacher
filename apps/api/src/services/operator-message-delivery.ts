import type { UnipileAdapter } from "../adapters/unipile.js";
import { isUniqueConstraintError } from "../lib/inbound-message.js";
import { prisma } from "../lib/prisma.js";

type DeliverOperatorMessageInput = {
  orgId: string;
  campaignId: string;
  campaignLeadId: string;
  leadId: string;
  chatId: string;
  message: string;
  idempotencyKey: string;
};

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
          channel: "linkedin",
          content: { type: "text", message: input.message },
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
      select: { id: true },
    });
    if (existing) return { messageId: existing.id };
    throw error;
  }

  let providerResult: { message_id: string };
  try {
    providerResult = await adapter.sendMessageToChat(input.chatId, input.message);
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
        providerRef: providerResult.message_id,
        sentAt: new Date(),
      },
    }),
    prisma.message.update({
      where: { id: prepared.id },
      data: {
        status: "sent",
        externalId: providerResult.message_id,
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
        metadata: { campaignLeadId: input.campaignLeadId, channel: "linkedin" },
      },
    }),
  ]);

  return { messageId: prepared.id };
}
