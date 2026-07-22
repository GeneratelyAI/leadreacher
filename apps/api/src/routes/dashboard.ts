import type { FastifyPluginAsync } from "fastify";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { UnipileAdapter } from "../adapters/unipile.js";
import { env } from "../config/env.js";
import { DailySendLimitError, NotFoundError, ValidationError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { checkAndIncrementDailySendLimit, getDailySendLimitStatus } from "../lib/rate-limiter.js";
import {
  analyticsInsightsQueue,
  QUEUE_ANALYTICS_INSIGHTS,
} from "../lib/queue.js";
import { requireOrgId } from "../lib/request-org.js";
import { readCachedAnalyticsInsights } from "../services/analytics-insights.js";
import { deliverOperatorMessage } from "../services/operator-message-delivery.js";
import { runReplyDraftAgent } from "../modules/agents/reply-draft-agent.js";

type EngineStatus = "running" | "ready" | "needs_attention";

type DashboardActivity = {
  id: string;
  kind: "message" | "prospect" | "video" | "campaign";
  title: string;
  detail: string;
  occurredAt: Date;
  avatarUrl?: string | null;
  channel?: string;
};

type ActivityMessage = {
  id: string;
  direction: string;
  channel: string;
  createdAt: Date;
  lead: { firstName: string; lastName: string; company: string; avatarUrl: string | null };
  campaign: { name: string };
};

type ActivityLead = {
  id: string;
  firstName: string;
  lastName: string;
  company: string;
  avatarUrl: string | null;
  createdAt: Date;
};

type ActivityVideo = {
  id: string;
  status: string;
  needsReview: boolean;
  updatedAt: Date;
  campaign: { name: string } | null;
  lead: { firstName: string; lastName: string; avatarUrl: string | null } | null;
};

type ActivityCampaign = {
  id: string;
  name: string;
  status: string;
  updatedAt: Date;
  _count: { leads: number };
};

const UpdateDashboardSettingsSchema = z.object({
  organizationName: z.string().trim().min(1).max(120),
});

const ActivityListQuerySchema = z.object({
  kind: z.enum(["all", "message", "prospect", "video", "campaign"]).default("all"),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const ProspectListQuerySchema = z.object({
  query: z.string().trim().max(120).optional(),
  reviewStatus: z.enum(["pending", "approved", "excluded"]).optional(),
  status: z.string().trim().max(40).optional(),
  source: z.string().trim().max(40).optional(),
  campaignId: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const ReviewProspectSchema = z.object({
  reviewStatus: z.enum(["approved", "excluded"]),
});

const BulkReviewProspectsSchema = z.object({
  leadIds: z.array(z.string().min(1)).min(1).max(100),
  reviewStatus: z.enum(["approved", "excluded"]),
});

const ConversationListQuerySchema = z.object({
  query: z.string().trim().max(120).optional(),
  campaignId: z.string().trim().min(1).optional(),
  state: z.enum(["all", "unread", "needs_reply"]).default("all"),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const OperatorReplyBodySchema = z.object({
  message: z.string().trim().min(1).max(600),
  idempotencyKey: z.string().uuid(),
});

type MessageContent = { message: string; attachments: Array<{ type: string; videoUrl?: string; filename?: string }> };

function jsonText(value: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const record = value as Record<string, unknown>;
  for (const key of ["message", "body", "text"]) {
    if (typeof record[key] === "string" && record[key].trim()) {
      return record[key].trim();
    }
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
      ...(typeof item.filename === "string" ? { filename: item.filename } : {}),
    }];
  });
  return { message: jsonText(value) || "Message content unavailable", attachments };
}

function leadName(lead: { firstName: string; lastName: string }): string {
  return `${lead.firstName} ${lead.lastName}`.trim() || "A prospect";
}

function prospectListWhere(
  orgId: string,
  query: z.infer<typeof ProspectListQuerySchema>,
): Prisma.LeadWhereInput {
  return {
    orgId,
    ...(query.reviewStatus ? { reviewStatus: query.reviewStatus } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.source ? { source: query.source } : {}),
    ...(query.campaignId ? { campaigns: { some: { campaignId: query.campaignId } } } : {}),
    ...(query.query
      ? {
          OR: [
            { firstName: { contains: query.query, mode: "insensitive" } },
            { lastName: { contains: query.query, mode: "insensitive" } },
            { company: { contains: query.query, mode: "insensitive" } },
            { title: { contains: query.query, mode: "insensitive" } },
          ],
        }
      : {}),
  };
}

function conversationKey(campaignId: string, leadId: string): string {
  return `${campaignId}:${leadId}`;
}

export function resolveDashboardEngine(input: {
  subscriptionStatus: string | null;
  activeChannelCount: number;
  activeCampaignCount: number;
}): { status: EngineStatus; label: string; detail: string } {
  if (input.subscriptionStatus !== "active") {
    return {
      status: "needs_attention",
      label: "Billing needs attention",
      detail: "Activate your subscription before outreach can run.",
    };
  }

  if (input.activeChannelCount === 0) {
    return {
      status: "needs_attention",
      label: "Connect a channel",
      detail: "Connect at least one healthy channel before launching outreach.",
    };
  }

  if (input.activeCampaignCount === 0) {
    return {
      status: "ready",
      label: "Ready to launch",
      detail: "Your workspace is configured. Create and launch a campaign when ready.",
    };
  }

  return {
    status: "running",
    label: "Acquisition engine running",
    detail: "Your active campaign is progressing through its outreach sequence.",
  };
}

export function sortDashboardActivity(items: DashboardActivity[]): DashboardActivity[] {
  return items.sort((left, right) => right.occurredAt.getTime() - left.occurredAt.getTime());
}

function buildDashboardActivity(input: {
  messages: ActivityMessage[];
  leads: ActivityLead[];
  videos: ActivityVideo[];
  campaigns: ActivityCampaign[];
}): DashboardActivity[] {
  return sortDashboardActivity([
    ...input.messages.map((message) => {
      const name = leadName(message.lead);
      const direction = message.direction === "inbound" ? "Reply received" : "Outreach sent";
      return {
        id: `message:${message.id}`,
        kind: "message" as const,
        title: `${direction} ${message.direction === "inbound" ? "from" : "to"} ${name}`,
        detail: `${message.channel} · ${message.campaign.name}`,
        occurredAt: message.createdAt,
        avatarUrl: message.lead.avatarUrl,
        channel: message.channel,
      };
    }),
    ...input.leads.map((lead) => ({
      id: `lead:${lead.id}`,
      kind: "prospect" as const,
      title: `Prospect added: ${leadName(lead)}`,
      detail: lead.company || "Company not provided",
      occurredAt: lead.createdAt,
      avatarUrl: lead.avatarUrl,
    })),
    ...input.videos.map((video) => ({
      id: `video:${video.id}`,
      kind: "video" as const,
      title: video.needsReview
        ? "Video needs review"
        : video.status === "failed"
          ? "Video generation failed"
          : video.status === "ready" || video.status === "approved"
            ? "Video ready"
            : "Video generation updated",
      detail: video.lead
        ? `For ${leadName(video.lead)}`
        : video.campaign?.name ?? "Campaign video",
      occurredAt: video.updatedAt,
      avatarUrl: video.lead?.avatarUrl ?? null,
    })),
    ...input.campaigns.map((campaign) => ({
      id: `campaign:${campaign.id}`,
      kind: "campaign" as const,
      title: `${campaign.name} is ${campaign.status}`,
      detail: `${campaign._count.leads} enrolled ${campaign._count.leads === 1 ? "prospect" : "prospects"}`,
      occurredAt: campaign.updatedAt,
    })),
  ]);
}

export const dashboardRoutes: FastifyPluginAsync = async (app) => {
  app.get("/dashboard/overview", async (request, reply) => {
    const orgId = requireOrgId(request);

    const [
      organization,
      prospectCount,
      outreachInProgress,
      replyCount,
      meetingCount,
      sentOutreachCount,
      activeCampaignCount,
      campaigns,
      channels,
      failedVideoCount,
      reviewVideoCount,
      recentMessages,
      recentLeads,
      recentVideos,
    ] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: orgId },
        select: { name: true, subscriptionStatus: true, stripeCustomerId: true },
      }),
      prisma.lead.count({ where: { orgId } }),
      prisma.campaignLead.count({
        where: { campaign: { orgId }, status: "active" },
      }),
      prisma.lead.count({ where: { orgId, status: "replied" } }),
      prisma.lead.count({ where: { orgId, status: "meeting" } }),
      prisma.message.count({ where: { orgId, direction: "outbound" } }),
      prisma.campaign.count({ where: { orgId, status: "active" } }),
      prisma.campaign.findMany({
        where: { orgId, status: { in: ["active", "draft", "review"] } },
        orderBy: { updatedAt: "desc" },
        take: 12,
        select: {
          id: true,
          name: true,
          status: true,
          channels: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { leads: true } },
        },
      }),
      prisma.socialAccount.findMany({
        where: { orgId },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          platform: true,
          accountName: true,
          avatarUrl: true,
          status: true,
        },
      }),
      prisma.videoAsset.count({ where: { orgId, status: "failed" } }),
      prisma.videoAsset.count({ where: { orgId, needsReview: true } }),
      prisma.message.findMany({
        where: { orgId },
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true,
          direction: true,
          channel: true,
          status: true,
          createdAt: true,
          lead: { select: { firstName: true, lastName: true, company: true, avatarUrl: true } },
          campaign: { select: { name: true } },
        },
      }),
      prisma.lead.findMany({
        where: { orgId },
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          company: true,
          avatarUrl: true,
          createdAt: true,
        },
      }),
      prisma.videoAsset.findMany({
        where: { orgId },
        orderBy: { updatedAt: "desc" },
        take: 8,
        select: {
          id: true,
          status: true,
          needsReview: true,
          updatedAt: true,
          campaign: { select: { name: true } },
          lead: { select: { firstName: true, lastName: true, avatarUrl: true } },
        },
      }),
    ]);

    const activeChannels = channels.filter((channel) => channel.status === "active");
    const primaryCampaign =
      campaigns.find((campaign) => campaign.status === "active") ?? campaigns[0] ?? null;
    const engine = resolveDashboardEngine({
      subscriptionStatus: organization?.subscriptionStatus ?? null,
      activeChannelCount: activeChannels.length,
      activeCampaignCount,
    });

    const attention = [
      ...(organization?.subscriptionStatus === "active"
        ? []
        : [{
            kind: "billing" as const,
            title: "Subscription needs attention",
            detail: "Activate your subscription to run outreach.",
          }]),
      ...(activeChannels.length === 0
        ? [{
            kind: "channels" as const,
            title: "No active channels",
            detail: "Connect a healthy channel before launching outreach.",
          }]
        : channels
            .filter((channel) => channel.status !== "active")
            .map((channel) => ({
              kind: "channels" as const,
              title: `${channel.platform} needs attention`,
              detail: `${channel.accountName} is ${channel.status}.`,
            }))),
      ...(activeCampaignCount === 0
        ? [{
            kind: "campaign" as const,
            title: "No active campaign",
            detail: "Review your strategy, then create and launch a campaign.",
          }]
        : []),
      ...(failedVideoCount > 0
        ? [{
            kind: "video" as const,
            title: `${failedVideoCount} video ${failedVideoCount === 1 ? "asset has" : "assets have"} failed`,
            detail: "Review the affected campaign before sending outreach.",
          }]
        : []),
      ...(reviewVideoCount > 0
        ? [{
            kind: "video" as const,
            title: `${reviewVideoCount} video ${reviewVideoCount === 1 ? "asset needs" : "assets need"} review`,
            detail: "Quality review is required before those videos can be used.",
          }]
        : []),
    ];

    const activity = buildDashboardActivity({
      messages: recentMessages,
      leads: recentLeads,
      videos: recentVideos,
      campaigns,
    }).slice(0, 8);

    return reply.send({
      organization: {
        name: organization?.name ?? "LeadReacher workspace",
        subscriptionStatus: organization?.subscriptionStatus ?? null,
        hasBillingPortal: Boolean(organization?.stripeCustomerId),
      },
      engine,
      metrics: {
        prospects: prospectCount,
        outreachInProgress,
        replies: replyCount,
        meetingsBooked: meetingCount,
        outreachSent: sentOutreachCount,
      },
      primaryCampaign: primaryCampaign
        ? {
            id: primaryCampaign.id,
            name: primaryCampaign.name,
            status: primaryCampaign.status,
            channels: primaryCampaign.channels,
            prospectCount: primaryCampaign._count.leads,
            createdAt: primaryCampaign.createdAt,
            updatedAt: primaryCampaign.updatedAt,
          }
        : null,
      channels,
      attention,
      activity,
    });
  });

  app.get("/dashboard/activity", async (request, reply) => {
    const orgId = requireOrgId(request);
    const query = ActivityListQuerySchema.parse(request.query);
    const sourceLimit = Math.min(100, query.limit + query.offset + 20);
    const [messages, leads, videos, campaigns] = await Promise.all([
      prisma.message.findMany({
        where: { orgId },
        orderBy: { createdAt: "desc" },
        take: sourceLimit,
        select: {
          id: true,
          direction: true,
          channel: true,
          createdAt: true,
          lead: { select: { firstName: true, lastName: true, company: true, avatarUrl: true } },
          campaign: { select: { name: true } },
        },
      }),
      prisma.lead.findMany({
        where: { orgId },
        orderBy: { createdAt: "desc" },
        take: sourceLimit,
        select: { id: true, firstName: true, lastName: true, company: true, avatarUrl: true, createdAt: true },
      }),
      prisma.videoAsset.findMany({
        where: { orgId },
        orderBy: { updatedAt: "desc" },
        take: sourceLimit,
        select: {
          id: true,
          status: true,
          needsReview: true,
          updatedAt: true,
          campaign: { select: { name: true } },
          lead: { select: { firstName: true, lastName: true, avatarUrl: true } },
        },
      }),
      prisma.campaign.findMany({
        where: { orgId },
        orderBy: { updatedAt: "desc" },
        take: sourceLimit,
        select: { id: true, name: true, status: true, updatedAt: true, _count: { select: { leads: true } } },
      }),
    ]);
    const all = buildDashboardActivity({ messages, leads, videos, campaigns });
    const filtered = query.kind === "all" ? all : all.filter((item) => item.kind === query.kind);
    return reply.send({
      activity: filtered.slice(query.offset, query.offset + query.limit),
      total: filtered.length,
      limit: query.limit,
      offset: query.offset,
    });
  });

  app.get("/dashboard/prospects", async (request, reply) => {
    const orgId = requireOrgId(request);
    const query = ProspectListQuerySchema.parse(request.query);
    const where = prospectListWhere(orgId, query);
    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        orderBy: [{ reviewStatus: "asc" }, { createdAt: "desc" }],
        take: query.limit,
        skip: query.offset,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          title: true,
          company: true,
          location: true,
          linkedinUrl: true,
          email: true,
          phone: true,
          avatarUrl: true,
          source: true,
          status: true,
          reviewStatus: true,
          reviewedAt: true,
          createdAt: true,
          updatedAt: true,
          campaigns: {
            select: {
              id: true,
              status: true,
              campaign: { select: { id: true, name: true, status: true } },
            },
            orderBy: { createdAt: "desc" },
            take: 3,
          },
          messages: {
            select: { createdAt: true },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      }),
      prisma.lead.count({ where }),
    ]);

    return reply.send({
      leads: leads.map((lead) => ({
        ...lead,
        lastActivityAt: lead.messages[0]?.createdAt ?? lead.updatedAt,
        campaigns: lead.campaigns.map((membership) => ({
          campaignLeadId: membership.id,
          campaignLeadStatus: membership.status,
          ...membership.campaign,
        })),
        messages: undefined,
      })),
      total,
      limit: query.limit,
      offset: query.offset,
    });
  });

  app.get("/dashboard/prospects/:leadId", async (request, reply) => {
    const orgId = requireOrgId(request);
    const { leadId } = request.params as { leadId: string };
    const lead = await prisma.lead.findFirst({
      where: { id: leadId, orgId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        title: true,
        company: true,
        industry: true,
        companySize: true,
        location: true,
        linkedinUrl: true,
        email: true,
        phone: true,
        avatarUrl: true,
        source: true,
        status: true,
        reviewStatus: true,
        reviewedAt: true,
        tags: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
        campaigns: {
          select: {
            id: true,
            status: true,
            currentStep: true,
            linkedinChatId: true,
            createdAt: true,
            campaign: { select: { id: true, name: true, status: true } },
          },
          orderBy: { createdAt: "desc" },
        },
        messages: {
          select: {
            id: true,
            campaignId: true,
            direction: true,
            origin: true,
            status: true,
            content: true,
            sentAt: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 12,
        },
        videoAssets: {
          select: { id: true, status: true, videoUrl: true, thumbnailUrl: true, updatedAt: true },
          orderBy: { updatedAt: "desc" },
          take: 6,
        },
      },
    });
    if (!lead) throw new NotFoundError("Prospect");

    return reply.send({
      lead: {
        ...lead,
        messages: lead.messages.map((message) => ({
          ...message,
          content: messageContent(message.content),
          occurredAt: message.sentAt ?? message.createdAt,
        })),
      },
    });
  });

  app.patch("/dashboard/prospects/:leadId/review", async (request, reply) => {
    const orgId = requireOrgId(request);
    const { leadId } = request.params as { leadId: string };
    const body = ReviewProspectSchema.parse(request.body);
    const existing = await prisma.lead.findFirst({ where: { id: leadId, orgId }, select: { id: true } });
    if (!existing) throw new NotFoundError("Prospect");

    const lead = await prisma.lead.update({
      where: { id: leadId },
      data: { reviewStatus: body.reviewStatus, reviewedAt: new Date() },
      select: { id: true, reviewStatus: true, reviewedAt: true },
    });
    return reply.send({ lead });
  });

  app.post("/dashboard/prospects/review", async (request, reply) => {
    const orgId = requireOrgId(request);
    const body = BulkReviewProspectsSchema.parse(request.body);
    const result = await prisma.lead.updateMany({
      where: { id: { in: [...new Set(body.leadIds)] }, orgId },
      data: { reviewStatus: body.reviewStatus, reviewedAt: new Date() },
    });
    return reply.send({ updated: result.count, reviewStatus: body.reviewStatus });
  });

  app.get("/dashboard/conversations", async (request, reply) => {
    const orgId = requireOrgId(request);
    const query = ConversationListQuerySchema.parse(request.query);
    const campaignLeads = await prisma.campaignLead.findMany({
      where: {
        linkedinChatId: { not: null },
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
        status: true,
        lead: { select: { firstName: true, lastName: true, title: true, company: true, avatarUrl: true } },
        campaign: {
          select: {
            id: true,
            name: true,
            senderAccount: { select: { id: true, accountName: true, platform: true, status: true, unipileId: true } },
          },
        },
      },
    });

    if (campaignLeads.length === 0) {
      return reply.send({ conversations: [], total: 0, limit: query.limit, offset: query.offset });
    }

    const messages = await prisma.message.findMany({
      where: {
        orgId,
        campaignId: { in: [...new Set(campaignLeads.map((item) => item.campaignId))] },
        leadId: { in: [...new Set(campaignLeads.map((item) => item.leadId))] },
        channel: "linkedin",
      },
      select: {
        id: true,
        campaignId: true,
        leadId: true,
        direction: true,
        status: true,
        origin: true,
        content: true,
        readAt: true,
        handledAt: true,
        sentAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const messagesByConversation = new Map<string, typeof messages>();
    for (const message of messages) {
      const key = conversationKey(message.campaignId, message.leadId);
      const current = messagesByConversation.get(key) ?? [];
      current.push(message);
      messagesByConversation.set(key, current);
    }

    const conversations = campaignLeads.flatMap((campaignLead) => {
      const conversationMessages = messagesByConversation.get(conversationKey(campaignLead.campaignId, campaignLead.leadId)) ?? [];
      const latest = conversationMessages[0];
      if (!latest) return [];
      const unreadCount = conversationMessages.filter((message) => message.direction === "inbound" && message.readAt === null).length;
      const needsReply = conversationMessages.some((message) => message.direction === "inbound" && message.handledAt === null);
      if (query.state === "unread" && unreadCount === 0) return [];
      if (query.state === "needs_reply" && !needsReply) return [];
      return [{
        id: campaignLead.id,
        campaignLeadStatus: campaignLead.status,
        chatId: campaignLead.linkedinChatId,
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

    return reply.send({
      conversations: conversations.slice(query.offset, query.offset + query.limit),
      total: conversations.length,
      limit: query.limit,
      offset: query.offset,
    });
  });

  app.get("/dashboard/conversations/:campaignLeadId", async (request, reply) => {
    const orgId = requireOrgId(request);
    const { campaignLeadId } = request.params as { campaignLeadId: string };
    const campaignLead = await prisma.campaignLead.findFirst({
      where: { id: campaignLeadId, campaign: { orgId } },
      select: {
        id: true,
        campaignId: true,
        leadId: true,
        status: true,
        currentStep: true,
        linkedinChatId: true,
        lead: {
          select: {
            firstName: true,
            lastName: true,
            title: true,
            company: true,
            location: true,
            linkedinUrl: true,
            avatarUrl: true,
            status: true,
          },
        },
        campaign: {
          select: {
            id: true,
            name: true,
            senderAccount: { select: { id: true, accountName: true, platform: true, status: true, unipileId: true } },
          },
        },
      },
    });
    if (!campaignLead) throw new NotFoundError("Conversation");

    const messages = await prisma.message.findMany({
      where: { orgId, campaignId: campaignLead.campaignId, leadId: campaignLead.leadId, channel: "linkedin" },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        content: true,
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
    await prisma.message.updateMany({
      where: { orgId, campaignId: campaignLead.campaignId, leadId: campaignLead.leadId, direction: "inbound", readAt: null },
      data: { readAt: new Date() },
    });

    const sender = campaignLead.campaign.senderAccount;
    const senderLimit = sender?.unipileId
      ? await getDailySendLimitStatus(sender.unipileId, "message")
      : null;
    const hasInboundMessage = messages.some((message) => message.direction === "inbound");

    return reply.send({
      conversation: {
        id: campaignLead.id,
        status: campaignLead.status,
        currentStep: campaignLead.currentStep,
        chatId: campaignLead.linkedinChatId,
        prospect: { ...campaignLead.lead, name: leadName(campaignLead.lead) },
        campaign: { id: campaignLead.campaign.id, name: campaignLead.campaign.name },
        sender,
        senderLimit,
        canReply: Boolean(hasInboundMessage && campaignLead.linkedinChatId && sender?.status === "active" && sender.unipileId),
        messages: messages.map((message) => ({
          ...message,
          content: messageContent(message.content),
          occurredAt: message.sentAt ?? message.createdAt,
        })),
      },
    });
  });

  app.post("/dashboard/conversations/:campaignLeadId/drafts", async (request, reply) => {
    const orgId = requireOrgId(request);
    const { campaignLeadId } = request.params as { campaignLeadId: string };
    const campaignLead = await prisma.campaignLead.findFirst({
      where: { id: campaignLeadId, campaign: { orgId } },
      select: {
        campaignId: true,
        leadId: true,
        lead: { select: { firstName: true, lastName: true, company: true } },
        campaign: { select: { name: true } },
      },
    });
    if (!campaignLead) throw new NotFoundError("Conversation");
    const messages = await prisma.message.findMany({
      where: { orgId, campaignId: campaignLead.campaignId, leadId: campaignLead.leadId, channel: "linkedin" },
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
      conversation: messages.map((message) => ({ direction: message.direction === "inbound" ? "inbound" : "outbound", content: jsonText(message.content) || "Message content unavailable" })),
    });
    return reply.send(result);
  });

  app.post("/dashboard/conversations/:campaignLeadId/replies", async (request, reply) => {
    const orgId = requireOrgId(request);
    const { campaignLeadId } = request.params as { campaignLeadId: string };
    const body = OperatorReplyBodySchema.parse(request.body);
    const existingReply = await prisma.message.findFirst({
      where: { orgId, idempotencyKey: body.idempotencyKey },
      select: { id: true },
    });
    if (existingReply) {
      return reply.status(201).send({ messageId: existingReply.id });
    }
    const campaignLead = await prisma.campaignLead.findFirst({
      where: { id: campaignLeadId, campaign: { orgId } },
      select: {
        id: true,
        campaignId: true,
        leadId: true,
        linkedinChatId: true,
        lead: { select: { id: true } },
        campaign: {
          select: {
            senderAccount: { select: { id: true, status: true, unipileId: true } },
          },
        },
      },
    });
    if (!campaignLead) throw new NotFoundError("Conversation");
    if (!campaignLead.linkedinChatId) throw new ValidationError("This prospect does not have a LinkedIn chat yet");
    const sender = campaignLead.campaign.senderAccount;
    if (!sender || sender.status !== "active" || !sender.unipileId) {
      throw new ValidationError("This campaign needs an active LinkedIn sender before replying");
    }
    const hasInboundMessage = await prisma.message.count({
      where: { orgId, campaignId: campaignLead.campaignId, leadId: campaignLead.leadId, direction: "inbound" },
    });
    if (hasInboundMessage === 0) {
      throw new ValidationError("A prospect reply is required before sending an operator response");
    }
    const limit = await checkAndIncrementDailySendLimit(sender.unipileId, "message");
    if (!limit.allowed) {
      const status = await getDailySendLimitStatus(sender.unipileId, "message");
      throw new DailySendLimitError(status.resetAt);
    }

    const adapter = new UnipileAdapter({ dsn: env.UNIPILE_DSN, apiKey: env.UNIPILE_API_KEY });
    const result = await deliverOperatorMessage(adapter, {
      orgId,
      campaignId: campaignLead.campaignId,
      campaignLeadId: campaignLead.id,
      leadId: campaignLead.leadId,
      chatId: campaignLead.linkedinChatId,
      message: body.message,
      idempotencyKey: body.idempotencyKey,
    });
    return reply.status(201).send(result);
  });

  app.get("/dashboard/messages", async (request, reply) => {
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

  app.get("/dashboard/analytics", async (request, reply) => {
    const orgId = requireOrgId(request);
    const [messages, leads, campaigns] = await Promise.all([
      prisma.message.findMany({
        where: { orgId },
        select: { direction: true, status: true, channel: true, createdAt: true },
      }),
      prisma.lead.findMany({
        where: { orgId },
        select: { status: true },
      }),
      prisma.campaign.findMany({
        where: { orgId },
        select: { id: true, name: true, status: true, _count: { select: { leads: true } } },
        orderBy: { updatedAt: "desc" },
      }),
    ]);

    const outbound = messages.filter((message) => message.direction === "outbound");
    const inbound = messages.filter((message) => message.direction === "inbound");
    const delivered = outbound.filter((message) => ["sent", "delivered", "opened", "replied"].includes(message.status)).length;
    const channelCounts = new Map<string, { sent: number; received: number }>();
    for (const message of messages) {
      const current = channelCounts.get(message.channel) ?? { sent: 0, received: 0 };
      if (message.direction === "outbound") current.sent += 1;
      else current.received += 1;
      channelCounts.set(message.channel, current);
    }

    return reply.send({
      totals: {
        sent: outbound.length,
        received: inbound.length,
        delivered,
        replies: leads.filter((lead) => lead.status === "replied").length,
        meetings: leads.filter((lead) => lead.status === "meeting").length,
      },
      channels: [...channelCounts.entries()].map(([channel, counts]) => ({ channel, ...counts })),
      campaigns: campaigns.map((campaign) => ({
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        prospectCount: campaign._count.leads,
      })),
    });
  });

  app.get("/dashboard/analytics/insights", async (request, reply) => {
    const orgId = requireOrgId(request);
    const cached = await readCachedAnalyticsInsights(orgId);
    if (cached) {
      return reply.send(cached);
    }

    const sentCount = await prisma.message.count({
      where: {
        orgId,
        direction: "outbound",
        status: { in: ["sent", "delivered", "opened", "replied"] },
      },
    });
    if (sentCount === 0) {
      return reply.send({
        status: "no_data",
        whatsWorking: [],
        whatsNotWorking: [],
        whatToDoNext: [],
      });
    }

    await analyticsInsightsQueue.add(
      QUEUE_ANALYTICS_INSIGHTS,
      { orgId },
      {
        jobId: `analytics-insights:${orgId}`,
        removeOnComplete: true,
        removeOnFail: 100,
      },
    );
    return reply.send({
      status: "aggregating",
      whatsWorking: [],
      whatsNotWorking: [],
      whatToDoNext: [],
    });
  });

  app.get("/dashboard/settings", async (request, reply) => {
    const orgId = requireOrgId(request);
    const organization = await prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        name: true,
        plan: true,
        subscriptionStatus: true,
        currentPeriodEnd: true,
        stripeCustomerId: true,
      },
    });

    return reply.send({
      organization: organization
        ? {
            name: organization.name,
            plan: organization.plan,
            subscriptionStatus: organization.subscriptionStatus,
            currentPeriodEnd: organization.currentPeriodEnd,
            hasBillingPortal: Boolean(organization.stripeCustomerId),
          }
        : null,
    });
  });

  app.patch("/dashboard/settings", async (request, reply) => {
    const orgId = requireOrgId(request);
    const { organizationName } = UpdateDashboardSettingsSchema.parse(request.body);
    const organization = await prisma.organization.update({
      where: { id: orgId },
      data: { name: organizationName },
      select: { name: true, plan: true, subscriptionStatus: true, currentPeriodEnd: true, stripeCustomerId: true },
    });

    return reply.send({
      organization: {
        name: organization.name,
        plan: organization.plan,
        subscriptionStatus: organization.subscriptionStatus,
        currentPeriodEnd: organization.currentPeriodEnd,
        hasBillingPortal: Boolean(organization.stripeCustomerId),
      },
    });
  });
};
