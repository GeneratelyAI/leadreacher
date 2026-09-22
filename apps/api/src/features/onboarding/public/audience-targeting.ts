import type { ICPFilters } from "../../../platform/providers/apify.js";
import type { ProspectProfile } from "../../../platform/providers/prospect-search.js";

export const AUDIENCE_CLASSIFICATIONS = ["b2b", "b2c", "marketplace", "mixed", "unclear"] as const;
export const AUDIENCE_TARGET_SIDES = ["business_buyer", "consumer_user", "supply_side_provider"] as const;
export const AUDIENCE_OBJECTIVES = ["business_buyers", "consumer_users", "supply_side_providers", "clarification_required"] as const;

export type AudienceClassification = (typeof AUDIENCE_CLASSIFICATIONS)[number];
export type AudienceTargetSide = (typeof AUDIENCE_TARGET_SIDES)[number];
export type AudienceObjective = (typeof AUDIENCE_OBJECTIVES)[number];

export type AudienceEvidence = {
  excerpt: string;
  url?: string;
  pageTitle?: string;
};

export type AudienceTarget = {
  value: string;
  confidence: number;
  evidence: AudienceEvidence[];
};

export type AudienceSide = {
  kind: AudienceTargetSide;
  label: string;
  confidence: number;
  evidence: AudienceEvidence[];
};

export type AudienceBrief = {
  version: 1;
  classification: AudienceClassification;
  audienceSides: AudienceSide[];
  suggestedObjective: AudienceObjective;
  clarification?: { question: string; options: AudienceObjective[] };
  suggestions: {
    decisionMakers: AudienceTarget[];
    companyTypes: AudienceTarget[];
    industries: AudienceTarget[];
    locations: AudienceTarget[];
  };
  sourcing: { status: "eligible" | "blocked"; reason?: string };
  analyzedAt: string;
  sourceUrls: string[];
  confidence: number | null;
  evidence: Array<{ id: string; label: string; detail?: string; sourceUrl?: string }>;
};

export type ApprovedAudience = {
  version: 1;
  classification: AudienceClassification;
  objective: AudienceObjective;
  approvalStatus: "approved";
  targeting: {
    decisionMakers: string[];
    companyTypes: string[];
    industries: string[];
    locations: string[];
    additionalContext: string;
  };
  sourcing: { status: "eligible" | "blocked"; reason?: string };
  approvedAt: string;
};

export type AudienceProfileInput = ApprovedAudience["targeting"];

const SUPPLY_OR_CONSUMER_TERMS = /\b(driver|courier|rider|applicant|candidate|contractor|provider|merchant|seller|host|consumer|end user|individual client|job seeker)\b/i;
const MIN_CONFIDENCE = 0.6;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function stringValue(value: unknown, limit = 240): string {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function unique(values: string[], limit = 6): string[] {
  const seen = new Set<string>();
  return values
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value) => {
      const key = value.toLocaleLowerCase("en");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

function confidence(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(1, value))
    : 0;
}

function normalizeEvidence(value: unknown): AudienceEvidence[] {
  return arrayValue(value)
    .map((item) => {
      const record = asRecord(item);
      const excerpt = stringValue(record.excerpt);
      if (!excerpt) return null;
      return {
        excerpt,
        ...(stringValue(record.url) ? { url: stringValue(record.url) } : {}),
        ...(stringValue(record.pageTitle) ? { pageTitle: stringValue(record.pageTitle) } : {}),
      };
    })
    .filter((item): item is AudienceEvidence => item !== null)
    .slice(0, 3);
}

function classification(value: unknown): AudienceClassification {
  return AUDIENCE_CLASSIFICATIONS.includes(value as AudienceClassification)
    ? value as AudienceClassification
    : "unclear";
}

function objective(value: unknown): AudienceObjective {
  return AUDIENCE_OBJECTIVES.includes(value as AudienceObjective)
    ? value as AudienceObjective
    : "clarification_required";
}

function side(value: unknown): AudienceTargetSide | null {
  return AUDIENCE_TARGET_SIDES.includes(value as AudienceTargetSide)
    ? value as AudienceTargetSide
    : null;
}

function normalizeTargets(value: unknown): AudienceTarget[] {
  const deduped = new Map<string, AudienceTarget>();
  for (const item of arrayValue(value)) {
    const record = asRecord(item);
    const target = stringValue(record.value, 80);
    const evidence = normalizeEvidence(record.evidence);
    const parsed = { value: target, confidence: confidence(record.confidence), evidence };
    if (!target || parsed.confidence < MIN_CONFIDENCE || evidence.length === 0) continue;
    const key = target.toLocaleLowerCase("en");
    if (!deduped.has(key)) deduped.set(key, parsed);
  }
  return [...deduped.values()].slice(0, 6);
}

function targetValues(targets: AudienceTarget[]): string[] {
  return targets.map((target) => target.value);
}

function eligibility(input: {
  classification: AudienceClassification;
  requestedObjective: AudienceObjective;
  decisionMakers: AudienceTarget[];
}): { status: "eligible" | "blocked"; reason?: string } {
  if (input.classification === "b2c") {
    return { status: "blocked", reason: "This website appears consumer-focused. Confirm a business-buyer audience before automatic sourcing." };
  }
  if (input.classification === "marketplace" || input.classification === "mixed") {
    return { status: "blocked", reason: "Confirm the demand-side business buyers before automatic sourcing for this website." };
  }
  if (input.classification === "unclear" || input.requestedObjective === "clarification_required") {
    return { status: "blocked", reason: "Confirm which audience the campaign should reach before automatic sourcing." };
  }
  if (input.requestedObjective !== "business_buyers") {
    return { status: "blocked", reason: "Automatic LinkedIn sourcing is available only for an approved business-buyer audience." };
  }
  if (input.decisionMakers.length === 0) {
    return { status: "blocked", reason: "Add evidence-backed business decision-maker roles before automatic sourcing." };
  }
  return { status: "eligible" };
}

export function normalizeAudienceBrief(value: unknown, sourceUrls: string[] = []): AudienceBrief {
  const record = asRecord(value);
  const parsedClassification = classification(record.classification);
  const audienceSides = arrayValue(record.audienceSides)
    .map((item) => {
      const sideRecord = asRecord(item);
      const kind = side(sideRecord.kind);
      const evidence = normalizeEvidence(sideRecord.evidence);
      if (!kind || !stringValue(sideRecord.label) || confidence(sideRecord.confidence) < MIN_CONFIDENCE || evidence.length === 0) return null;
      return { kind, label: stringValue(sideRecord.label, 120), confidence: confidence(sideRecord.confidence), evidence };
    })
    .filter((item): item is AudienceSide => item !== null)
    .slice(0, 4);
  const suggestions = asRecord(record.suggestions);
  const decisionMakers = normalizeTargets(suggestions.decisionMakers);
  const requestedObjective = objective(record.suggestedObjective);
  const requiresClarification = parsedClassification === "unclear" || parsedClassification === "mixed" || parsedClassification === "marketplace";
  const resolvedObjective = requiresClarification ? "clarification_required" : requestedObjective === "business_buyers" ? requestedObjective : "clarification_required";
  const sourcing = eligibility({ classification: parsedClassification, requestedObjective: resolvedObjective, decisionMakers });
  const sources = unique([
    ...arrayValue(record.sourceUrls).map((item) => stringValue(item)),
    ...sourceUrls,
  ], 8);

  return {
    version: 1,
    classification: parsedClassification,
    audienceSides,
    suggestedObjective: resolvedObjective,
    ...(requiresClarification ? {
      clarification: {
        question: "Which audience should this campaign reach?",
        options: ["business_buyers", "consumer_users", "supply_side_providers"],
      },
    } : {}),
    suggestions: {
      decisionMakers,
      companyTypes: normalizeTargets(suggestions.companyTypes),
      industries: normalizeTargets(suggestions.industries),
      locations: normalizeTargets(suggestions.locations),
    },
    sourcing,
    analyzedAt: new Date().toISOString(),
    sourceUrls: sources,
    confidence: audienceSides.length
      ? Math.round((audienceSides.reduce((sum, item) => sum + item.confidence, 0) / audienceSides.length) * 100) / 100
      : null,
    evidence: audienceSides.flatMap((audienceSide, sideIndex) => audienceSide.evidence.map((item, evidenceIndex) => ({
      id: `${audienceSide.kind}-${sideIndex}-${evidenceIndex}`,
      label: audienceSide.label,
      detail: item.excerpt,
      ...(item.url ? { sourceUrl: item.url } : {}),
    }))).slice(0, 4),
  };
}

export function profileFromAudienceBrief(brief: AudienceBrief): Omit<AudienceProfileInput, "additionalContext"> {
  return {
    decisionMakers: targetValues(brief.suggestions.decisionMakers),
    companyTypes: targetValues(brief.suggestions.companyTypes),
    industries: targetValues(brief.suggestions.industries),
    locations: targetValues(brief.suggestions.locations),
  };
}

export function createApprovedAudience(input: {
  brief: AudienceBrief | undefined;
  objective?: AudienceObjective;
  profile: AudienceProfileInput;
}): ApprovedAudience {
  const selectedObjective = input.objective ?? input.brief?.suggestedObjective ?? "clarification_required";
  const safeProfile = {
    decisionMakers: unique(input.profile.decisionMakers).filter((value) => !SUPPLY_OR_CONSUMER_TERMS.test(value)),
    companyTypes: unique(input.profile.companyTypes),
    industries: unique(input.profile.industries),
    locations: unique(input.profile.locations),
    additionalContext: stringValue(input.profile.additionalContext, 500),
  };
  const result = eligibility({
    classification: input.brief?.classification ?? "unclear",
    requestedObjective: selectedObjective,
    decisionMakers: safeProfile.decisionMakers.map((value) => ({ value, confidence: 1, evidence: [{} as AudienceEvidence] })),
  });
  return {
    version: 1,
    classification: input.brief?.classification ?? "unclear",
    objective: selectedObjective,
    approvalStatus: "approved",
    targeting: safeProfile,
    sourcing: result,
    approvedAt: new Date().toISOString(),
  };
}

export function readApprovedAudience(value: unknown): ApprovedAudience | null {
  const record = asRecord(value);
  if (record.version !== 1 || record.approvalStatus !== "approved") return null;
  const targeting = asRecord(record.targeting);
  return createApprovedAudience({
    brief: normalizeAudienceBrief({ classification: record.classification, suggestedObjective: record.objective, suggestions: { decisionMakers: [] } }),
    objective: objective(record.objective),
    profile: {
      decisionMakers: arrayValue(targeting.decisionMakers).map((item) => stringValue(item)),
      companyTypes: arrayValue(targeting.companyTypes).map((item) => stringValue(item)),
      industries: arrayValue(targeting.industries).map((item) => stringValue(item)),
      locations: arrayValue(targeting.locations).map((item) => stringValue(item)),
      additionalContext: stringValue(targeting.additionalContext, 500),
    },
  });
}

export function approvedAudienceFilters(audience: ApprovedAudience): ICPFilters {
  return {
    jobTitles: audience.targeting.decisionMakers,
    industries: audience.targeting.industries,
    companySizes: [],
    locations: audience.targeting.locations,
    keywords: undefined,
  };
}

function looseMatch(value: string, allowed: string[]): boolean {
  const normalized = value.toLocaleLowerCase("en");
  return allowed.some((item) => {
    const expected = item.toLocaleLowerCase("en");
    return normalized.includes(expected);
  });
}

export function validateProspectAgainstApprovedAudience(
  profile: ProspectProfile,
  audience: ApprovedAudience,
): { accepted: true } | { accepted: false; reason: string } {
  if (audience.sourcing.status !== "eligible") return { accepted: false, reason: audience.sourcing.reason ?? "Audience sourcing is blocked." };
  if (SUPPLY_OR_CONSUMER_TERMS.test(`${profile.title} ${profile.company}`)) {
    return { accepted: false, reason: "Profile matches a supply-side or consumer role." };
  }
  if (!looseMatch(profile.title, audience.targeting.decisionMakers)) {
    return { accepted: false, reason: "Profile title does not match an approved decision-maker role." };
  }
  if (profile.industry && audience.targeting.industries.length && !looseMatch(profile.industry, audience.targeting.industries)) {
    return { accepted: false, reason: "Profile industry conflicts with the approved audience." };
  }
  if (profile.location && audience.targeting.locations.length && !looseMatch(profile.location, audience.targeting.locations)) {
    return { accepted: false, reason: "Profile location conflicts with the approved audience." };
  }
  return { accepted: true };
}
