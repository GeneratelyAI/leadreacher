/**
 * Remap persisted Unipile v1 account IDs to their transferred v2 account IDs.
 *
 * The operation is idempotent. It only updates SocialAccount rows whose
 * current external ID exactly matches metadata.v1_account_id returned by v2.
 */
import path from "node:path";
import { config } from "dotenv";
import { prisma } from "../lib/prisma.js";

config({ path: path.resolve(process.cwd(), ".env") });

type V2Account = {
  id: string;
  provider: string;
  name: string;
  status: string;
  metadata?: { v1_account_id?: string };
};

type V2AccountList = {
  data: V2Account[];
  has_more: boolean;
};

function requireApiKey(): string {
  const value = process.env.UNIPILE_API_KEY?.trim();
  if (!value) throw new Error("UNIPILE_API_KEY is required");
  return value;
}

function metadataRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

async function listTransferredAccounts(apiKey: string): Promise<V2Account[]> {
  const response = await fetch("https://api.unipile.com/v2/accounts/?limit=100", {
    headers: { "X-API-KEY": apiKey },
  });
  if (!response.ok) {
    throw new Error(`Unipile v2 account list failed with ${response.status}`);
  }
  const body = await response.json() as V2AccountList;
  if (body.has_more) {
    throw new Error("More than 100 Unipile accounts exist; pagination is required before migration");
  }
  return body.data;
}

async function main(): Promise<void> {
  const accounts = await listTransferredAccounts(requireApiKey());
  const mappings = accounts.flatMap((account) => {
    const v1AccountId = account.metadata?.v1_account_id;
    return v1AccountId ? [{ account, v1AccountId }] : [];
  });
  let migrated = 0;

  for (const { account, v1AccountId } of mappings) {
    const rows = await prisma.socialAccount.findMany({
      where: {
        OR: [
          { unipileId: v1AccountId },
          { platformUserId: v1AccountId },
        ],
      },
      select: { id: true, orgId: true, metadata: true },
    });

    for (const row of rows) {
      const emailThreads = await prisma.campaignLead.findMany({
        where: {
          campaign: { orgId: row.orgId },
          emailThreadKey: { startsWith: `${v1AccountId}:` },
        },
        select: { id: true, emailThreadKey: true },
      });
      await prisma.$transaction([
        prisma.socialAccount.update({
          where: { id: row.id },
          data: {
            unipileId: account.id,
            platformUserId: account.id,
            accountName: account.name,
            status: account.status === "running" ? "active" : "error",
            metadata: {
              ...metadataRecord(row.metadata),
              providerType: account.provider,
              unipileVersion: "v2",
              v1AccountId,
            },
          },
        }),
        ...emailThreads.flatMap((thread) => {
          if (!thread.emailThreadKey) return [];
          return [prisma.campaignLead.update({
            where: { id: thread.id },
            data: {
              emailThreadKey: `${account.id}:${thread.emailThreadKey.slice(v1AccountId.length + 1)}`,
            },
          })];
        }),
      ]);
      migrated += 1;
    }
  }

  const unmatchedLegacyRows = await prisma.socialAccount.findMany({
    where: {
      unipileId: { not: null },
      NOT: { unipileId: { startsWith: "acc_" } },
    },
    select: { id: true, metadata: true },
  });
  for (const row of unmatchedLegacyRows) {
    await prisma.socialAccount.update({
      where: { id: row.id },
      data: {
        status: "disconnected",
        metadata: {
          ...metadataRecord(row.metadata),
          unipileVersion: "v2",
          requiresV2Reconnect: true,
        },
      },
    });
  }
  const activeLegacyRows = await prisma.socialAccount.count({
    where: {
      status: { not: "disconnected" },
      unipileId: { not: null },
      NOT: { unipileId: { startsWith: "acc_" } },
    },
  });
  console.log(JSON.stringify({
    transferredAccounts: mappings.length,
    migratedRows: migrated,
    disconnectedUntransferredRows: unmatchedLegacyRows.length,
    activeLegacyRows,
  }, null, 2));
}

void main()
  .finally(() => prisma.$disconnect())
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
