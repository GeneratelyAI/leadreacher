import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import {
  analyticsInsightsQueue,
  QUEUE_ANALYTICS_INSIGHTS,
} from "../lib/queue.js";
import { requireOrgId } from "../lib/request-org.js";
import { readCachedAnalyticsInsights } from "../services/analytics-insights.js";

type EngineStatus = "running" | "ready" | "needs_attention";

type DashboardActivity = {
  id: string;
  kind: "message" | "prospect" | "video" | "campaign";
  title: string;
  detail: string;
  occurredAt: Date;
};

const UpdateDashboardSettingsSchema = z.object({
  organizationName: z.string().trim().min(1).max(120),
});

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

function leadName(lead: { firstName: string; lastName: string }): string {
  return `${lead.firstName} ${lead.lastName}`.trim() || "A prospect";
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
          lead: { select: { firstName: true, lastName: true, company: true } },
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
          lead: { select: { firstName: true, lastName: true } },
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

    const activity = sortDashboardActivity([
      ...recentMessages.map((message) => {
        const name = leadName(message.lead);
        const direction = message.direction === "inbound" ? "Reply received" : "Outreach sent";
        return {
          id: `message:${message.id}`,
          kind: "message" as const,
          title: `${direction} ${message.direction === "inbound" ? "from" : "to"} ${name}`,
          detail: `${message.channel} · ${message.campaign.name}`,
          occurredAt: message.createdAt,
        };
      }),
      ...recentLeads.map((lead) => ({
        id: `lead:${lead.id}`,
        kind: "prospect" as const,
        title: `Prospect added: ${leadName(lead)}`,
        detail: lead.company || "Company not provided",
        occurredAt: lead.createdAt,
      })),
      ...recentVideos.map((video) => ({
        id: `video:${video.id}`,
        kind: "video" as const,
        title: video.needsReview
          ? "Video needs review"
          : video.status === "failed"
            ? "Video generation failed"
            : video.status === "ready" || video.status === "approved"
              ? "Video ready"
              : "Video generation updated",
        detail:
          video.lead
            ? `For ${leadName(video.lead)}`
            : video.campaign?.name ?? "Campaign video",
        occurredAt: video.updatedAt,
      })),
      ...campaigns.map((campaign) => ({
        id: `campaign:${campaign.id}`,
        kind: "campaign" as const,
        title: `${campaign.name} is ${campaign.status}`,
        detail: `${campaign._count.leads} enrolled ${campaign._count.leads === 1 ? "prospect" : "prospects"}`,
        occurredAt: campaign.updatedAt,
      })),
    ]).slice(0, 8);

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
