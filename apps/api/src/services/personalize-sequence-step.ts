import type { Campaign, Lead } from "@prisma/client";
import type { OutreachChannel } from "../lib/channels.js";
import { redis } from "../lib/redis.js";
import type { SequenceStep } from "../lib/sequence.js";
import { runChannelOutreachPersonalizationAgent } from "../modules/agents/channel-outreach-personalization-agent.js";
import {
  buildCampaignPersonalizationBrief,
  buildPersonalizationEvidence,
  evaluatePersonalization,
  openingSignature,
  personalizationCacheKey,
  personalizationFingerprint,
  personalizationOpeningKey,
  type PersonalizationTags,
} from "./personalization.js";

const PERSONALIZATION_CACHE_TTL_SECONDS = 60 * 60 * 24 * 14;
const OPENING_HISTORY_TTL_SECONDS = 60 * 60 * 24 * 30;
const OPENING_HISTORY_LIMIT = 40;

export { selectSafeEnrichmentFacts } from "./personalization.js";

type PreparedPersonalization = {
  rationale?: string;
  tags: PersonalizationTags;
};

export type PersonalizedSequenceStep = SequenceStep & {
  personalization?: PreparedPersonalization;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
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

function fallbackStep(
  step: SequenceStep,
  reason: string,
  source: "fallback" | "cache" = "fallback",
): PersonalizedSequenceStep {
  return {
    ...step,
    personalization: {
      tags: {
        version: 1,
        source,
        evidenceTypes: [],
        angle: "general",
        cta: "none",
        quality: "fallback",
      },
      rationale: reason,
    },
  };
}

function parseCachedStep(value: string): PersonalizedSequenceStep | null {
  try {
    const parsed = JSON.parse(value) as PersonalizedSequenceStep;
    return typeof parsed?.message === "string" && parsed.personalization ? parsed : null;
  } catch {
    return null;
  }
}

export async function personalizeSequenceStep(input: {
  orgId: string;
  channel: OutreachChannel;
  campaign: Pick<Campaign, "name" | "aiConfig"> & { id?: string };
  lead: Pick<Lead, "firstName" | "lastName" | "title" | "company" | "industry" | "companySize" | "location" | "enrichmentData">;
  step: number;
  sequenceStep: SequenceStep;
}): Promise<PersonalizedSequenceStep> {
  const rendered = renderSequenceTemplate(input.sequenceStep.message, input.lead);
  if (!campaignUsesChannelPersonalization(input.campaign.aiConfig)) {
    return { ...input.sequenceStep, message: rendered };
  }

  const evidence = buildPersonalizationEvidence(input.lead);
  const campaignBrief = buildCampaignPersonalizationBrief({
    campaignName: input.campaign.name,
    aiConfig: input.campaign.aiConfig,
    step: input.step,
  });
  const fingerprint = personalizationFingerprint({
    channel: input.channel,
    baseMessage: rendered,
    evidence,
    brief: campaignBrief,
  });
  const cacheKey = input.campaign.id
    ? personalizationCacheKey(input.orgId, input.campaign.id, fingerprint)
    : undefined;
  if (cacheKey) {
    const cached = await redis.get(cacheKey).catch(() => null);
    if (cached) {
      const step = parseCachedStep(cached);
      if (step?.personalization) {
        return {
          ...step,
          personalization: {
            ...step.personalization,
            tags: { ...step.personalization.tags, source: "cache" },
          },
        };
      }
    }
  }

  const openingsKey = input.campaign.id
    ? personalizationOpeningKey(input.campaign.id, input.step)
    : undefined;
  const recentOpeningSignatures = openingsKey
    ? await redis.lrange(openingsKey, 0, OPENING_HISTORY_LIMIT - 1).catch(() => [])
    : [];
  try {
    const generated = await runChannelOutreachPersonalizationAgent({
      orgId: input.orgId,
      channel: input.channel,
      campaignName: input.campaign.name,
      baseMessage: rendered,
      step: input.step,
      campaignBrief,
      evidence,
      prospect: {
        firstName: input.lead.firstName,
      },
    });
    const quality = evaluatePersonalization({
      message: generated.message,
      channel: input.channel,
      evidence,
      evidenceFactIds: generated.evidenceFactIds,
      recentOpeningSignatures,
    });
    if (!quality.accepted) {
      return fallbackStep({ ...input.sequenceStep, message: rendered }, quality.reason);
    }

    const prepared: PersonalizedSequenceStep = {
      ...input.sequenceStep,
      message: generated.message,
      personalization: {
        rationale: generated.rationale,
        tags: {
          version: 1,
          source: "groq",
          evidenceTypes: quality.tags.evidenceTypes,
          angle: quality.tags.angle,
          cta: quality.tags.cta,
          quality: "accepted",
        },
      },
    };
    if (cacheKey && openingsKey) {
      await Promise.all([
        redis.set(cacheKey, JSON.stringify(prepared), "EX", PERSONALIZATION_CACHE_TTL_SECONDS),
        redis.lpush(openingsKey, openingSignature(prepared.message)),
        redis.ltrim(openingsKey, 0, OPENING_HISTORY_LIMIT - 1),
        redis.expire(openingsKey, OPENING_HISTORY_TTL_SECONDS),
      ]).catch(() => undefined);
    }
    return prepared;
  } catch {
    return fallbackStep({ ...input.sequenceStep, message: rendered }, "generation unavailable");
  }
}
