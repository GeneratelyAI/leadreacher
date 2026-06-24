import type { FastifyInstance } from "fastify";
import { isAccountHealthy, UnipileAdapter } from "../adapters/unipile.js";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { requireOrgId } from "../lib/request-org.js";

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
