import {
  isDefinitiveUnipileRejection,
  UnipileRequestError,
  type UnipileAdapter,
} from "../adapters/unipile.js";
import { isUniqueConstraintError } from "../lib/inbound-message.js";
import {
  DeliveryFailedError,
  DeliveryPendingError,
  DeliveryUnknownError,
  RecipientUnreachableError,
} from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { publishChatEvent } from "../lib/chat-events.js";

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

type DeliveryFailure = {
  state: "failed" | "unknown";
  category: string;
  retryable: boolean;
  upstreamStatus?: number;
  providerRequestId?: string;
};

export function classifyOperatorDeliveryFailure(error: unknown): DeliveryFailure {
  if (error instanceof RecipientUnreachableError) {
    return { state: "failed", category: "recipient_unreachable", retryable: false };
  }
  if (error instanceof UnipileRequestError) {
    const retryable = error.upstreamStatus === 408
      || error.upstreamStatus === 429
      || error.upstreamStatus >= 500;
    return {
      state: isDefinitiveUnipileRejection(error) || error.upstreamStatus === 429
        ? "failed"
        : "unknown",
      category: error.upstreamStatus === 429
        ? "rate_limited"
        : error.upstreamStatus === 401 || error.upstreamStatus === 403
          ? "account_authorization"
          : error.upstreamStatus >= 500
            ? "provider_unavailable"
            : "provider_rejected",
      retryable,
      upstreamStatus: error.upstreamStatus,
      ...(error.requestId ? { providerRequestId: error.requestId } : {}),
    };
  }
  if (error instanceof Error && /has no provider chat|has no email address/i.test(error.message)) {
    return { state: "failed", category: "invalid_recipient", retryable: false };
  }
  return { state: "unknown", category: "unconfirmed_provider_result", retryable: true };
}

function failedDeliveryAudit(
  input: Pick<DeliverOperatorMessageInput, "orgId" | "campaignLeadId" | "channel">,
  messageId: string,
  action: string,
  failure: DeliveryFailure,
) {
  return prisma.auditLog.create({
    data: {
      orgId: input.orgId,
      action,
      resource: "Message",
      resourceId: messageId,
      metadata: {
        campaignLeadId: input.campaignLeadId,
        channel: input.channel,
        deliveryState: failure.state,
        failureCategory: failure.category,
        retryable: failure.retryable,
        ...(failure.upstreamStatus ? { upstreamStatus: failure.upstreamStatus } : {}),
        ...(failure.providerRequestId ? { providerRequestId: failure.providerRequestId } : {}),
      },
    },
  });
}

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
      const result = await adapter.sendMessageToChat(
        input.senderAccountId,
        input.chatId,
        input.message,
      );
      providerRef = result.message_id;
    }
  } catch (error) {
    const failure = classifyOperatorDeliveryFailure(error);
    await prisma.$transaction([
      prisma.manualDeliveryAttempt.update({
        where: { messageId: prepared.id },
        data: { state: failure.state },
      }),
      prisma.message.update({
        where: { id: prepared.id },
        data: { status: "skipped" },
      }),
      failedDeliveryAudit(input, prepared.id, "message.operator_send_failed", failure),
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

  await publishChatEvent({
    orgId: input.orgId,
    type: "message.created",
    campaignLeadId: input.campaignLeadId,
    messageId: prepared.id,
  });

  return { messageId: prepared.id };
}

type StartOperatorLinkedInConversationInput = Omit<
  DeliverOperatorMessageInput,
  "channel" | "chatId" | "recipientEmail" | "recipientName" | "subject"
> & {
  recipientProviderId: string;
};

export async function startOperatorLinkedInConversation(
  adapter: UnipileAdapter,
  input: StartOperatorLinkedInConversationInput,
): Promise<{ messageId: string; chatId: string }> {
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
        data: { messageId: message.id, campaignLeadId: input.campaignLeadId },
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
        manualDeliveryAttempt: { select: { state: true, providerRef: true } },
      },
    });
    if (!existing) throw error;
    resolveExistingOperatorDelivery(existing);
    const campaignLead = await prisma.campaignLead.findUnique({
      where: { id: input.campaignLeadId },
      select: { providerChatId: true, linkedinChatId: true },
    });
    const chatId = campaignLead?.providerChatId ?? campaignLead?.linkedinChatId;
    if (!chatId) throw new DeliveryPendingError();
    return { messageId: existing.id, chatId };
  }

  let chatId: string;
  try {
    const chat = await adapter.startLinkedInChat(
      input.senderAccountId,
      input.recipientProviderId,
      input.message,
    );
    chatId = chat.chat_id;
  } catch (error) {
    const failure = classifyOperatorDeliveryFailure(error);
    await prisma.$transaction([
      prisma.manualDeliveryAttempt.update({
        where: { messageId: prepared.id },
        data: { state: failure.state },
      }),
      prisma.message.update({
        where: { id: prepared.id },
        data: { status: "skipped" },
      }),
      failedDeliveryAudit(
        { ...input, channel: "linkedin" },
        prepared.id,
        "message.operator_start_failed",
        failure,
      ),
    ]);
    throw error;
  }

  const providerRef = `linkedin-chat:${chatId}:initial:${prepared.id}`;
  const sentAt = new Date();
  await prisma.$transaction([
    prisma.campaignLead.update({
      where: { id: input.campaignLeadId },
      data: { linkedinChatId: chatId, providerChatId: chatId },
    }),
    prisma.manualDeliveryAttempt.update({
      where: { messageId: prepared.id },
      data: { state: "sent", providerRef, sentAt },
    }),
    prisma.message.update({
      where: { id: prepared.id },
      data: { status: "sent", externalId: providerRef, sentAt },
    }),
    prisma.auditLog.create({
      data: {
        orgId: input.orgId,
        action: "message.operator_start",
        resource: "Message",
        resourceId: prepared.id,
        metadata: { campaignLeadId: input.campaignLeadId, channel: "linkedin" },
      },
    }),
  ]);

  await publishChatEvent({
    orgId: input.orgId,
    type: "message.created",
    campaignLeadId: input.campaignLeadId,
    messageId: prepared.id,
  });

  return { messageId: prepared.id, chatId };
}
