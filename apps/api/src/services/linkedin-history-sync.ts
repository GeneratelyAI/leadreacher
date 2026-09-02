import type { UnipileAdapter, UnipileChatMessage } from "../adapters/unipile.js";
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

type SyncLinkedInHistoryInput = {
  orgId: string;
  campaignId: string;
  campaignLeadId: string;
  leadId: string;
  campaignLeadCreatedAt: Date;
  accountId: string;
  chatId: string;
  stepIndex: number;
};

function providerMessageId(message: UnipileChatMessage): string {
  return `${message.is_sender ? "provider" : "inbound"}:${message.id}`;
}

function providerMessageContent(
  message: UnipileChatMessage,
  campaignLeadCreatedAt: Date,
  fallbackAttachments: Prisma.InputJsonArray = [],
) {
  const sentAt = new Date(message.timestamp);
  const providerAttachments = (message.attachments ?? []).map((attachment) => ({
    type: attachment.type ?? (attachment.mimetype?.startsWith("video/") ? "video" : "file"),
    providerMessageId: message.id,
    providerAttachmentId: attachment.id,
    ...(attachment.filename ? { filename: attachment.filename } : {}),
  }));
  const attachments = providerAttachments.length ? providerAttachments : fallbackAttachments;
  return {
    type: attachments.length ? "media" : "text",
    message: message.text?.trim() || "Video attachment",
    attachments,
    providerHistory: sentAt < campaignLeadCreatedAt,
  };
}

function contentAttachments(value: unknown): Prisma.InputJsonArray {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const attachments = (value as { attachments?: unknown }).attachments;
  return Array.isArray(attachments) ? attachments as Prisma.InputJsonArray : [];
}

function jsonMessage(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return (value as { message?: unknown }).message;
}

export async function syncLinkedInHistory(
  adapter: UnipileAdapter,
  input: SyncLinkedInHistoryInput,
): Promise<{ imported: number; hasInbound: boolean }> {
  const providerMessages: UnipileChatMessage[] = [];
  let cursor: string | undefined;
  for (let pageNumber = 0; pageNumber < 5; pageNumber += 1) {
    const page = await adapter.listChatMessages(input.accountId, input.chatId, {
      limit: 100,
      cursor,
    });
    providerMessages.push(...page.data);
    cursor = page.next_cursor;
    if (!cursor) break;
  }

  if (providerMessages.length === 0) return { imported: 0, hasInbound: false };

  const [existingOutbound, leadOutbound] = await Promise.all([
    prisma.message.findMany({
      where: {
        orgId: input.orgId,
        campaignId: input.campaignId,
        leadId: input.leadId,
        direction: "outbound",
      },
      select: { content: true, sentAt: true, createdAt: true },
    }),
    prisma.message.findMany({
      where: { orgId: input.orgId, leadId: input.leadId, direction: "outbound" },
      select: { content: true, sentAt: true, createdAt: true },
    }),
  ]);
  const matchedOutbound = (message: UnipileChatMessage): boolean => {
    const timestamp = new Date(message.timestamp).getTime();
    return existingOutbound.some((local) => {
      const localTimestamp = (local.sentAt ?? local.createdAt).getTime();
      return jsonMessage(local.content) === message.text && Math.abs(localTimestamp - timestamp) < 120_000;
    });
  };
  const fallbackAttachments = (message: UnipileChatMessage): Prisma.InputJsonArray => {
    const timestamp = new Date(message.timestamp).getTime();
    const local = leadOutbound.find((candidate) => {
      const candidateTime = (candidate.sentAt ?? candidate.createdAt).getTime();
      return jsonMessage(candidate.content) === message.text &&
        Math.abs(candidateTime - timestamp) < 120_000 &&
        contentAttachments(candidate.content).length > 0;
    });
    return contentAttachments(local?.content);
  };

  const importable = providerMessages.filter((message) =>
    message.id && message.timestamp && (message.text?.trim() || message.attachments?.length) &&
    (!message.is_sender || !matchedOutbound(message))
  );
  const result = importable.length ? await prisma.message.createMany({
    data: importable.map((message) => {
      const sentAt = new Date(message.timestamp);
      return {
        id: providerMessageId(message),
        campaignId: input.campaignId,
        leadId: input.leadId,
        orgId: input.orgId,
        channel: "linkedin",
        content: providerMessageContent(message, input.campaignLeadCreatedAt, fallbackAttachments(message)),
        direction: message.is_sender ? "outbound" : "inbound",
        origin: "provider",
        status: message.is_sender ? "sent" : "replied",
        externalId: message.id,
        stepIndex: input.stepIndex,
        sentAt,
      };
    }),
    skipDuplicates: true,
  }) : { count: 0 };

  await Promise.all(providerMessages
    .filter((message) => message.attachments?.length || fallbackAttachments(message).length)
    .map((message) => prisma.message.updateMany({
      where: { id: providerMessageId(message), orgId: input.orgId },
      data: { content: providerMessageContent(message, input.campaignLeadCreatedAt, fallbackAttachments(message)) },
    })));

  const hasInbound = providerMessages.some((message) => !message.is_sender);
  if (hasInbound) {
    await prisma.$transaction([
      prisma.lead.update({ where: { id: input.leadId }, data: { status: "replied" } }),
      prisma.campaignLead.update({
        where: { id: input.campaignLeadId },
        data: { status: "replied" },
      }),
    ]);
  }
  return { imported: result.count, hasInbound };
}
