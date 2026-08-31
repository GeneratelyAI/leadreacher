import type {
  ProspectSearchInput,
  ProspectSearchResult,
} from "../adapters/prospect-search.js";
import { UnipileProspectSearchProvider } from "../adapters/unipile-prospect-search.js";
import { UnipileAdapter } from "../adapters/unipile.js";
import { env } from "../config/env.js";
import { ConflictError, ExternalServiceError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { importProspectProfiles } from "./lead-import.js";

type ProspectSearchOptions = {
  socialAccountId?: string;
};

export async function searchAndImportLinkedInProspects(
  orgId: string,
  input: ProspectSearchInput,
  options?: ProspectSearchOptions,
): Promise<{
  imported: number;
  skipped: number;
  total: number;
  totalFound: number;
  leadIds: string[];
}> {
  const result = await searchLinkedInProspects(orgId, input, options);
  const imported = await importProspectProfiles(orgId, result.profiles, "linkedin");

  return {
    imported: imported.imported,
    skipped: imported.skipped,
    total: result.profiles.length,
    totalFound: result.totalFound,
    leadIds: imported.leadIds,
  };
}

export async function searchLinkedInProspects(
  orgId: string,
  input: ProspectSearchInput,
  options?: ProspectSearchOptions,
): Promise<ProspectSearchResult> {
  const accounts = await prisma.socialAccount.findMany({
    where: {
      orgId,
      platform: "linkedin",
      status: "active",
      unipileId: { not: null },
      ...(options?.socialAccountId ? { id: options.socialAccountId } : {}),
    },
    select: { id: true, unipileId: true },
    orderBy: { updatedAt: "desc" },
  });

  if (accounts.length === 0) {
    throw new ConflictError(
      options?.socialAccountId
        ? "The selected LinkedIn sender is no longer active. Choose another sender before searching for prospects."
        : "Connect an active LinkedIn account before searching for prospects.",
    );
  }

  const adapter = new UnipileAdapter({
    apiKey: env.UNIPILE_API_KEY,
  });

  for (const account of accounts) {
    if (!account.unipileId) continue;
    const provider = new UnipileProspectSearchProvider(adapter, account.unipileId);
    try {
      return await provider.searchPeople(input);
    } catch (error) {
      if (!isUnavailableUnipileAccount(error)) throw error;

      // Hosted-auth callbacks can leave a stale account row after the provider
      // removes the temporary account. Do not present that row as connected.
      await prisma.socialAccount.update({
        where: { id: account.id },
        data: { status: "error" },
      });
    }
  }

  throw new ConflictError(
    "Your LinkedIn connection is no longer available. Reconnect LinkedIn in Channels, then try again.",
  );
}

function isUnavailableUnipileAccount(error: unknown): boolean {
  return error instanceof ExternalServiceError && /account not found/i.test(error.internalMessage);
}
