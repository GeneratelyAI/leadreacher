import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { UnipileAdapter } from "../adapters/unipile.js";
import { env } from "../config/env.js";
import { DailySendLimitError, NotFoundError, ValidationError } from "../lib/errors.js";
import { CampaignLeadIdParamsSchema, authenticatedRoute } from "../lib/openapi.js";
import { prisma } from "../lib/prisma.js";
import { invalidateDashboardChrome } from "../lib/dashboard-cache.js";
import { checkAndIncrementDailySendLimit, getDailySendLimitStatus } from "../lib/rate-limiter.js";
import { requireOrgId } from "../lib/request-org.js";
import { isOutreachChannel } from "../lib/channels.js";
import {
  deliverOperatorMessage,
  resolveExistingOperatorDelivery,
  startOperatorLinkedInConversation,
} from "../services/operator-message-delivery.js";
import { requireOrganizationEntitlement } from "../services/entitlements.js";
import { getCampaignSenderForChannel } from "../services/campaign-channel-accounts.js";
import { syncLinkedInHistory } from "../services/linkedin-history-sync.js";
import { runReplyDraftAgent } from "../modules/agents/reply-draft-agent.js";
import { conversationKey } from "./dashboard-support.js";

const ConversationListQuerySchema = z.object({
  query: z.string().trim().max(120).optional(),
  campaignId: z.string().trim().min(1).optional(),
  state: z.enum(["all", "unread", "needs_reply"]).default("all"),
  channel: z.enum(["linkedin", "whatsapp", "facebook", "instagram", "email"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const ConversationMessagesQuerySchema = z.object({
  cursor: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

const ProviderAttachmentParamsSchema = CampaignLeadIdParamsSchema.extend({
  messageId: z.string().trim().min(1),
  attachmentId: z.string().trim().min(1),
});

const OperatorReplyBodySchema = z.object({
  message: z.string().trim().min(1).max(600),
  idempotencyKey: z.string().uuid(),
});

type MessageContent = { message: string; attachments: Array<{ type: string; videoUrl?: string; thumbnailUrl?: string; filename?: string; providerMessageId?: string; providerAttachmentId?: string }> };

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function campaignPromise(aiConfig: unknown): string | undefined {
  const personalization = asRecord(asRecord(aiConfig)?.channelPersonalization);
  const value = personalization?.valueProposition;
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 280) : undefined;
}

function replyGoal(messages: Array<{ direction: string; content: unknown }>): "answer" | "qualify" | "book" | "close" {
  const latestInbound = [...messages].reverse().find((message) => message.direction === "inbound");
  const text = jsonText(latestInbound?.content).toLowerCase();
  if (/\b(no thanks|not interested|unsubscribe|stop)\b/.test(text)) return "close";
  if (/\b(calendar|meeting|call|available|schedule)\b/.test(text)) return "book";
  if (/\b(price|pricing|budget|team|use case|how does)\b/.test(text)) return "qualify";
  return "answer";
}

function latestPersonalizationContext(messages: Array<{ direction: string; content: unknown }>): {
  angle?: string;
  cta?: string;
  evidenceTypes: string[];
} | undefined {
  const latestOutbound = [...messages].reverse().find((message) => message.direction === "outbound");
  const personalization = asRecord(asRecord(latestOutbound?.content)?.personalization);
  if (!personalization) return undefined;
  const evidenceTypes = Array.isArray(personalization.evidenceTypes)
    ? personalization.evidenceTypes.filter((value): value is string => typeof value === "string").slice(0, 3)
    : [];
  const angle = typeof personalization.angle === "string" ? personalization.angle.slice(0, 80) : undefined;
  const cta = typeof personalization.cta === "string" ? personalization.cta.slice(0, 80) : undefined;
  return angle || cta || evidenceTypes.length ? { angle, cta, evidenceTypes } : undefined;
}

function jsonText(value: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const record = value as Record<string, unknown>;
  for (const key of ["message", "body", "text"]) {
    if (typeof record[key] === "string" && record[key].trim()) return record[key].trim();
  }
  return "";
}

function messageContent(value: unknown): MessageContent {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { message: "Message content unavailable", attachments: [] };
  }
  const record = value as Record<string, unknown>;
  const rawAttachments = Array.isArray(record.attachments) ? record.attachments : [];
  const attachments = rawAttachments.flatMap((attachment) => {
    if (!attachment || typeof attachment !== "object" || Array.isArray(attachment)) return [];
    const item = attachment as Record<string, unknown>;
    if (typeof item.type !== "string") return [];
    return [{
      type: item.type,
      ...(typeof item.videoUrl === "string" ? { videoUrl: item.videoUrl } : {}),
      ...(typeof item.thumbnailUrl === "string" ? { thumbnailUrl: item.thumbnailUrl } : {}),
      ...(typeof item.filename === "string" ? { filename: item.filename } : {}),
      ...(typeof item.providerMessageId === "string" ? { providerMessageId: item.providerMessageId } : {}),
      ...(typeof item.providerAttachmentId === "string" ? { providerAttachmentId: item.providerAttachmentId } : {}),
    }];
  });
  return { message: jsonText(value) || "Message content unavailable", attachments };
}

function isProviderHistory(value: unknown): boolean {
  return asRecord(value)?.providerHistory === true;
}

function isTranscriptMessage(message: { status: string }): boolean {
  return message.status !== "skipped";
}

function leadName(lead: { firstName: string; lastName: string }): string {
  return `${lead.firstName} ${lead.lastName}`.trim() || "A prospect";
}

export async function registerDashboardConversationRoutes(app: FastifyInstance): Promise<void> {
  const r = app.withTypeProvider<ZodTypeProvider>();
  r.get("/dashboard/conversations", {
    schema: {
      ...authenticatedRoute("Dashboard", "List inbox conversations"),
      querystring: ConversationListQuerySchema,
    },
  }, async (request, reply) => {
    const orgId = requireOrgId(request);
    const query = request.query;
    const campaignLeads = await prisma.campaignLead.findMany({
      where: {
        OR: [
          { providerChatId: { not: null } },
          { linkedinChatId: { not: null } },
          { emailThreadKey: { not: null } },
        ],
        campaign: {
          orgId,
          ...(query.campaignId ? { id: query.campaignId } : {}),
        },
        ...(query.query
          ? {
              OR: [
                { lead: { firstName: { contains: query.query, mode: "insensitive" } } },
                { lead: { lastName: { contains: query.query, mode: "insensitive" } } },
                { lead: { company: { contains: query.query, mode: "insensitive" } } },
                { campaign: { name: { contains: query.query, mode: "insensitive" } } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        campaignId: true,
        leadId: true,
        linkedinChatId: true,
        providerChatId: true,
        emailThreadKey: true,
        status: true,
        lead: { select: { firstName: true, lastName: true, title: true, company: true, avatarUrl: true } },
        campaign: {
          select: {
            id: true,
            name: true,
            senderAccount: { select: { id: true, accountName: true, avatarUrl: true, platform: true, status: true, unipileId: true } },
          },
        },
      },
    });

    if (campaignLeads.length === 0) {
      return reply.send({
        conversations: [],
        counts: { all: 0, unread: 0, needsReply: 0 },
        total: 0,
        limit: query.limit,
        offset: query.offset,
      });
    }

    const conversationWhere = campaignLeads.map((item) => ({
      campaignId: item.campaignId,
      leadId: item.leadId,
    }));
    const baseMessageWhere = {
      orgId,
      OR: conversationWhere,
      ...(query.channel ? { channel: query.channel } : {}),
    };
    const [latestGroups, unreadGroups, needsReplyGroups] = await Promise.all([
      prisma.message.groupBy({
        by: ["campaignId", "leadId"],
        where: baseMessageWhere,
        _max: { sentAt: true },
      }),
      prisma.message.groupBy({
        by: ["campaignId", "leadId"],
        where: { ...baseMessageWhere, direction: "inbound", readAt: null },
        _count: { _all: true },
      }),
      prisma.message.groupBy({
        by: ["campaignId", "leadId"],
        where: { ...baseMessageWhere, direction: "inbound", handledAt: null },
        _count: { _all: true },
      }),
    ]);
    const latestMessages = latestGroups.length > 0
      ? await prisma.message.findMany({
          where: {
            orgId,
            OR: latestGroups.flatMap((group) => group._max.sentAt
              ? [{ campaignId: group.campaignId, leadId: group.leadId, sentAt: group._max.sentAt }]
              : []),
          },
          select: {
            id: true,
            campaignId: true,
            leadId: true,
            channel: true,
            direction: true,
            status: true,
            origin: true,
            content: true,
            sentAt: true,
            createdAt: true,
          },
          orderBy: [{ sentAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
        })
      : [];
    const latestByConversation = new Map<string, (typeof latestMessages)[number]>();
    for (const message of latestMessages) {
      const key = conversationKey(message.campaignId, message.leadId);
      if (!latestByConversation.has(key)) latestByConversation.set(key, message);
    }
    const unreadByConversation = new Map(
      unreadGroups.map((group) => [conversationKey(group.campaignId, group.leadId), group._count._all]),
    );
    const needsReplyConversations = new Set(
      needsReplyGroups.map((group) => conversationKey(group.campaignId, group.leadId)),
    );

    const allConversations = campaignLeads.flatMap((campaignLead) => {
      const key = conversationKey(campaignLead.campaignId, campaignLead.leadId);
      const latest = latestByConversation.get(key);
      if (!latest) return [];
      const unreadCount = unreadByConversation.get(key) ?? 0;
      const needsReply = needsReplyConversations.has(key);
      return [{
        id: campaignLead.id,
        leadId: campaignLead.leadId,
        campaignLeadStatus: campaignLead.status,
        chatId: campaignLead.providerChatId ?? campaignLead.linkedinChatId,
        channel: latest.channel,
        prospect: {
          name: leadName(campaignLead.lead),
          title: campaignLead.lead.title,
          company: campaignLead.lead.company,
          avatarUrl: campaignLead.lead.avatarUrl,
        },
        campaign: { id: campaignLead.campaign.id, name: campaignLead.campaign.name },
        sender: campaignLead.campaign.senderAccount,
        latestMessage: {
          id: latest.id,
          content: messageContent(latest.content).message,
          direction: latest.direction,
          origin: latest.origin,
          occurredAt: latest.sentAt ?? latest.createdAt,
        },
        unreadCount,
        needsReply,
      }];
    }).sort((left, right) => new Date(right.latestMessage.occurredAt).getTime() - new Date(left.latestMessage.occurredAt).getTime());

    const counts = {
      all: allConversations.length,
      unread: allConversations.filter((conversation) => conversation.unreadCount > 0).length,
      needsReply: allConversations.filter((conversation) => conversation.needsReply).length,
    };

    const conversations = allConversations.filter((conversation) => {
      if (query.state === "unread") return conversation.unreadCount > 0;
      if (query.state === "needs_reply") return conversation.needsReply;
      return true;
    });

    return reply.send({
      conversations: conversations.slice(query.offset, query.offset + query.limit),
      counts,
      total: conversations.length,
      limit: query.limit,
      offset: query.offset,
    });
  });

  r.get("/dashboard/conversations/:campaignLeadId", {
    schema: {
      ...authenticatedRoute("Dashboard", "Get conversation thread"),
      params: CampaignLeadIdParamsSchema,
    },
  }, async (request, reply) => {
    const orgId = requireOrgId(request);
    const { campaignLeadId } = request.params;
    const campaignLead = await prisma.campaignLead.findFirst({
      where: { id: campaignLeadId, campaign: { orgId } },
      select: {
        id: true,
        campaignId: true,
        leadId: true,
        status: true,
        currentStep: true,
        createdAt: true,
        linkedinChatId: true,
        providerChatId: true,
        emailThreadKey: true,
        lead: {
          select: {
            firstName: true,
            lastName: true,
            title: true,
            company: true,
            location: true,
            linkedinUrl: true,
            email: true,
            avatarUrl: true,
            status: true,
            providerLinkedinId: true,
          },
        },
        campaign: {
          select: {
            id: true,
            name: true,
            status: true,
            senderAccount: { select: { id: true, accountName: true, avatarUrl: true, platform: true, status: true, unipileId: true } },
          },
        },
      },
    });
    if (!campaignLead) throw new NotFoundError("Conversation");

    const providerChatId = campaignLead.providerChatId ?? campaignLead.linkedinChatId;
    const linkedInAccountId = campaignLead.campaign.senderAccount?.unipileId;
    if (providerChatId && linkedInAccountId) {
      try {
        await syncLinkedInHistory(
          new UnipileAdapter({ apiKey: env.UNIPILE_API_KEY }),
          {
            orgId,
            campaignId: campaignLead.campaignId,
            campaignLeadId: campaignLead.id,
            leadId: campaignLead.leadId,
            campaignLeadCreatedAt: campaignLead.createdAt,
            accountId: linkedInAccountId,
            chatId: providerChatId,
            stepIndex: campaignLead.currentStep,
          },
        );
      } catch (error) {
        app.log.warn({ error, campaignLeadId }, "LinkedIn history sync failed");
      }
    }

    const messagePage = await prisma.message.findMany({
      where: { orgId, campaignId: campaignLead.campaignId, leadId: campaignLead.leadId },
      orderBy: [{ sentAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      take: 51,
      select: {
        id: true,
        content: true,
        channel: true,
        direction: true,
        origin: true,
        status: true,
        readAt: true,
        handledAt: true,
        sentAt: true,
        createdAt: true,
        manualDeliveryAttempt: { select: { state: true } },
      },
    });
    const hasOlderMessages = messagePage.length > 50;
    const recentMessages = messagePage.slice(0, 50);
    const messages = [...recentMessages].reverse();
    const transcriptMessages = messages.filter(isTranscriptMessage);
    await prisma.message.updateMany({
      where: { orgId, campaignId: campaignLead.campaignId, leadId: campaignLead.leadId, direction: "inbound", readAt: null },
      data: { readAt: new Date() },
    });
    await invalidateDashboardChrome(orgId);

    const latestChannel = transcriptMessages.at(-1)?.channel ?? messages.at(-1)?.channel ?? "linkedin";
    let sender = isOutreachChannel(latestChannel)
      ? await getCampaignSenderForChannel({
          campaignId: campaignLead.campaignId,
          channel: latestChannel,
          legacyLinkedInAccount: campaignLead.campaign.senderAccount,
        })
      : null;
    if (latestChannel === "linkedin" && sender?.unipileId && sender.avatarUrl === null) {
      try {
        const profile = await new UnipileAdapter({ apiKey: env.UNIPILE_API_KEY })
          .getOwnProfile(sender.unipileId);
        if (profile.avatarUrl) {
          await prisma.socialAccount.update({
            where: { id: sender.id },
            data: {
              avatarUrl: profile.avatarUrl,
              ...(profile.displayName ? { accountName: profile.displayName } : {}),
            },
          });
          sender = {
            ...sender,
            avatarUrl: profile.avatarUrl,
            ...(profile.displayName ? { accountName: profile.displayName } : {}),
          };
        }
      } catch (error) {
        app.log.warn({ error, accountId: sender.unipileId }, "LinkedIn sender profile sync failed");
      }
    }
    const senderLimit = latestChannel === "linkedin" && sender?.unipileId
      ? await getDailySendLimitStatus(sender.unipileId, "message")
      : null;
    const hasInboundMessage = messages.some((message) => message.direction === "inbound");
    const hasStartedConversation = messages.some((message) => !(
      message.status === "skipped" && message.manualDeliveryAttempt?.state === "failed"
    ));

    return reply.send({
      conversation: {
        id: campaignLead.id,
        leadId: campaignLead.leadId,
        status: campaignLead.status,
        currentStep: campaignLead.currentStep,
        chatId: campaignLead.providerChatId ?? campaignLead.linkedinChatId,
        channel: latestChannel,
        prospect: { ...campaignLead.lead, name: leadName(campaignLead.lead) },
        campaign: { id: campaignLead.campaign.id, name: campaignLead.campaign.name },
        sender,
        senderLimit,
        canReply: Boolean(
          hasInboundMessage &&
          sender?.status === "active" &&
          sender.unipileId &&
          (latestChannel === "email"
            ? campaignLead.lead.email
            : campaignLead.providerChatId ?? campaignLead.linkedinChatId),
        ),
        canStartConversation: Boolean(
          !hasStartedConversation &&
          campaignLead.status === "active" &&
          campaignLead.lead.providerLinkedinId &&
          sender?.status === "active" &&
          sender.unipileId,
        ),
        messages: transcriptMessages.map((message) => ({
          ...message,
          content: messageContent(message.content),
          isProviderHistory: isProviderHistory(message.content),
          occurredAt: message.sentAt ?? message.createdAt,
        })),
        nextCursor: hasOlderMessages ? recentMessages.at(-1)?.id ?? null : null,
      },
    });
  });

  r.get("/dashboard/conversations/:campaignLeadId/provider-messages/:messageId/attachments/:attachmentId", {
    schema: {
      ...authenticatedRoute("Dashboard", "Stream a conversation provider attachment"),
      params: ProviderAttachmentParamsSchema,
    },
  }, async (request, reply) => {
    const orgId = requireOrgId(request);
    const { campaignLeadId, messageId, attachmentId } = request.params;
    const campaignLead = await prisma.campaignLead.findFirst({
      where: { id: campaignLeadId, campaign: { orgId } },
      select: {
        campaignId: true,
        leadId: true,
        providerChatId: true,
        linkedinChatId: true,
        campaign: { select: { senderAccount: { select: { unipileId: true } } } },
      },
    });
    if (!campaignLead) throw new NotFoundError("Conversation");
    const chatId = campaignLead.providerChatId ?? campaignLead.linkedinChatId;
    const accountId = campaignLead.campaign.senderAccount?.unipileId;
    if (!chatId || !accountId) throw new NotFoundError("Provider attachment");
    const storedMessage = await prisma.message.findFirst({
      where: {
        orgId,
        campaignId: campaignLead.campaignId,
        leadId: campaignLead.leadId,
        externalId: messageId,
      },
      select: { content: true },
    });
    const isKnownAttachment = storedMessage && messageContent(storedMessage.content).attachments.some(
      (attachment) => attachment.providerMessageId === messageId && attachment.providerAttachmentId === attachmentId,
    );
    if (!isKnownAttachment) throw new NotFoundError("Provider attachment");

    const attachment = await new UnipileAdapter({ apiKey: env.UNIPILE_API_KEY })
      .downloadChatMessageAttachment(accountId, chatId, messageId, attachmentId);
    return reply
      .header("Content-Type", attachment.contentType)
      .header("Cache-Control", "private, max-age=300")
      .send(attachment.buffer);
  });

  r.get("/dashboard/conversations/:campaignLeadId/messages", {
    schema: {
      ...authenticatedRoute("Dashboard", "Page older conversation messages"),
      params: CampaignLeadIdParamsSchema,
      querystring: ConversationMessagesQuerySchema,
    },
  }, async (request, reply) => {
    const orgId = requireOrgId(request);
    const { campaignLeadId } = request.params;
    const { cursor, limit } = request.query;
    const campaignLead = await prisma.campaignLead.findFirst({
      where: { id: campaignLeadId, campaign: { orgId } },
      select: { campaignId: true, leadId: true },
    });
    if (!campaignLead) throw new NotFoundError("Conversation");

    const page = await prisma.message.findMany({
      where: { orgId, campaignId: campaignLead.campaignId, leadId: campaignLead.leadId },
      orderBy: [{ sentAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      take: limit + 1,
      select: {
        id: true,
        content: true,
        channel: true,
        direction: true,
        origin: true,
        status: true,
        readAt: true,
        handledAt: true,
        sentAt: true,
        createdAt: true,
        manualDeliveryAttempt: { select: { state: true } },
      },
    });
    const hasMore = page.length > limit;
    const selected = page.slice(0, limit);
    return reply.send({
      messages: [...selected].reverse().filter(isTranscriptMessage).map((message) => ({
        ...message,
        content: messageContent(message.content),
        isProviderHistory: isProviderHistory(message.content),
        occurredAt: message.sentAt ?? message.createdAt,
      })),
      nextCursor: hasMore ? selected.at(-1)?.id ?? null : null,
    });
  });

  r.post("/dashboard/conversations/:campaignLeadId/start", {
    schema: {
      ...authenticatedRoute("Dashboard", "Start an operator LinkedIn conversation"),
      params: CampaignLeadIdParamsSchema,
      body: OperatorReplyBodySchema,
    },
  }, async (request, reply) => {
    const orgId = requireOrgId(request);
    const { campaignLeadId } = request.params;
    const body = request.body;
    const existingDelivery = await prisma.message.findFirst({
      where: { orgId, idempotencyKey: body.idempotencyKey },
      select: {
        id: true,
        status: true,
        manualDeliveryAttempt: { select: { state: true } },
      },
    });
    if (existingDelivery) {
      return reply.status(201).send(resolveExistingOperatorDelivery(existingDelivery));
    }

    const campaignLead = await prisma.campaignLead.findFirst({
      where: { id: campaignLeadId, campaign: { orgId } },
      select: {
        id: true,
        campaignId: true,
        leadId: true,
        status: true,
        linkedinChatId: true,
        providerChatId: true,
        lead: { select: { providerLinkedinId: true } },
        campaign: {
          select: {
            status: true,
            senderAccount: { select: { id: true, platform: true, status: true, unipileId: true } },
          },
        },
      },
    });
    if (!campaignLead) throw new NotFoundError("Conversation");
    if (campaignLead.status !== "active") {
      throw new ValidationError("This prospect needs an active campaign membership before messaging");
    }
    const priorMessage = await prisma.message.findFirst({
      where: {
        orgId,
        campaignId: campaignLead.campaignId,
        leadId: campaignLead.leadId,
        NOT: {
          status: "skipped",
          manualDeliveryAttempt: { is: { state: "failed" } },
        },
      },
      select: { id: true },
    });
    if (priorMessage || campaignLead.providerChatId || campaignLead.linkedinChatId) {
      throw new ValidationError("This conversation has already started");
    }
    if (!campaignLead.lead.providerLinkedinId) {
      throw new ValidationError("This prospect does not have a LinkedIn provider identifier");
    }

    const sender = await getCampaignSenderForChannel({
      campaignId: campaignLead.campaignId,
      channel: "linkedin",
      legacyLinkedInAccount: campaignLead.campaign.senderAccount,
    });
    if (!sender?.unipileId || sender.status !== "active") {
      throw new ValidationError("This campaign needs an active LinkedIn sender before messaging");
    }
    await requireOrganizationEntitlement(orgId);
    const limit = await checkAndIncrementDailySendLimit(sender.unipileId, "message");
    if (!limit.allowed) {
      const status = await getDailySendLimitStatus(sender.unipileId, "message");
      throw new DailySendLimitError(status.resetAt);
    }

    const adapter = new UnipileAdapter({ apiKey: env.UNIPILE_API_KEY });
    const result = await startOperatorLinkedInConversation(adapter, {
      orgId,
      campaignId: campaignLead.campaignId,
      campaignLeadId: campaignLead.id,
      leadId: campaignLead.leadId,
      senderAccountId: sender.unipileId,
      recipientProviderId: campaignLead.lead.providerLinkedinId,
      message: body.message,
      idempotencyKey: body.idempotencyKey,
    });
    await invalidateDashboardChrome(orgId);
    return reply.status(201).send(result);
  });

  r.post("/dashboard/conversations/:campaignLeadId/drafts", {
    schema: {
      ...authenticatedRoute("Dashboard", "Generate AI reply draft"),
      params: CampaignLeadIdParamsSchema,
    },
  }, async (request, reply) => {
    const orgId = requireOrgId(request);
    const { campaignLeadId } = request.params;
    const campaignLead = await prisma.campaignLead.findFirst({
      where: { id: campaignLeadId, campaign: { orgId } },
      select: {
        campaignId: true,
        leadId: true,
        lead: { select: { firstName: true, lastName: true, company: true } },
        campaign: { select: { name: true, aiConfig: true } },
      },
    });
    if (!campaignLead) throw new NotFoundError("Conversation");
    const messages = await prisma.message.findMany({
      where: { orgId, campaignId: campaignLead.campaignId, leadId: campaignLead.leadId },
      orderBy: { createdAt: "asc" },
      select: { direction: true, content: true },
    });
    if (!messages.some((message) => message.direction === "inbound")) {
      throw new ValidationError("A prospect reply is required before drafting a response");
    }

    const result = await runReplyDraftAgent({
      orgId,
      campaignName: campaignLead.campaign.name,
      prospectName: leadName(campaignLead.lead),
      company: campaignLead.lead.company || "the prospect's company",
      campaignPromise: campaignPromise(campaignLead.campaign.aiConfig),
      personalizationContext: latestPersonalizationContext(messages),
      goal: replyGoal(messages),
      conversation: messages.map((message) => ({ direction: message.direction === "inbound" ? "inbound" : "outbound", content: jsonText(message.content) || "Message content unavailable" })),
    });
    return reply.send(result);
  });

  r.post("/dashboard/conversations/:campaignLeadId/replies", {
    schema: {
      ...authenticatedRoute("Dashboard", "Send operator reply"),
      params: CampaignLeadIdParamsSchema,
      body: OperatorReplyBodySchema,
    },
  }, async (request, reply) => {
    const orgId = requireOrgId(request);
    const { campaignLeadId } = request.params;
    const body = request.body;
    const existingReply = await prisma.message.findFirst({
      where: { orgId, idempotencyKey: body.idempotencyKey },
      select: {
        id: true,
        status: true,
        manualDeliveryAttempt: { select: { state: true } },
      },
    });
    if (existingReply) {
      return reply.status(201).send(resolveExistingOperatorDelivery(existingReply));
    }
    const campaignLead = await prisma.campaignLead.findFirst({
      where: { id: campaignLeadId, campaign: { orgId } },
      select: {
        id: true,
        campaignId: true,
        leadId: true,
        linkedinChatId: true,
        providerChatId: true,
        emailThreadKey: true,
        lead: { select: { id: true, email: true, firstName: true, lastName: true } },
        campaign: {
          select: {
            senderAccount: { select: { id: true, platform: true, status: true, unipileId: true } },
          },
        },
      },
    });
    if (!campaignLead) throw new NotFoundError("Conversation");
    const latestInbound = await prisma.message.findFirst({
      where: { orgId, campaignId: campaignLead.campaignId, leadId: campaignLead.leadId, direction: "inbound" },
      orderBy: { createdAt: "desc" },
      select: { channel: true, content: true },
    });
    if (!latestInbound) {
      throw new ValidationError("A prospect reply is required before sending an operator response");
    }
    if (!isOutreachChannel(latestInbound.channel)) {
      throw new ValidationError(`Unsupported conversation channel: ${latestInbound.channel}`);
    }
    const channel = latestInbound.channel;
    const sender = await getCampaignSenderForChannel({
      campaignId: campaignLead.campaignId,
      channel,
      legacyLinkedInAccount: campaignLead.campaign.senderAccount,
    });
    if (!sender?.unipileId || sender.status !== "active") {
      throw new ValidationError(`This campaign needs an active ${channel} sender before replying`);
    }
    const chatId = campaignLead.providerChatId ?? campaignLead.linkedinChatId ?? undefined;
    if (channel !== "email" && !chatId) {
      throw new ValidationError(`This prospect does not have a ${channel} chat yet`);
    }
    if (channel === "email" && !campaignLead.lead.email) {
      throw new ValidationError("This prospect does not have an email address");
    }
    await requireOrganizationEntitlement(orgId);
    if (channel === "linkedin") {
      const limit = await checkAndIncrementDailySendLimit(sender.unipileId, "message");
      if (!limit.allowed) {
        const status = await getDailySendLimitStatus(sender.unipileId, "message");
        throw new DailySendLimitError(status.resetAt);
      }
    }

    const adapter = new UnipileAdapter({ apiKey: env.UNIPILE_API_KEY });
    const result = await deliverOperatorMessage(adapter, {
      orgId,
      campaignId: campaignLead.campaignId,
      campaignLeadId: campaignLead.id,
      leadId: campaignLead.leadId,
      channel,
      chatId,
      senderAccountId: sender.unipileId,
      recipientEmail: campaignLead.lead.email ?? undefined,
      recipientName: leadName(campaignLead.lead),
      subject: (() => {
        if (!latestInbound.content || typeof latestInbound.content !== "object" || Array.isArray(latestInbound.content)) return undefined;
        const subject = (latestInbound.content as Record<string, unknown>).subject;
        return typeof subject === "string" && subject.trim() ? `Re: ${subject.replace(/^Re:\s*/i, "")}` : undefined;
      })(),
      message: body.message,
      idempotencyKey: body.idempotencyKey,
    });
    await invalidateDashboardChrome(orgId);
    return reply.status(201).send(result);
  });

  r.get("/dashboard/messages", {
    schema: {
      ...authenticatedRoute("Dashboard", "List recent messages"),
    },
  }, async (request, reply) => {
    const orgId = requireOrgId(request);
    const messages = await prisma.message.findMany({
      where: { orgId },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        channel: true,
        content: true,
        direction: true,
        status: true,
        stepIndex: true,
        sentAt: true,
        createdAt: true,
        lead: { select: { firstName: true, lastName: true, company: true } },
        campaign: { select: { id: true, name: true } },
      },
    });

    return reply.send({
      messages: messages.map((message) => ({
        id: message.id,
        channel: message.channel,
        content: jsonText(message.content) || "Message content unavailable",
        direction: message.direction,
        status: message.status,
        stepIndex: message.stepIndex,
        occurredAt: message.sentAt ?? message.createdAt,
        lead: {
          name: leadName(message.lead),
          company: message.lead.company,
        },
        campaign: message.campaign,
      })),
    });
  });

}
