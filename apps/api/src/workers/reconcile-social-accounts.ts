import { isAccountHealthy, UnipileAdapter } from "../adapters/unipile.js";
import { env } from "../config/env.js";
import { logOperationalInfo } from "../lib/operational-logger.js";
import { prisma } from "../lib/prisma.js";

export async function reconcileSocialAccountStatuses(): Promise<{
  checked: number;
  updated: number;
  unmatched: number;
}> {
  const adapter = new UnipileAdapter({ apiKey: env.UNIPILE_API_KEY });
  const [providerResult, storedAccounts] = await Promise.all([
    adapter.listAccounts(),
    prisma.socialAccount.findMany({
      where: { unipileId: { not: null } },
      select: {
        id: true,
        unipileId: true,
        platformUserId: true,
        status: true,
      },
    }),
  ]);

  const providerAccounts = new Map(
    providerResult.items.flatMap((account) => {
      const legacyId = account.metadata?.v1_account_id;
      return [account.id, legacyId].filter(
        (value): value is string => Boolean(value),
      ).map((value) => [value, account] as const);
    }),
  );

  let updated = 0;
  let unmatched = 0;
  for (const stored of storedAccounts) {
    const provider = providerAccounts.get(stored.unipileId ?? "")
      ?? providerAccounts.get(stored.platformUserId);
    if (!provider) {
      unmatched += 1;
      continue;
    }

    const status = isAccountHealthy({
      id: provider.id,
      user_id: provider.user_id ?? "",
      type: provider.type,
      name: provider.name ?? provider.id,
      status: provider.status ?? "errored",
      metadata: provider.metadata,
    }) ? "active" : provider.status === "disconnected" ? "disconnected" : "error";

    if (stored.status !== status || stored.unipileId !== provider.id) {
      await prisma.socialAccount.update({
        where: { id: stored.id },
        data: {
          unipileId: provider.id,
          status,
        },
      });
      updated += 1;
    }
  }

  const result = { checked: storedAccounts.length, updated, unmatched };
  logOperationalInfo("reconcile-social-accounts", result);
  return result;
}
