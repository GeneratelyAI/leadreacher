import type { Prisma, Strategy } from "@prisma/client";
import {
  ApifyAdapter,
  type CompanySearchResult,
  type ICPFilters,
  type ScrapedCompany,
  type ScrapedProfile,
} from "../adapters/apify.js";
import { resolveCompanyHeadcountCodes } from "../adapters/linkedin-company-size-codes.js";
import { resolveIndustryIds } from "../adapters/linkedin-industry-codes.js";
import { env } from "../config/env.js";
import { ExternalServiceError, ValidationError } from "../lib/errors.js";
import { logOperationalInfo } from "../lib/operational-logger.js";
import { prisma } from "../lib/prisma.js";
import { redis } from "../lib/redis.js";
import { importScrapedProfiles } from "./lead-import.js";
import {
  buildCompanySearchPlan,
  COMPANY_SEARCH_NO_RESULTS_REASON,
  buildStrategyFilters,
  COMPANY_SEARCH_UNAVAILABLE_REASON,
} from "../routes/strategy-filters.js";

type DiscoveryScrapeStatus = {
  status: "idle" | "running" | "completed" | "failed";
  url: string | null;
  market: string;
  offer: string;
  audience: string;
  value: string;
  strategyStatus: string;
  error: string | null;
  updatedAt: string;
};

type ChannelKey = "linkedin" | "email" | "whatsapp" | "instagram" | "facebook";

type ChannelRecommendation = {
  channel: ChannelKey;
  label: string;
  confidence: number;
  signalCount: number;
  totalProfiles: number;
  tag: string;
  description: string;
};

type StrategyIcpDefinition = {
  idealCustomer?: unknown;
  audienceAnalysis?: {
    status: "completed" | "failed";
    error?: string;
    generatedAt: string;
    companies: {
      status: "available" | "unavailable";
      reason?: string;
      totalFound: number;
      sampleSize: number;
    };
    decisionMakers: {
      totalFound: number;
      sampleSize: number;
      prospectLeadIds?: string[];
    };
    reachability: {
      percentage: number;
      reachableProfiles: number;
      totalProfiles: number;
    };
    topIndustries: Array<{
      industry: string;
      count: number;
      percentage: number;
    }>;
    topBuyerPersonas: Array<{
      title: string;
      count: number;
    }>;
    filters: ICPFilters & {
      resolvedIndustryIds: number[];
      resolvedCompanyHeadcount: string[];
    };
  };
};

type AudienceAnalysis = NonNullable<StrategyIcpDefinition["audienceAnalysis"]>;

type StrategyChannels = {
  suggestedChannels?: unknown;
  recommendations?: ChannelRecommendation[];
};

function getScrapeStatusKey(orgId: string): string {
  return `discovery:scrape:${orgId}`;
}

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function recordString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === "string" ? value.trim() : "";
}

export function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

async function getScrapeStatus(orgId: string): Promise<DiscoveryScrapeStatus | null> {
  const raw = await redis.get(getScrapeStatusKey(orgId));
  if (!raw) return null;

  try {
    return JSON.parse(raw) as DiscoveryScrapeStatus;
  } catch {
    return null;
  }
}

export function hasCompletedAudienceAnalysis(strategy: Strategy): boolean {
  const icpDefinition = asRecord(strategy.icpDefinition);
  const audienceAnalysis = asRecord(icpDefinition.audienceAnalysis);
  return audienceAnalysis.status === "completed";
}

function percentage(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

function normalizeIndustry(value: string | undefined): string {
  return value?.trim() || "Unknown";
}

function topIndustries(companies: ScrapedCompany[]): AudienceAnalysis["topIndustries"] {
  const counts = new Map<string, number>();
  for (const company of companies) {
    const industry = normalizeIndustry(company.industry);
    counts.set(industry, (counts.get(industry) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([industry, count]) => ({
      industry,
      count,
      percentage: percentage(count, companies.length),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

function normalizeTitle(title: string): string {
  const cleaned = title
    .split(/\s+at\s+|\s+\|\s+|\s+-\s+/i)[0]
    ?.replace(/\s+/g, " ")
    .trim();
  return cleaned || "Unknown title";
}

function normalizedRoleTitle(value: string): string {
  return value
    .toLowerCase()
    .replace(/chief\s+executive\s+officer/g, "ceo")
    .replace(/chief\s+marketing\s+officer/g, "cmo")
    .replace(/vice\s+president/g, "vp")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function titleMatchesRequestedRole(title: string, requestedTitles: readonly string[]): boolean {
  const normalizedTitle = normalizedRoleTitle(title);
  return requestedTitles.some((requestedTitle) => {
    const normalizedRequested = normalizedRoleTitle(requestedTitle);
    return normalizedRequested.length > 0 && normalizedTitle.includes(normalizedRequested);
  });
}

function filterTargetedProfiles(
  profiles: ScrapedProfile[],
  requestedTitles: readonly string[],
): ScrapedProfile[] {
  if (requestedTitles.length === 0) return profiles;

  const matchingProfiles = profiles.filter((profile) =>
    titleMatchesRequestedRole(profile.title, requestedTitles),
  );
  if (matchingProfiles.length === 0) {
    throw new ValidationError(
      "The audience provider returned profiles outside the selected decision-maker roles. Retry the analysis to run the corrected targeting query.",
    );
  }

  return matchingProfiles;
}

export function topBuyerPersonas(
  profiles: ScrapedProfile[],
): AudienceAnalysis["topBuyerPersonas"] {
  const counts = new Map<string, number>();
  for (const profile of profiles) {
    const title = normalizeTitle(profile.title);
    counts.set(title, (counts.get(title) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([title, count]) => ({ title, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);
}

function isValidLinkedInUrl(value: string | undefined): boolean {
  return typeof value === "string" && /^https:\/\/(www\.)?linkedin\.com\/in\//i.test(value);
}

function hasText(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function hasProfileEnrichmentSignal(
  profile: ScrapedProfile,
  keys: readonly string[],
): boolean {
  return keys.some((key) => {
    const value = profile.enrichmentData[key];
    if (typeof value === "string") return value.trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
    return Boolean(value && typeof value === "object");
  });
}

export function resolveCompanySearchOutcome(
  companyResult: PromiseSettledResult<CompanySearchResult>,
): CompanySearchResult {
  if (companyResult.status === "fulfilled") return companyResult.value;

  return {
    companies: [],
    totalFound: 0,
    skipped: true,
    reason: COMPANY_SEARCH_UNAVAILABLE_REASON,
  };
}

function buildChannelRecommendations(profiles: ScrapedProfile[]): ChannelRecommendation[] {
  const total = profiles.length;
  const linkedinCount = profiles.filter((profile) => isValidLinkedInUrl(profile.linkedinUrl)).length;
  const emailCount = profiles.filter((profile) => hasText(profile.email)).length;
  const phoneCount = profiles.filter((profile) => hasText(profile.phone)).length;
  const instagramCount = profiles.filter((profile) =>
    hasProfileEnrichmentSignal(profile, ["instagramUsername", "instagramUrl", "instagram"]),
  ).length;
  const facebookCount = profiles.filter((profile) =>
    hasProfileEnrichmentSignal(profile, ["facebookUsername", "facebookUrl", "facebook"]),
  ).length;

  const recommendations: ChannelRecommendation[] = [
    {
      channel: "linkedin",
      label: "LinkedIn",
      confidence: percentage(linkedinCount, total),
      signalCount: linkedinCount,
      totalProfiles: total,
      tag: `${linkedinCount}/${total} profiles have LinkedIn URLs`,
      description: "Best for connecting with decision makers and building trust.",
    },
    {
      channel: "email",
      label: "Email",
      confidence: percentage(emailCount, total),
      signalCount: emailCount,
      totalProfiles: total,
      tag: `${emailCount}/${total} profiles include email data`,
      description: "Best when verified emails are available for direct follow-up.",
    },
    {
      channel: "whatsapp",
      label: "WhatsApp",
      confidence: percentage(phoneCount, total),
      signalCount: phoneCount,
      totalProfiles: total,
      tag: `${phoneCount}/${total} profiles include phone data`,
      description: "Useful when phone coverage is present in the scraped profiles.",
    },
    {
      channel: "instagram",
      label: "Instagram",
      confidence: percentage(instagramCount, total),
      signalCount: instagramCount,
      totalProfiles: total,
      tag: `${instagramCount}/${total} profiles include Instagram data`,
      description: "Useful when Instagram identities are available for direct messaging.",
    },
    {
      channel: "facebook",
      label: "Facebook",
      confidence: percentage(facebookCount, total),
      signalCount: facebookCount,
      totalProfiles: total,
      tag: `${facebookCount}/${total} profiles include Facebook data`,
      description: "Useful when Facebook identities are available for direct messaging.",
    },
  ];

  return recommendations
    .filter((recommendation) => recommendation.signalCount > 0)
    .sort((a, b) => b.confidence - a.confidence);
}

async function writeFilterAuditLog(input: {
  orgId: string;
  userId?: string;
  strategyId: string;
  filters: ICPFilters;
  companySearchFilters: ICPFilters;
  companySearchAvailable: boolean;
  companySearchReason?: string;
  resolvedIndustryIds: number[];
  resolvedCompanyHeadcount: string[];
}): Promise<void> {
  logOperationalInfo("strategy-apify-filters", {
    orgId: input.orgId,
    strategyId: input.strategyId,
    filters: input.filters,
    resolvedIndustryIds: input.resolvedIndustryIds,
    resolvedCompanyHeadcount: input.resolvedCompanyHeadcount,
  });

  await prisma.auditLog.create({
    data: {
      orgId: input.orgId,
      userId: input.userId,
      action: "strategy.generate.filters",
      resource: "Strategy",
      resourceId: input.strategyId,
      metadata: toJson({
        filters: input.filters,
        companySearchFilters: input.companySearchFilters,
        companySearchAvailable: input.companySearchAvailable,
        companySearchReason: input.companySearchReason,
        resolvedIndustryIds: input.resolvedIndustryIds,
        resolvedCompanyHeadcount: input.resolvedCompanyHeadcount,
      }),
    },
  });
}

async function markStrategyGenerationFailed(
  strategy: Strategy,
  message: string,
): Promise<Strategy> {
  const icpDefinition = asRecord(strategy.icpDefinition);
  return prisma.strategy.update({
    where: { id: strategy.id },
    data: {
      icpDefinition: toJson({
        ...icpDefinition,
        audienceAnalysis: {
          status: "failed",
          error: message,
          generatedAt: new Date().toISOString(),
        },
      }),
    },
  });
}

async function scrapeDecisionMakersWithFallback(
  adapter: ApifyAdapter,
  filters: ICPFilters,
): Promise<{ profiles: ScrapedProfile[]; totalFound: number; filtersUsed: ICPFilters }> {
  const primary = await adapter.scrapeLeadsWithTotal(filters, 25, {
    profileScraperMode: "Full",
  });
  if (primary.profiles.length > 0 || filters.jobTitles.length === 0) {
    return { ...primary, filtersUsed: filters };
  }

  const keywordFallback: ICPFilters = {
    ...filters,
    jobTitles: [],
    keywords: filters.jobTitles,
  };
  const fallback = await adapter.scrapeLeadsWithTotal(keywordFallback, 25, {
    profileScraperMode: "Full",
  });
  return {
    ...fallback,
    filtersUsed: fallback.profiles.length > 0 ? keywordFallback : filters,
  };
}

function getDiscoveryInputs(
  strategy: Strategy,
  scrapeStatus: DiscoveryScrapeStatus | null,
): {
  market: string;
  offer: string;
  audience: string;
  value: string;
  competitiveAdvantage: string;
} {
  const positioning = asRecord(strategy.positioning);
  const icpDefinition = asRecord(strategy.icpDefinition);
  const market = scrapeStatus?.status === "completed"
    ? scrapeStatus.market
    : recordString(positioning, "industry");
  const offer = scrapeStatus?.status === "completed"
    ? scrapeStatus.offer
    : recordString(positioning, "businessModel");
  const audience = scrapeStatus?.status === "completed"
    ? scrapeStatus.audience
    : recordString(icpDefinition, "idealCustomer");
  const value = scrapeStatus?.status === "completed" ? scrapeStatus.value : "";
  const competitiveAdvantage = recordString(positioning, "strengths");

  if (!market || !offer || !audience || !competitiveAdvantage) {
    throw new ValidationError(
      "Discovery data is incomplete. Complete the discovery step before generating strategy.",
    );
  }
  return { market, offer, audience, value, competitiveAdvantage };
}

export async function generateStrategy(
  strategy: Strategy,
  orgId: string,
  userId?: string,
): Promise<Strategy> {
  const scrapeStatus = await getScrapeStatus(orgId);
  const discovery = getDiscoveryInputs(strategy, scrapeStatus);
  const filters = buildStrategyFilters({
    market: discovery.market,
    audience: discovery.audience,
    offer: discovery.offer,
    competitiveAdvantage: discovery.competitiveAdvantage,
  });
  const resolvedIndustryIds = resolveIndustryIds(filters.industries);
  const resolvedCompanyHeadcount = resolveCompanyHeadcountCodes(filters.companySizes);
  const companySearchPlan = buildCompanySearchPlan({
    filters,
    market: discovery.market,
    resolvedIndustryIds,
    resolvedCompanyHeadcount,
  });

  await writeFilterAuditLog({
    orgId,
    userId,
    strategyId: strategy.id,
    filters,
    companySearchFilters: companySearchPlan.filters,
    companySearchAvailable: companySearchPlan.canSearch,
    companySearchReason: companySearchPlan.reason,
    resolvedIndustryIds,
    resolvedCompanyHeadcount,
  });

  const adapter = new ApifyAdapter({ apiKey: env.APIFY_API_KEY });
  try {
    // A second company actor made onboarding wait for two independent Apify
    // queues. Decision-maker profiles are the required output; company-level
    // enrichment can happen after onboarding without blocking the customer.
    const companySearchPromise: Promise<CompanySearchResult> = Promise.resolve({
      companies: [],
      totalFound: 0,
      skipped: true,
      reason: companySearchPlan.canSearch
        ? "Company-level insights are enriched after onboarding."
        : (companySearchPlan.reason ?? COMPANY_SEARCH_UNAVAILABLE_REASON),
    });
    const profileSearchPromise = scrapeDecisionMakersWithFallback(adapter, filters);
    const [companyResult, profileResult] = await Promise.allSettled([
      companySearchPromise,
      profileSearchPromise,
    ]);
    if (profileResult.status === "rejected") {
      throw profileResult.reason instanceof Error
        ? profileResult.reason
        : new Error(String(profileResult.reason));
    }

    const { profiles, totalFound: profileTotalFound, filtersUsed: profileFilters } = profileResult.value;
    const profileIndustryIds = resolveIndustryIds(profileFilters.industries);
    const profileCompanyHeadcount = resolveCompanyHeadcountCodes(profileFilters.companySizes);

    if (companyResult.status === "rejected") {
      console.error(JSON.stringify({
        event: "strategy-company-search-failed",
        orgId,
        strategyId: strategy.id,
        error: companyResult.reason instanceof Error
          ? companyResult.reason.message
          : String(companyResult.reason),
      }));
    }
    const companySearch = resolveCompanySearchOutcome(companyResult);
    const { companies, totalFound: companyTotalFound } = companySearch;
    const companyDataUnavailable = companySearch.skipped || companies.length === 0 || companyTotalFound === 0;
    if (profiles.length === 0) {
      throw new ValidationError(
        "We couldn't find decision makers with the current audience filters. Broaden the market or target roles, add a location, then retry the analysis.",
      );
    }
    // Keyword fallback improves recall, but it must not broaden the audience
    // that reaches review. The original role filters remain the contract.
    const targetedProfiles = filterTargetedProfiles(profiles, filters.jobTitles);

    const importedAudience = await importScrapedProfiles(orgId, targetedProfiles);
    const reachableProfiles = targetedProfiles.filter((profile) => hasText(profile.email)).length;
    const icpDefinition = asRecord(strategy.icpDefinition) as StrategyIcpDefinition;
    const channels = asRecord(strategy.channels) as StrategyChannels;

    return await prisma.strategy.update({
      where: { id: strategy.id },
      data: {
        icpDefinition: toJson({
          ...icpDefinition,
          idealCustomer: icpDefinition.idealCustomer ?? discovery.audience,
          audienceAnalysis: {
            status: "completed",
            generatedAt: new Date().toISOString(),
            source: "apify",
            discovery,
            companies: {
              status: companyDataUnavailable ? "unavailable" : "available",
              ...(companyDataUnavailable && {
                reason: companySearch.skipped
                  ? (companySearch.reason ?? COMPANY_SEARCH_UNAVAILABLE_REASON)
                  : COMPANY_SEARCH_NO_RESULTS_REASON,
              }),
              totalFound: companyTotalFound,
              sampleSize: companies.length,
            },
            decisionMakers: {
              totalFound: profileTotalFound,
              sampleSize: targetedProfiles.length,
              prospectLeadIds: importedAudience.leadIds,
            },
            reachability: {
              percentage: percentage(reachableProfiles, targetedProfiles.length),
              reachableProfiles,
              totalProfiles: targetedProfiles.length,
            },
            topIndustries: companyDataUnavailable ? [] : topIndustries(companies),
            topBuyerPersonas: topBuyerPersonas(targetedProfiles),
            filters: {
              ...profileFilters,
              resolvedIndustryIds: profileIndustryIds,
              resolvedCompanyHeadcount: profileCompanyHeadcount,
            },
          },
        }),
        channels: toJson({
          ...channels,
          recommendations: buildChannelRecommendations(targetedProfiles),
        }),
        completedSteps: [...new Set([...strategy.completedSteps, 1])],
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await markStrategyGenerationFailed(strategy, message);
    if (error instanceof ValidationError || error instanceof ExternalServiceError) throw error;
    throw new ExternalServiceError("Apify", message);
  }
}
