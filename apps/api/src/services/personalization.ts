import { createHash } from "node:crypto";
import type { Lead } from "@prisma/client";
import type { OutreachChannel } from "../lib/channels.js";

export type PersonalizationEvidenceFact = {
  id: string;
  value: string;
  source: "lead" | "enrichment";
};

export type CampaignPersonalizationBrief = {
  campaignName: string;
  step: number;
  valueProposition?: string;
  requestedAngle?: string;
  requestedCta?: string;
  proofPoints: string[];
};

export type PersonalizationTags = {
  version: 1;
  source: "groq" | "fallback" | "cache";
  evidenceTypes: string[];
  angle: "role_company" | "industry" | "company" | "enrichment" | "general";
  cta: "question" | "overview" | "meeting" | "none";
  quality: "accepted" | "fallback";
};

export type PersonalizationQualityResult =
  | { accepted: true; tags: Omit<PersonalizationTags, "source" | "quality"> }
  | { accepted: false; reason: string; tags: Omit<PersonalizationTags, "source" | "quality"> };

type PersonalizationLead = Pick<
  Lead,
  "title" | "company" | "industry" | "companySize" | "location" | "enrichmentData"
>;

const ENRICHMENT_FACT_KEYS = [
  "headline",
  "summary",
  "about",
  "companyDescription",
  "currentPosition",
] as const;

const SHORT_MESSAGE_CHANNELS = new Set<OutreachChannel>([
  "whatsapp",
  "instagram",
  "facebook",
]);

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function safeText(value: unknown, limit = 280): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized ? normalized.slice(0, limit) : undefined;
}

function isUsefulFact(value: string | undefined): value is string {
  return Boolean(value && value.length >= 3 && !/^(unknown|n\/?a|null|undefined)$/i.test(value));
}

/** Selects a small, source-labelled fact packet. No raw provider payload is sent to Groq. */
export function buildPersonalizationEvidence(lead: PersonalizationLead): PersonalizationEvidenceFact[] {
  const facts: PersonalizationEvidenceFact[] = [];
  const title = safeText(lead.title, 120);
  const company = safeText(lead.company, 120);
  if (isUsefulFact(title) && isUsefulFact(company)) {
    facts.push({ id: "role_company", value: `${title} at ${company}`, source: "lead" });
  } else if (isUsefulFact(company)) {
    facts.push({ id: "company", value: company, source: "lead" });
  }

  const industry = safeText(lead.industry, 100);
  if (isUsefulFact(industry)) facts.push({ id: "industry", value: industry, source: "lead" });

  const enrichment = asRecord(lead.enrichmentData);
  for (const key of ENRICHMENT_FACT_KEYS) {
    const value = safeText(enrichment?.[key]);
    if (isUsefulFact(value)) {
      facts.push({ id: `enrichment_${key}`, value, source: "enrichment" });
      break;
    }
  }

  return facts.slice(0, 3);
}

export function selectSafeEnrichmentFacts(value: unknown): Record<string, string> | undefined {
  const record = asRecord(value);
  if (!record) return undefined;

  const facts: Record<string, string> = {};
  for (const key of ENRICHMENT_FACT_KEYS) {
    const fact = safeText(record[key], 500);
    if (fact) facts[key] = fact;
  }
  const instagram = asRecord(record.instagram);
  const instagramHeadline = safeText(instagram?.headline, 500);
  if (instagramHeadline) facts.instagramHeadline = instagramHeadline;
  return Object.keys(facts).length > 0 ? facts : undefined;
}

export function buildCampaignPersonalizationBrief(input: {
  campaignName: string;
  aiConfig: unknown;
  step: number;
}): CampaignPersonalizationBrief {
  const config = asRecord(input.aiConfig);
  const personalization = asRecord(config?.channelPersonalization);
  const proofPoints = Array.isArray(personalization?.proofPoints)
    ? personalization.proofPoints
      .map((point) => safeText(point, 180))
      .filter((point): point is string => Boolean(point))
      .slice(0, 3)
    : [];

  return {
    campaignName: input.campaignName,
    step: input.step,
    valueProposition: safeText(personalization?.valueProposition, 280),
    requestedAngle: safeText(personalization?.angle, 120),
    requestedCta: safeText(personalization?.cta, 120),
    proofPoints,
  };
}

export function personalizationFingerprint(input: {
  channel: OutreachChannel;
  baseMessage: string;
  evidence: PersonalizationEvidenceFact[];
  brief: CampaignPersonalizationBrief;
}): string {
  return createHash("sha256")
    .update(JSON.stringify(input))
    .digest("hex")
    .slice(0, 24);
}

function normalizedTokens(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((token) => token.length >= 4 && !/^(with|from|that|this|your|their|have|help|would|about)$/.test(token));
}

function inferAngle(evidenceTypes: string[]): PersonalizationTags["angle"] {
  if (evidenceTypes.includes("role_company")) return "role_company";
  if (evidenceTypes.includes("industry")) return "industry";
  if (evidenceTypes.includes("company")) return "company";
  if (evidenceTypes.some((type) => type.startsWith("enrichment_"))) return "enrichment";
  return "general";
}

function inferCta(message: string): PersonalizationTags["cta"] {
  if (/\b(meet|calendar|call|chat)\b/i.test(message)) return "meeting";
  if (/\b(overview|share|send)\b/i.test(message)) return "overview";
  if (/\?\s*$/.test(message.trim())) return "question";
  return "none";
}

export function openingSignature(message: string): string {
  return message
    .split(/[.!?]/, 1)[0]
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .slice(0, 10)
    .join(" ");
}

export function evaluatePersonalization(input: {
  message: string;
  channel: OutreachChannel;
  evidence: PersonalizationEvidenceFact[];
  evidenceFactIds: string[];
  recentOpeningSignatures?: string[];
}): PersonalizationQualityResult {
  const evidenceTypes = [...new Set(input.evidenceFactIds)].filter((id) =>
    input.evidence.some((fact) => fact.id === id),
  );
  const tags = { version: 1 as const, evidenceTypes, angle: inferAngle(evidenceTypes), cta: inferCta(input.message) };
  const message = input.message.trim();

  if (!message || /{{[^}]+}}/.test(message)) return { accepted: false, reason: "unresolved placeholder", tags };
  if (message.length > 1_000 || (SHORT_MESSAGE_CHANNELS.has(input.channel) && message.length > 420)) {
    return { accepted: false, reason: "channel length", tags };
  }
  if (input.evidence.length === 0) {
    return { accepted: false, reason: "no verified evidence", tags };
  }
  if (input.evidence.length > 0 && evidenceTypes.length === 0) {
    return { accepted: false, reason: "missing evidence citation", tags };
  }

  for (const id of evidenceTypes) {
    const fact = input.evidence.find((candidate) => candidate.id === id);
    const tokens = fact ? normalizedTokens(fact.value) : [];
    if (tokens.length > 0 && !tokens.some((token) => message.toLowerCase().includes(token))) {
      return { accepted: false, reason: `uncited evidence ${id}`, tags };
    }
  }

  const signature = openingSignature(message);
  if (signature && input.recentOpeningSignatures?.includes(signature)) {
    return { accepted: false, reason: "repeated opener", tags };
  }
  return { accepted: true, tags };
}

export function personalizationCacheKey(orgId: string, campaignId: string, fingerprint: string): string {
  return `personalization:v1:${orgId}:${campaignId}:${fingerprint}`;
}

export function personalizationOpeningKey(campaignId: string, step: number): string {
  return `personalization:v1:openers:${campaignId}:${step}`;
}
