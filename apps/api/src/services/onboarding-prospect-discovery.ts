import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { ValidationError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { searchAndImportLinkedInProspects } from "./prospect-search.js";

const ONBOARDING_PROSPECT_LIMIT = 25;

type JsonRecord = Record<string, unknown>;

export type OnboardingDiscoveryStatus = "queued" | "running" | "completed" | "failed";

export type OnboardingDiscovery = {
  status: OnboardingDiscoveryStatus;
  prospectCount: number;
  error?: string;
  updatedAt: string;
};

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function recordString(record: JsonRecord, key: string): string {
  const value = record[key];
  return typeof value === "string" ? value.trim() : "";
}

function recordStringArray(record: JsonRecord, key: string): string[] {
  const value = record[key];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function onboardingKeywords(filters: JsonRecord, idealCustomer: string): string[] {
  const configuredKeywords = recordStringArray(filters, "keywords");
  if (configuredKeywords.length > 0) return configuredKeywords;
  if (recordStringArray(filters, "jobTitles").length > 0) return [];
  return idealCustomer ? [idealCustomer] : [];
}

function onboardingProspectSearchInput(icpDefinition: unknown) {
  const icp = asRecord(icpDefinition);
  const analysis = asRecord(icp.audienceAnalysis);
  const filters = asRecord(analysis.filters);
  const idealCustomer = recordString(icp, "idealCustomer");

  return {
    filters: {
      jobTitles: recordStringArray(filters, "jobTitles"),
      industries: recordStringArray(filters, "industries"),
      companySizes: recordStringArray(filters, "companySizes"),
      locations: recordStringArray(filters, "locations"),
      keywords: onboardingKeywords(filters, idealCustomer),
    },
    maxResults: ONBOARDING_PROSPECT_LIMIT,
  };
}

function relationshipFromEnrichment(
  enrichmentData: unknown,
): "connected" | "invite_required" | "unknown" {
  const distance = recordString(asRecord(enrichmentData), "networkDistance").toUpperCase();
  if (["FIRST_DEGREE", "DISTANCE_1"].includes(distance)) return "connected";
  if (["SECOND_DEGREE", "THIRD_DEGREE", "DISTANCE_2", "DISTANCE_3", "OUT_OF_NETWORK"].includes(distance)) {
    return "invite_required";
  }
  return "unknown";
}

export function onboardingStrategyFingerprint(input: {
  positioning: unknown;
  icpDefinition: unknown;
  messagingAngles: unknown;
  videoConfig: unknown;
}): string {
  const source = JSON.stringify({
    positioning: input.positioning,
    icpDefinition: input.icpDefinition,
    messagingAngles: input.messagingAngles,
    videoConfig: input.videoConfig,
  });
  return createHash("sha256").update(source).digest("hex");
}

export function readOnboardingDiscovery(aiConfig: unknown): OnboardingDiscovery | null {
  const discovery = asRecord(asRecord(aiConfig).onboardingDiscovery);
  const status = discovery.status;
  if (status !== "queued" && status !== "running" && status !== "completed" && status !== "failed") {
    return null;
  }
  const prospectCount = discovery.prospectCount;
  const updatedAt = recordString(discovery, "updatedAt");
  return {
    status,
    prospectCount: typeof prospectCount === "number" && Number.isFinite(prospectCount) ? prospectCount : 0,
    ...(recordString(discovery, "error") ? { error: recordString(discovery, "error") } : {}),
    updatedAt: updatedAt || new Date(0).toISOString(),
  };
}

export function withOnboardingDiscovery(
  aiConfig: unknown,
  discovery: Omit<OnboardingDiscovery, "updatedAt">,
): Prisma.InputJsonValue {
  return toJson({
    ...asRecord(aiConfig),
    onboardingDiscovery: {
      ...discovery,
      updatedAt: new Date().toISOString(),
    },
  });
}

async function enrollOnboardingAudience(input: {
  orgId: string;
  campaignId: string;
  senderId: string;
  discoveredLeadIds: string[];
}): Promise<number> {
  const leads = await prisma.lead.findMany({
    where: {
      orgId: input.orgId,
      id: { in: input.discoveredLeadIds },
      reviewStatus: { in: ["pending", "approved"] },
    },
    orderBy: { createdAt: "desc" },
    take: ONBOARDING_PROSPECT_LIMIT,
    select: { id: true, enrichmentData: true },
  });
  if (leads.length === 0) return 0;

  const result = await prisma.campaignLead.createMany({
    data: leads.map((lead) => {
      const relationship = relationshipFromEnrichment(lead.enrichmentData);
      const enrollment = { campaignId: input.campaignId, leadId: lead.id };
      return relationship === "unknown"
        ? enrollment
        : {
            ...enrollment,
            linkedinRelationship: relationship,
            relationshipCheckedAt: new Date(),
            relationshipSenderId: input.senderId,
          };
    }),
    skipDuplicates: true,
  });
  return result.count;
}

export async function runOnboardingProspectDiscovery(input: {
  orgId: string;
  campaignId: string;
}): Promise<{ prospectCount: number }> {
  const campaign = await prisma.campaign.findFirst({
    where: { id: input.campaignId, orgId: input.orgId },
    select: {
      id: true,
      status: true,
      aiConfig: true,
      socialAccountId: true,
      strategyId: true,
      _count: { select: { leads: true } },
    },
  });
  if (!campaign) throw new ValidationError("Campaign preparation could not be found.");
  if (campaign.status === "active") return { prospectCount: campaign._count.leads };
  if (!campaign.socialAccountId || !campaign.strategyId) {
    throw new ValidationError("This campaign needs an active LinkedIn sender and strategy before prospect discovery.");
  }

  if (campaign._count.leads > 0) {
    await prisma.campaign.update({
      where: { id: campaign.id },
      data: { aiConfig: withOnboardingDiscovery(campaign.aiConfig, { status: "completed", prospectCount: campaign._count.leads }) },
    });
    return { prospectCount: campaign._count.leads };
  }

  await prisma.campaign.update({
    where: { id: campaign.id },
    data: { aiConfig: withOnboardingDiscovery(campaign.aiConfig, { status: "running", prospectCount: 0 }) },
  });

  try {
    const strategy = await prisma.strategy.findFirst({
      where: { id: campaign.strategyId, orgId: input.orgId },
      select: { icpDefinition: true },
    });
    if (!strategy) throw new ValidationError("The strategy for this campaign could not be found.");

    const { leadIds: discoveredLeadIds } = await searchAndImportLinkedInProspects(
      input.orgId,
      onboardingProspectSearchInput(strategy.icpDefinition),
      { socialAccountId: campaign.socialAccountId },
    );
    const prospectCount = await enrollOnboardingAudience({
      orgId: input.orgId,
      campaignId: campaign.id,
      senderId: campaign.socialAccountId,
      discoveredLeadIds,
    });
    if (prospectCount === 0) {
      throw new ValidationError(
        "LinkedIn returned no prospects matching this strategy. Adjust the target roles and try again.",
      );
    }

    await prisma.campaign.update({
      where: { id: campaign.id },
      data: { aiConfig: withOnboardingDiscovery(campaign.aiConfig, { status: "completed", prospectCount }) },
    });
    return { prospectCount };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to find prospects from LinkedIn.";
    await prisma.campaign.update({
      where: { id: campaign.id },
      data: { aiConfig: withOnboardingDiscovery(campaign.aiConfig, { status: "failed", prospectCount: 0, error: message }) },
    });
    throw error;
  }
}
