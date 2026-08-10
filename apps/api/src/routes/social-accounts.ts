import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import {
  encodeHostedAuthName,
  isAccountHealthy,
  UnipileAdapter,
} from "../adapters/unipile.js";
import { env } from "../config/env.js";
import { UNIPILE_CONNECT_PROVIDERS, normalizeUnipilePlatform } from "../lib/channels.js";
import { ValidationError } from "../lib/errors.js";
import {
  ErrorResponseSchema,
  authenticatedRoute,
  errorResponses
} from "../lib/openapi.js";
import { prisma } from "../lib/prisma.js";
import { invalidateDashboardChrome } from "../lib/dashboard-cache.js";
import { requireOrgId } from "../lib/request-org.js";
import { resolveWebhookUrl } from "../lib/webhook-url.js";
import { getDailySendLimitStatus } from "../lib/rate-limiter.js";
import { overviewMetricTrend, resolveOverviewDateRange } from "./dashboard.js";

const ConnectSocialAccountBodySchema = z.object({
  provider: z.enum(UNIPILE_CONNECT_PROVIDERS).default("LINKEDIN"),
  returnTo: z.enum(["onboarding", "home", "dashboard"]).default("onboarding"),
});

const SocialAccountsQuerySchema = z.object({
  startDate: z.string().date().optional(),
  endDate: z.string().date().optional(),
});

type ChannelMetricBucket = {
  messagesSent: number;
  prospectsReached: number;
  leadIds: Set<string>;
};

function emptyBucket(): ChannelMetricBucket {
  return { messagesSent: 0, prospectsReached: 0, leadIds: new Set() };
}

function metricsForCampaigns(
  messages: Array<{ campaignId: string; channel: string; leadId: string }>,
  campaignIds: Set<string>,
  platform: string,
): ChannelMetricBucket {
  const bucket = emptyBucket();
  for (const message of messages) {
    if (!campaignIds.has(message.campaignId) || message.channel.toLowerCase() !== platform) continue;
    bucket.messagesSent += 1;
    bucket.leadIds.add(message.leadId);
  }
  bucket.prospectsReached = bucket.leadIds.size;
  return bucket;
}

function getHostedAuthNotifyUrl(): string {
  try {
    return resolveWebhookUrl({
      UNIPILE_WEBHOOK_URL: env.UNIPILE_WEBHOOK_URL,
      PUBLIC_BASE_URL: env.PUBLIC_BASE_URL,
    });
  } catch (error) {
    throw new ValidationError(
      error instanceof Error ? error.message : "Unipile webhook URL is not configured",
    );
  }
}

async function resolveAccountStatus(
  adapter: UnipileAdapter,
  accountId: string,
): Promise<"active" | "error"> {
  try {
    const status = await adapter.getAccountStatus(accountId);
    return isAccountHealthy(status) ? "active" : "error";
  } catch {
    return "error";
  }
}

function channelsRedirect(returnTo: "onboarding" | "home" | "dashboard", status: "connected" | "failed"): string {
  if (returnTo === "onboarding") {
    return `${env.APP_URL}/onboarding?step=channels&status=${status}`;
  }
  return `${env.APP_URL}/dashboard/channels?status=${status}`;
}

export async function socialAccountRoutes(app: FastifyInstance): Promise<void> {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.get("/social-accounts", {
    schema: {
      ...authenticatedRoute("SocialAccounts", "List connected social accounts with channel metrics"),
      querystring: SocialAccountsQuerySchema,
    },
  }, async (request, reply) => {
    const orgId = requireOrgId(request);
    const query = request.query;
    const range = resolveOverviewDateRange({
      startDate: query.startDate,
      endDate: query.endDate,
      activityKind: "all",
    });
    const currentDateWhere = { gte: range.start, lte: range.end };
    const previousDateWhere = { gte: range.previousStart, lte: range.previousEnd };

    const [accounts, currentOutbound, previousOutbound] = await Promise.all([
      prisma.socialAccount.findMany({
        where: { orgId },
        select: {
          id: true,
          platform: true,
          accountName: true,
          avatarUrl: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          unipileId: true,
          metadata: true,
          campaignChannelAccounts: {
            select: {
              channel: true,
              campaign: { select: { id: true, name: true, status: true } },
            },
          },
          senderCampaigns: {
            select: { id: true, name: true, status: true },
          },
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.message.findMany({
        where: {
          orgId,
          direction: "outbound",
          createdAt: currentDateWhere,
        },
        select: { campaignId: true, channel: true, leadId: true },
      }),
      prisma.message.findMany({
        where: {
          orgId,
          direction: "outbound",
          createdAt: previousDateWhere,
        },
        select: { campaignId: true, channel: true, leadId: true },
      }),
    ]);

    const enrichedAccounts = await Promise.all(accounts.map(async (account) => {
      const platform = account.platform.toLowerCase();
      const explicitCampaigns = (account.campaignChannelAccounts ?? [])
        .filter((assignment) => assignment.channel.toLowerCase() === platform)
        .map((assignment) => assignment.campaign);
      const legacyCampaigns = platform === "linkedin" ? (account.senderCampaigns ?? []) : [];
      const assignedCampaigns = Array.from(
        new Map([...explicitCampaigns, ...legacyCampaigns].map((campaign) => [campaign.id, campaign])).values(),
      );
      const campaignIds = new Set(assignedCampaigns.map((campaign) => campaign.id));
      const metrics = metricsForCampaigns(currentOutbound, campaignIds, platform);
      const health = account.status === "active" ? "healthy" : account.status === "disconnected" ? "disconnected" : "needs_attention";
      const capacity = platform === "linkedin" && account.unipileId
        ? await Promise.all([
            getDailySendLimitStatus(account.unipileId, "invite"),
            getDailySendLimitStatus(account.unipileId, "message"),
          ]).then(([invites, messages]) => ({ invites, messages }))
        : null;
      return {
        id: account.id,
        platform: account.platform,
        accountName: account.accountName,
        avatarUrl: account.avatarUrl,
        status: account.status,
        providerType:
          typeof account.metadata === "object" &&
          account.metadata !== null &&
          !Array.isArray(account.metadata) &&
          typeof (account.metadata as Record<string, unknown>).providerType === "string"
            ? (account.metadata as Record<string, unknown>).providerType
            : null,
        createdAt: account.createdAt,
        updatedAt: account.updatedAt,
        health,
        messagesSent: metrics.messagesSent,
        prospectsReached: metrics.prospectsReached,
        assignedCampaigns: assignedCampaigns.map((campaign) => ({
          id: campaign.id,
          name: campaign.name,
          status: campaign.status,
        })),
        capacity,
      };
    }));

    const connectedAccounts = accounts.filter((account) => account.status !== "disconnected");
    const monitoredAccounts = accounts.filter((account) => account.status !== "disconnected");
    const healthyAccounts = accounts.filter((account) => account.status === "active");
    const healthyPercent = monitoredAccounts.length === 0
      ? 100
      : Math.round((healthyAccounts.length / monitoredAccounts.length) * 100);

    const messagesSent = currentOutbound.length;
    const previousMessagesSent = previousOutbound.length;
    const prospectsReached = new Set(currentOutbound.map((message) => message.leadId)).size;
    const previousProspectsReached = new Set(previousOutbound.map((message) => message.leadId)).size;
    const previousConnected = previousOutbound.length > 0 ? connectedAccounts.length : 0;

    const summary = {
      connectedChannels: connectedAccounts.length,
      healthyPercent,
      messagesSent,
      prospectsReached,
      trends: {
        connectedChannels: overviewMetricTrend(connectedAccounts.length, previousConnected),
        healthyPercent: overviewMetricTrend(healthyPercent, monitoredAccounts.length === 0 ? 100 : healthyPercent),
        messagesSent: overviewMetricTrend(messagesSent, previousMessagesSent),
        prospectsReached: overviewMetricTrend(prospectsReached, previousProspectsReached),
      },
    };

    return reply.send({
      accounts: enrichedAccounts,
      summary,
      range: {
        startDate: range.start.toISOString().slice(0, 10),
        endDate: range.end.toISOString().slice(0, 10),
      },
    });
  });

  r.post("/social-accounts/connect", {
    schema: {
      ...authenticatedRoute("SocialAccounts", "Create Unipile hosted-auth connect link"),
      body: ConnectSocialAccountBodySchema,
    },
  }, async (request, reply) => {
    const orgId = requireOrgId(request);
    const { provider, returnTo } = request.body;
    const adapter = new UnipileAdapter({
      dsn: env.UNIPILE_DSN,
      apiKey: env.UNIPILE_API_KEY,
    });
    const resolvedReturnTo = returnTo === "home" ? "dashboard" : returnTo;
    const link = await adapter.createHostedAuthLink({
      providers: [provider],
      name: encodeHostedAuthName(orgId),
      notifyUrl: getHostedAuthNotifyUrl(),
      successRedirectUrl: channelsRedirect(resolvedReturnTo, "connected"),
      failureRedirectUrl: channelsRedirect(resolvedReturnTo, "failed"),
      expiresOn: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    });

    return reply.send({ url: link.url });
  });

  r.post("/social-accounts/sync", {
    schema: {
      ...authenticatedRoute("SocialAccounts", "Sync Unipile accounts into SocialAccount rows"),
    },
  }, async (request, reply) => {
    const orgId = requireOrgId(request);

    const adapter = new UnipileAdapter({
      dsn: env.UNIPILE_DSN,
      apiKey: env.UNIPILE_API_KEY,
    });

    const result = await adapter.listAccounts();
    const items = result.items ?? [];
    const accountsByExternalId = new Map(
      (await prisma.socialAccount.findMany({
        where: { orgId },
        select: { id: true, platform: true, platformUserId: true, unipileId: true, status: true },
      })).flatMap((account) => {
        const keys = [account.platformUserId, account.unipileId].filter(
          (value): value is string => Boolean(value),
        );
        return keys.map((key) => [key, account] as const);
      }),
    );
    let synced = 0;

    for (const account of items) {
      if (!account.id || !account.type) {
        request.log.warn(
          {
            orgId,
            unipileAccountId: account.id ?? null,
            unipileAccountType: account.type ?? null,
            reason: "malformed-account",
          },
          "Skipped unattributable Unipile account during organization sync",
        );
        continue;
      }

      const platform = normalizeUnipilePlatform(account.type);
      const ownedAccount = accountsByExternalId.get(account.id);
      // Unipile's account list is shared by the API key. Never create or
      // mutate an organization row from an unowned external account.
      if (!ownedAccount || ownedAccount.platform !== platform) {
        request.log.warn(
          {
            orgId,
            unipileAccountId: account.id,
            platform,
            reason: ownedAccount ? "platform-mismatch" : "unknown-account",
          },
          "Skipped unattributable Unipile account during organization sync",
        );
        continue;
      }
      const accountStatus = await resolveAccountStatus(adapter, account.id);

      await prisma.socialAccount.update({
        where: { id: ownedAccount.id },
        data: {
          unipileId: account.id,
          accountName: account.name ?? account.id,
          status: accountStatus,
          metadata: { providerType: account.type.toLowerCase() },
        },
      });

      synced += 1;
    }

    await invalidateDashboardChrome(orgId);
    return reply.send({ synced });
  });
}
