import type { Campaign, Lead } from "@prisma/client";
import type { OutreachChannel } from "../lib/channels.js";
import type { SequenceStep } from "../lib/sequence.js";
import { runChannelOutreachPersonalizationAgent } from "../modules/agents/channel-outreach-personalization-agent.js";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

const ENRICHMENT_FACT_KEYS = [
  "headline",
  "summary",
  "about",
  "companyDescription",
  "currentPosition",
] as const;

export function selectSafeEnrichmentFacts(value: unknown): Record<string, string> | undefined {
  const record = asRecord(value);
  if (!record) return undefined;

  const facts: Record<string, string> = {};
  for (const key of ENRICHMENT_FACT_KEYS) {
    const fact = record[key];
    if (typeof fact === "string" && fact.trim()) {
      facts[key] = fact.trim().slice(0, 500);
    }
  }
  const instagram = asRecord(record.instagram);
  if (typeof instagram?.headline === "string" && instagram.headline.trim()) {
    facts.instagramHeadline = instagram.headline.trim().slice(0, 500);
  }
  return Object.keys(facts).length > 0 ? facts : undefined;
}

export function campaignUsesChannelPersonalization(aiConfig: unknown): boolean {
  return asRecord(asRecord(aiConfig)?.channelPersonalization)?.enabled === true;
}

export function renderSequenceTemplate(message: string, lead: Pick<Lead, "firstName" | "lastName" | "company" | "title">): string {
  return message
    .replaceAll("{{FirstName}}", lead.firstName)
    .replaceAll("{{LastName}}", lead.lastName)
    .replaceAll("{{Company}}", lead.company)
    .replaceAll("{{Title}}", lead.title);
}

export async function personalizeSequenceStep(input: {
  orgId: string;
  channel: OutreachChannel;
  campaign: Pick<Campaign, "name" | "aiConfig">;
  lead: Pick<Lead, "firstName" | "lastName" | "title" | "company" | "industry" | "companySize" | "location" | "enrichmentData">;
  step: number;
  sequenceStep: SequenceStep;
}): Promise<SequenceStep> {
  const rendered = renderSequenceTemplate(input.sequenceStep.message, input.lead);
  if (!campaignUsesChannelPersonalization(input.campaign.aiConfig)) {
    return { ...input.sequenceStep, message: rendered };
  }

  const generated = await runChannelOutreachPersonalizationAgent({
    orgId: input.orgId,
    channel: input.channel,
    campaignName: input.campaign.name,
    baseMessage: rendered,
    step: input.step,
    prospect: {
      firstName: input.lead.firstName,
      title: input.lead.title,
      company: input.lead.company,
      industry: input.lead.industry,
      companySize: input.lead.companySize,
      location: input.lead.location,
      enrichment: selectSafeEnrichmentFacts(input.lead.enrichmentData),
    },
  });

  return { ...input.sequenceStep, message: generated.message };
}
