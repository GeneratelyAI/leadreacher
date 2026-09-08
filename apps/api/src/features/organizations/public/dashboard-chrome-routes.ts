import { type FastifyInstance } from "fastify";
import { type ZodTypeProvider } from "fastify-type-provider-zod";
import { authenticatedRoute } from "../../../platform/http/openapi.js";
import { requireOrgId } from "../../../platform/auth/request-org.js";
import { readDashboardChrome, cacheDashboardChrome } from "../../../lib/dashboard-cache.js";
import { type DashboardChrome } from "../state/dashboard-chrome.js";
import { prisma } from "../../../platform/persistence/prisma.js";
import { resolvePlanDisplayLabel } from "../../billing/public/pricing.js";
import { resolveDashboardEngine } from "./workspace-status.js";
import { leadName } from "../../prospects/public/presentation.js";

export async function registerDashboardChromeRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();
  r.get("/dashboard/chrome", {
    schema: { ...authenticatedRoute("Dashboard", "Lightweight dashboard shell data") },
  }, async (request, reply) => {
    const orgId = requireOrgId(request);
    const cached = await readDashboardChrome<DashboardChrome>(orgId);
    if (cached) {
      reply.header("Cache-Control", "private, max-age=0");
      return reply.send(cached);
    }

    const [organization, activeChannelCount, activeCampaignCount, channels, unreadNotificationCount, messages] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: orgId },
        select: { name: true, plan: true, subscriptionStatus: true },
      }),
      prisma.socialAccount.count({ where: { orgId, status: "active" } }),
      prisma.campaign.count({ where: { orgId, status: "active" } }),
      prisma.socialAccount.findMany({
        where: { orgId },
        orderBy: { createdAt: "asc" },
        select: { id: true, platform: true, accountName: true, status: true },
      }),
      prisma.message.count({
        where: { orgId, direction: "inbound", readAt: null },
      }),
      prisma.message.findMany({
        where: { orgId },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          direction: true,
          channel: true,
          createdAt: true,
          lead: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
          campaign: { select: { name: true } },
        },
      }),
    ]);

    const value: DashboardChrome = {
      organization: { name: organization?.name ?? "Workspace", plan: resolvePlanDisplayLabel(organization?.plan) },
      engine: resolveDashboardEngine({
        subscriptionStatus: organization?.subscriptionStatus ?? null,
        activeChannelCount,
        activeCampaignCount,
      }),
      unreadNotificationCount,
      channels,
      activity: messages.map((message) => {
        const name = leadName(message.lead);
        const inbound = message.direction === "inbound";
        return {
          id: `message:${message.id}`,
          kind: "message" as const,
          title: `${inbound ? "Reply received from" : "Outreach sent to"} ${name}`,
          detail: `${message.channel} · ${message.campaign.name}`,
          occurredAt: message.createdAt,
          avatarUrl: message.lead.avatarUrl,
          channel: message.channel,
          action: inbound ? "reply" as const : "view" as const,
          href: inbound ? "/dashboard/messages?state=needs_reply" : `/dashboard/prospects/${message.lead.id}`,
        };
      }),
    };

    await cacheDashboardChrome(orgId, value);
    reply.header("Cache-Control", "private, max-age=0");
    return reply.send(value);
  });
}
