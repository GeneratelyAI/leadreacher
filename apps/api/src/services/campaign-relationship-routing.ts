import { UnipileAdapter } from "../adapters/unipile.js";
import type { UnipileProfile } from "../adapters/types.js";
import { env } from "../config/env.js";
import { ValidationError } from "../lib/errors.js";
import { leadLinkedinIdentifier } from "../lib/linkedin-identifier.js";
import { prisma } from "../lib/prisma.js";
import { isConnectedProfile } from "../lib/relation-status.js";

const LINKEDIN_RELATIONSHIPS = [
  "unknown",
  "connected",
  "invite_required",
  "unresolved",
] as const;

export type LinkedInRelationship = (typeof LINKEDIN_RELATIONSHIPS)[number];

export type CampaignRelationshipSummary = {
  total: number;
  directMessage: number;
  inviteRequired: number;
  unresolved: number;
  unknown: number;
  checked: number;
};

const MAX_PROFILES_PER_REFRESH = 250;
const REFRESH_CONCURRENCY = 5;

export async function getCampaignRelationshipSummary(input: {
  campaignId: string;
  senderId: string | null;
  total?: number;
}): Promise<CampaignRelationshipSummary> {
  const total = input.total ?? await prisma.campaignLead.count({
    where: { campaignId: input.campaignId },
  });

  if (!input.senderId || total === 0) {
    return {
      total,
      directMessage: 0,
      inviteRequired: 0,
      unresolved: 0,
      unknown: total,
      checked: 0,
    };
  }

  const groups = await prisma.campaignLead.groupBy({
    by: ["linkedinRelationship"],
    where: {
      campaignId: input.campaignId,
      relationshipSenderId: input.senderId,
    },
    _count: { _all: true },
  });

  const count = (relationship: LinkedInRelationship) =>
    groups.find((group) => group.linkedinRelationship === relationship)?._count._all ?? 0;
  const directMessage = count("connected");
  const inviteRequired = count("invite_required");
  const unresolved = count("unresolved");
  const checked = directMessage + inviteRequired + unresolved;

  return {
    total,
    directMessage,
    inviteRequired,
    unresolved,
    unknown: Math.max(0, total - checked),
    checked,
  };
}

export async function refreshCampaignRelationshipRouting(input: {
  campaignId: string;
  orgId: string;
  sender: { id: string; unipileId: string };
  cursor?: string;
  adapter?: Pick<UnipileAdapter, "getProfile">;
}): Promise<CampaignRelationshipSummary & { processed: number; hasMore: boolean; nextCursor: string | null }> {
  if (input.cursor) {
    const scopedCursor = await prisma.campaignLead.findFirst({
      where: {
        id: input.cursor,
        campaignId: input.campaignId,
        campaign: { orgId: input.orgId },
      },
      select: { id: true },
    });
    if (!scopedCursor) {
      throw new ValidationError("Invalid relationship refresh cursor");
    }
  }

  const enrollmentPage = await prisma.campaignLead.findMany({
    where: { campaignId: input.campaignId, campaign: { orgId: input.orgId } },
    orderBy: { id: "asc" },
    take: MAX_PROFILES_PER_REFRESH + 1,
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    select: {
      id: true,
      leadId: true,
      lead: {
        select: {
          linkedinUrl: true,
          providerLinkedinId: true,
        },
      },
    },
  });
  const hasMore = enrollmentPage.length > MAX_PROFILES_PER_REFRESH;
  const enrollments = enrollmentPage.slice(0, MAX_PROFILES_PER_REFRESH);
  const total = await prisma.campaignLead.count({
    where: { campaignId: input.campaignId, campaign: { orgId: input.orgId } },
  });
  const adapter = input.adapter ?? new UnipileAdapter({
    apiKey: env.UNIPILE_API_KEY,
  });
  let nextIndex = 0;

  async function classifyNext(): Promise<void> {
    while (nextIndex < enrollments.length) {
      const enrollment = enrollments[nextIndex];
      nextIndex += 1;
      const identifier = leadLinkedinIdentifier(enrollment.lead);
      if (!identifier) {
        await prisma.campaignLead.update({
          where: { id: enrollment.id },
          data: {
            linkedinRelationship: "unresolved",
            relationshipCheckedAt: new Date(),
            relationshipSenderId: input.sender.id,
          },
        });
        continue;
      }

      let profile: UnipileProfile;
      try {
        profile = await adapter.getProfile(input.sender.unipileId, identifier);
      } catch {
        await prisma.campaignLead.update({
          where: { id: enrollment.id },
          data: {
            linkedinRelationship: "unresolved",
            relationshipCheckedAt: new Date(),
            relationshipSenderId: input.sender.id,
          },
        });
        continue;
      }

      const connected = isConnectedProfile(profile);
      const relationshipUpdate = prisma.campaignLead.update({
        where: { id: enrollment.id },
        data: {
          linkedinRelationship: connected ? "connected" : "invite_required",
          relationshipCheckedAt: new Date(),
          relationshipSenderId: input.sender.id,
        },
      });
      if (!enrollment.lead.providerLinkedinId && profile.provider_id) {
        await prisma.$transaction([
          relationshipUpdate,
          prisma.lead.update({
            where: { id: enrollment.leadId },
            data: { providerLinkedinId: profile.provider_id },
          }),
        ]);
      } else {
        await relationshipUpdate;
      }
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(REFRESH_CONCURRENCY, enrollments.length) },
      () => classifyNext(),
    ),
  );

  return {
    ...await getCampaignRelationshipSummary({
      campaignId: input.campaignId,
      senderId: input.sender.id,
      total,
    }),
    processed: enrollments.length,
    hasMore,
    nextCursor: hasMore ? enrollments.at(-1)?.id ?? null : null,
  };
}
