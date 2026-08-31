import { Prisma, type Lead } from "@prisma/client";
import { UnipileAdapter } from "../adapters/unipile.js";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";

type InstagramLead = Pick<
  Lead,
  | "id"
  | "instagramUsername"
  | "instagramMessagingId"
  | "providerInstagramId"
  | "outreachSuppressedAt"
  | "enrichmentData"
>;

export type InstagramReachability = {
  total: number;
  reachable: number;
  unresolved: number;
  invalid: number;
  errors: number;
  suppressed: number;
};

function cleanUsername(value: string | null): string | null {
  const username = value?.trim().replace(/^@/, "");
  return username || null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function messagingIdFromProfile(profile: {
  messaging_identifier?: string;
  provider_messaging_id?: string;
}): string | null {
  return profile.messaging_identifier?.trim()
    || profile.provider_messaging_id?.trim()
    || null;
}

export async function resolveInstagramCampaignIdentities(input: {
  leads: InstagramLead[];
  unipileAccountId: string;
  adapter?: Pick<UnipileAdapter, "getProfile">;
}): Promise<InstagramReachability> {
  const adapter = input.adapter ?? new UnipileAdapter({
    apiKey: env.UNIPILE_API_KEY,
  });
  let reachable = 0;
  let unresolved = 0;
  let invalid = 0;
  let errors = 0;
  let suppressed = 0;

  // Resolve in small batches to avoid a burst against the connected account.
  for (let offset = 0; offset < input.leads.length; offset += 3) {
    const batch = input.leads.slice(offset, offset + 3);
    await Promise.all(batch.map(async (lead) => {
      if (lead.outreachSuppressedAt) {
        suppressed += 1;
        return;
      }
      if (lead.instagramMessagingId?.trim()) {
        reachable += 1;
        return;
      }
      const username = cleanUsername(lead.instagramUsername);
      if (!username) {
        unresolved += 1;
        return;
      }

      try {
        const profile = await adapter.getProfile(input.unipileAccountId, username);
        const messagingId = messagingIdFromProfile(profile);
        if (!messagingId) {
          invalid += 1;
          await prisma.lead.update({
            where: { id: lead.id },
            data: { instagramIdentityStatus: "invalid" },
          });
          return;
        }
        reachable += 1;
        await prisma.lead.update({
          where: { id: lead.id },
          data: {
            instagramUsername: username,
            instagramMessagingId: messagingId,
            providerInstagramId: profile.provider_id,
            instagramIdentityStatus: "resolved",
            enrichmentData: {
              ...asRecord(lead.enrichmentData),
              instagram: {
                username,
                ...(profile.headline?.trim() ? { headline: profile.headline.trim().slice(0, 500) } : {}),
              },
            } as Prisma.InputJsonValue,
          },
        });
      } catch {
        errors += 1;
        await prisma.lead.update({
          where: { id: lead.id },
          data: { instagramIdentityStatus: "error" },
        });
      }
    }));
  }

  return { total: input.leads.length, reachable, unresolved, invalid, errors, suppressed };
}
