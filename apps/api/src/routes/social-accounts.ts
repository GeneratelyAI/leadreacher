import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  encodeHostedAuthName,
  isAccountHealthy,
  UnipileAdapter,
} from "../adapters/unipile.js";
import { env } from "../config/env.js";
import { ValidationError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { requireOrgId } from "../lib/request-org.js";
import { resolveWebhookUrl } from "../lib/webhook-url.js";

const ConnectSocialAccountBodySchema = z.object({
  provider: z
    .enum(["LINKEDIN", "WHATSAPP", "GOOGLE", "MICROSOFT", "IMAP"])
    .default("LINKEDIN"),
  returnTo: z.enum(["onboarding", "home"]).default("onboarding"),
});

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

export async function socialAccountRoutes(app: FastifyInstance): Promise<void> {
  app.get("/social-accounts", async (request, reply) => {
    const orgId = requireOrgId(request);
    const accounts = await prisma.socialAccount.findMany({
      where: { orgId },
      select: {
        platform: true,
        accountName: true,
        avatarUrl: true,
        status: true,
      },
      orderBy: { createdAt: "asc" },
    });

    return reply.send({ accounts });
  });

  app.post("/social-accounts/connect", async (request, reply) => {
    const orgId = requireOrgId(request);
    const { provider, returnTo } = ConnectSocialAccountBodySchema.parse(request.body ?? {});
    const adapter = new UnipileAdapter({
      dsn: env.UNIPILE_DSN,
      apiKey: env.UNIPILE_API_KEY,
    });
    const link = await adapter.createHostedAuthLink({
      providers: [provider],
      name: encodeHostedAuthName(orgId),
      notifyUrl: getHostedAuthNotifyUrl(),
      successRedirectUrl:
        returnTo === "home"
          ? `${env.APP_URL}/home?view=channels&status=connected`
          : `${env.APP_URL}/onboarding?step=channels&status=connected`,
      failureRedirectUrl:
        returnTo === "home"
          ? `${env.APP_URL}/home?view=channels&status=failed`
          : `${env.APP_URL}/onboarding?step=channels&status=failed`,
      expiresOn: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    });

    return reply.send({ url: link.url });
  });

  app.post("/social-accounts/sync", async (request, reply) => {
    const orgId = requireOrgId(request);

    const adapter = new UnipileAdapter({
      dsn: env.UNIPILE_DSN,
      apiKey: env.UNIPILE_API_KEY,
    });

    const result = await adapter.listAccounts();
    const items = result.items ?? [];
    const syncedKeys = new Set<string>();
    let synced = 0;

    for (const account of items) {
      if (!account.id || !account.type) {
        continue;
      }

      const platform = account.type.toLowerCase();
      const accountStatus = await resolveAccountStatus(adapter, account.id);

      await prisma.socialAccount.upsert({
        where: {
          orgId_platform_platformUserId: {
            orgId,
            platform,
            platformUserId: account.id,
          },
        },
        create: {
          orgId,
          platform,
          platformUserId: account.id,
          unipileId: account.id,
          accountName: account.name ?? account.id,
          status: accountStatus,
        },
        update: {
          unipileId: account.id,
          accountName: account.name ?? account.id,
          status: accountStatus,
        },
      });

      syncedKeys.add(`${platform}:${account.id}`);
      synced += 1;
    }

    const existingAccounts = await prisma.socialAccount.findMany({
      where: { orgId },
    });

    for (const existing of existingAccounts) {
      const key = `${existing.platform}:${existing.platformUserId}`;
      if (!syncedKeys.has(key)) {
        await prisma.socialAccount.update({
          where: { id: existing.id },
          data: { status: "disconnected" },
        });
      }
    }

    return reply.send({ synced });
  });
}
