import type { ChannelRecommendation } from "./channel-recommendations";

export type ChannelKey = ChannelRecommendation["channel"] | "gmail" | "outlook";
type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
type JsonRecord = { [key: string]: JsonValue };

const STALE_AUDIENCE_RUN_TIMEOUT_MS = 6 * 60_000;

export type StrategyResponse = {
  id: string;
  orgId: string;
  icpDefinition: JsonValue;
  channels: JsonValue;
  updatedAt: string;
};

export function selectedChannelsFromStrategy(strategy: StrategyResponse | null): ChannelKey[] {
  if (!strategy?.channels || typeof strategy.channels !== "object" || Array.isArray(strategy.channels)) return [];
  const selected = strategy.channels.selected;
  if (!Array.isArray(selected)) return [];
  return selected.flatMap((value): ChannelKey[] => {
    if (value === "email") return ["gmail"];
    return value === "linkedin" || value === "gmail" || value === "outlook" || value === "whatsapp" || value === "instagram" || value === "facebook" ? [value] : [];
  });
}

export type AudienceAnalysis = {
  status: "running" | "completed" | "failed";
  source?: "apify" | "connected_linkedin";
  startedAt?: string;
  error?: string;
  companies: {
    status: "available" | "unavailable";
    reason?: string;
    totalFound: number;
    sampleSize: number;
  };
  decisionMakers: {
    totalFound: number;
    sampleSize: number;
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
};

export type StrategyBrief = {
  status: "ready";
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

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toNumber(value: JsonValue | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function toStringValue(value: JsonValue | undefined): string {
  return typeof value === "string" ? value : "";
}

function getRecord(value: JsonValue | undefined): JsonRecord {
  return isRecord(value) ? value : {};
}

function stringArray(value: JsonValue | undefined): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

export function getAudienceAnalysis(strategy: StrategyResponse | null): AudienceAnalysis | null {
  const icpDefinition = getRecord(strategy?.icpDefinition);
  const analysis = getRecord(icpDefinition.audienceAnalysis);
  const status = analysis.status;
  if (status !== "running" && status !== "completed" && status !== "failed") {
    return null;
  }

  const companies = getRecord(analysis.companies);
  const decisionMakers = getRecord(analysis.decisionMakers);
  const reachability = getRecord(analysis.reachability);
  const topIndustries = Array.isArray(analysis.topIndustries)
    ? analysis.topIndustries.flatMap((item) => {
        if (!isRecord(item)) return [];
        const industry = toStringValue(item.industry);
        if (!industry) return [];
        return [{
          industry,
          count: toNumber(item.count),
          percentage: toNumber(item.percentage),
        }];
      })
    : [];
  const topBuyerPersonas = Array.isArray(analysis.topBuyerPersonas)
    ? analysis.topBuyerPersonas.flatMap((item) => {
        if (!isRecord(item)) return [];
        const title = toStringValue(item.title);
        if (!title) return [];
        return [{
          title,
          count: toNumber(item.count),
        }];
      })
    : [];

  return {
    status,
    source:
      analysis.source === "connected_linkedin" || analysis.source === "apify"
        ? analysis.source
        : undefined,
    startedAt: toStringValue(analysis.startedAt) || undefined,
    error: toStringValue(analysis.error) || undefined,
    companies: {
      status: toStringValue(companies.status) === "unavailable" ? "unavailable" : "available",
      reason: toStringValue(companies.reason) || undefined,
      totalFound: toNumber(companies.totalFound),
      sampleSize: toNumber(companies.sampleSize),
    },
    decisionMakers: {
      totalFound: toNumber(decisionMakers.totalFound),
      sampleSize: toNumber(decisionMakers.sampleSize),
    },
    reachability: {
      percentage: toNumber(reachability.percentage),
      reachableProfiles: toNumber(reachability.reachableProfiles),
      totalProfiles: toNumber(reachability.totalProfiles),
    },
    topIndustries,
    topBuyerPersonas,
  };
}

export function getStrategyBrief(strategy: StrategyResponse | null): StrategyBrief | null {
  const icpDefinition = getRecord(strategy?.icpDefinition);
  const brief = getRecord(icpDefinition.strategyBrief);
  if (brief.status !== "ready") return null;

  const goal = toStringValue(brief.goal);
  const market = toStringValue(brief.market);
  const audience = toStringValue(brief.audience);
  const offer = toStringValue(brief.offer);
  const valueProposition = toStringValue(brief.valueProposition);
  const decisionMakerRoles = stringArray(brief.decisionMakerRoles);
  if (!goal || !market || !audience || !offer || !valueProposition || !decisionMakerRoles.length) {
    return null;
  }

  const outreachAngles = Array.isArray(brief.outreachAngles)
    ? brief.outreachAngles.flatMap((item) => {
        if (!isRecord(item)) return [];
        const title = toStringValue(item.title);
        const description = toStringValue(item.description);
        const opener = toStringValue(item.opener);
        return title && description && opener ? [{ title, description, opener }] : [];
      })
    : [];
  const executionPlan = Array.isArray(brief.executionPlan)
    ? brief.executionPlan.flatMap((item) => {
        if (!isRecord(item)) return [];
        const step = toNumber(item.step);
        const title = toStringValue(item.title);
        const description = toStringValue(item.description);
        return step && title && description ? [{ step, title, description }] : [];
      })
    : [];
  const audienceSample = getRecord(brief.audienceSample);

  return {
    status: "ready",
    goal,
    market,
    audience,
    offer,
    valueProposition,
    decisionMakerRoles,
    outreachAngles,
    executionPlan,
    ...(Object.keys(audienceSample).length > 0 && {
      audienceSample: {
        decisionMakers: toNumber(audienceSample.decisionMakers),
        topBuyerPersonas: stringArray(audienceSample.topBuyerPersonas),
      },
    }),
  };
}

export function isStaleAudienceRun(analysis: AudienceAnalysis): boolean {
  if (analysis.status !== "running" || !analysis.startedAt) return false;
  const startedAt = Date.parse(analysis.startedAt);
  return Number.isFinite(startedAt) && Date.now() - startedAt > STALE_AUDIENCE_RUN_TIMEOUT_MS;
}

export function strategyErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  if (/expected object|received null|body\//i.test(message)) {
    return "We couldn't start the audience analysis. Please retry.";
  }
  return message || "Unable to generate your strategy. Please retry.";
}
