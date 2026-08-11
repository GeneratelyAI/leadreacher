import type { Prisma, Strategy } from "@prisma/client";
import {
  type CompanySearchResult,
  type ICPFilters,
} from "../adapters/apify.js";
import type { ProspectProfile } from "../adapters/prospect-search.js";
import { resolveCompanyHeadcountCodes } from "../adapters/linkedin-company-size-codes.js";
import { resolveIndustryIds } from "../adapters/linkedin-industry-codes.js";
import { ValidationError } from "../lib/errors.js";
import { logOperationalInfo } from "../lib/operational-logger.js";
import { prisma } from "../lib/prisma.js";
import { redis } from "../lib/redis.js";
import {
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
  strategyBrief?: StrategyBrief;
  audienceAnalysis?: {
    status: "running" | "completed" | "failed";
    startedAt?: string;
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

export type StrategyBrief = {
  status: "ready";
  generatedAt: string;
  goal: string;
  market: string;
  audience: string;
  offer: string;
  valueProposition: string;
  decisionMakerRoles: string[];
  outreachAngles: Array<{
    title: string;
    description: string;
    opener: string;
  }>;
  executionPlan: Array<{
    step: number;
    title: string;
    description: string;
  }>;
  audienceSample?: {
    decisionMakers: number;
    topBuyerPersonas: string[];
  };
};

type StrategyChannels = {
  suggestedChannels?: unknown;
  recommendations?: ChannelRecommendation[];
};

const PRE_SEARCH_CHANNEL_RECOMMENDATIONS: ChannelRecommendation[] = [
  {
    channel: "linkedin",
    label: "LinkedIn",
    confidence: 95,
    signalCount: 0,
    totalProfiles: 0,
    tag: "Primary B2B discovery and outreach channel",
    description: "Connect LinkedIn to search decision makers and begin reviewed outreach.",
  },
  {
    channel: "email",
    label: "Email",
    confidence: 88,
    signalCount: 0,
    totalProfiles: 0,
    tag: "Reliable follow-up channel",
    description: "Use verified business email when it is available after enrichment.",
  },
  {
    channel: "whatsapp",
    label: "WhatsApp",
    confidence: 76,
    signalCount: 0,
    totalProfiles: 0,
    tag: "High-intent conversation channel",
    description: "Use only for prospects with a valid number and recorded messaging consent.",
  },
];

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

function getStoredDiscoveryInputs(strategy: Strategy): {
  market: string;
  offer: string;
  audience: string;
  competitiveAdvantage: string;
} {
  const positioning = asRecord(strategy.positioning);
  const icpDefinition = asRecord(strategy.icpDefinition);
  const market = recordString(positioning, "industry");
  const offer = recordString(positioning, "businessModel");
  const audience = recordString(icpDefinition, "idealCustomer");
  const competitiveAdvantage = recordString(positioning, "strengths");

  if (!market || !offer || !audience || !competitiveAdvantage) {
    throw new ValidationError(
      "Discovery data is incomplete. Complete the discovery step before generating strategy.",
    );
  }

  return { market, offer, audience, competitiveAdvantage };
}

/**
 * Builds the durable planning artifact synchronously from the customer's
 * Discovery answers. Prospect sourcing enriches this plan later, but it must
 * never be the first time a customer sees a strategy.
 */
export function buildStrategyBrief(strategy: Strategy): StrategyBrief {
  const discovery = getStoredDiscoveryInputs(strategy);
  const filters = buildStrategyFilters(discovery);
  const valueProposition = `${discovery.offer} for ${discovery.audience}, built around ${discovery.competitiveAdvantage}.`;
  const roles = filters.jobTitles.length > 0 ? filters.jobTitles : ["Founder", "CEO"];

  return {
    status: "ready",
    generatedAt: new Date().toISOString(),
    goal: `Start relevant conversations with ${discovery.audience} in ${discovery.market}.`,
    market: discovery.market,
    audience: discovery.audience,
    offer: discovery.offer,
    valueProposition,
    decisionMakerRoles: roles,
    outreachAngles: [
      {
        title: "Business outcome",
        description: `Lead with the outcome ${discovery.audience} can achieve with ${discovery.offer}.`,
        opener: `I noticed your team is focused on improving how ${discovery.audience} approach this work.`,
      },
      {
        title: "Relevant differentiation",
        description: `Make ${discovery.competitiveAdvantage} the proof point, not a generic product claim.`,
        opener: `We put together a short idea based on ${discovery.competitiveAdvantage}.`,
      },
      {
        title: "Low-friction next step",
        description: "Use a concise, personalized question that earns a reply before asking for time.",
        opener: "Would it be useful to compare notes on what this could look like for your team?",
      },
    ],
    executionPlan: [
      {
        step: 1,
        title: "Prioritize the right buyers",
        description: `Validate ${roles.join(", ")} roles at ${discovery.market} organizations that match your audience.`,
      },
      {
        step: 2,
        title: "Personalize the opening",
        description: "Use the buyer's company context to connect the first message to a credible business outcome.",
      },
      {
        step: 3,
        title: "Route and follow up",
        description: "Use the strongest available channel, then keep every reply and follow-up in one reviewable workflow.",
      },
    ],
  };
}

export function strategyBriefPersistence(strategy: Strategy, brief: StrategyBrief): {
  icpDefinition: Prisma.InputJsonValue;
  positioning: Prisma.InputJsonValue;
  messagingAngles: Prisma.InputJsonValue;
  executionPlan: Prisma.InputJsonValue;
} {
  const icpDefinition = asRecord(strategy.icpDefinition);
  const positioning = asRecord(strategy.positioning);
  const messagingAngles = asRecord(strategy.messagingAngles);

  return {
    icpDefinition: toJson({
      ...icpDefinition,
      idealCustomer: icpDefinition.idealCustomer ?? brief.audience,
      strategyBrief: brief,
    }),
    positioning: toJson({
      ...positioning,
      industry: recordString(positioning, "industry") || brief.market,
      businessModel: recordString(positioning, "businessModel") || brief.offer,
      strengths: recordString(positioning, "strengths"),
      valueProposition: brief.valueProposition,
      differentiator: recordString(positioning, "strengths"),
    }),
    messagingAngles: toJson({
      ...messagingAngles,
      valueProposition: brief.valueProposition,
      primaryAngle: brief.outreachAngles[0],
      outreachAngles: brief.outreachAngles,
    }),
    executionPlan: toJson(brief.executionPlan),
  };
}

function normalizeTitle(title: string): string {
  const cleaned = title
    .split(/\s+at\s+|\s+\|\s+|\s+-\s+/i)[0]
    ?.replace(/\s+/g, " ")
    .trim();
  return cleaned || "Unknown title";
}

export function topBuyerPersonas(
  profiles: ProspectProfile[],
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

async function writeFilterAuditLog(input: {
  orgId: string;
  userId?: string;
  strategyId: string;
  filters: ICPFilters;
  resolvedIndustryIds: number[];
  resolvedCompanyHeadcount: string[];
}): Promise<void> {
  logOperationalInfo("strategy-prospect-filters", {
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
        prospectSearchProvider: "connected_linkedin",
        resolvedIndustryIds: input.resolvedIndustryIds,
        resolvedCompanyHeadcount: input.resolvedCompanyHeadcount,
      }),
    },
  });
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
  await writeFilterAuditLog({
    orgId,
    userId,
    strategyId: strategy.id,
    filters,
    resolvedIndustryIds,
    resolvedCompanyHeadcount,
  });

  const icpDefinition = asRecord(strategy.icpDefinition) as StrategyIcpDefinition;
  const channels = asRecord(strategy.channels) as StrategyChannels;
  const strategyBrief = buildStrategyBrief(strategy);
  const persistedPlan = strategyBriefPersistence(strategy, strategyBrief);

  return prisma.strategy.update({
    where: { id: strategy.id },
    data: {
      ...persistedPlan,
      icpDefinition: toJson({
        ...icpDefinition,
        idealCustomer: icpDefinition.idealCustomer ?? discovery.audience,
        strategyBrief,
        audienceAnalysis: {
          status: "completed",
          source: "connected_linkedin",
          generatedAt: new Date().toISOString(),
          discovery,
          companies: {
            status: "unavailable",
            reason: "Company and prospect results become available after LinkedIn is connected.",
            totalFound: 0,
            sampleSize: 0,
          },
          decisionMakers: {
            totalFound: 0,
            sampleSize: 0,
            prospectLeadIds: [],
          },
          reachability: {
            percentage: 0,
            reachableProfiles: 0,
            totalProfiles: 0,
          },
          topIndustries: [],
          topBuyerPersonas: filters.jobTitles.map((title) => ({ title, count: 0 })),
          filters: {
            ...filters,
            resolvedIndustryIds,
            resolvedCompanyHeadcount,
          },
        },
      }),
      channels: toJson({
        ...channels,
        recommendations: PRE_SEARCH_CHANNEL_RECOMMENDATIONS,
      }),
      completedSteps: [...new Set([...strategy.completedSteps, 1])],
    },
  });
}
