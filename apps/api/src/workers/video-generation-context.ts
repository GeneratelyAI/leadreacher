import type { Prisma } from "@prisma/client";
import type { VideoGenerationJob } from "../lib/queue.js";
import { logOperationalInfo } from "../lib/operational-logger.js";
import { runVideoPromptAgent } from "../modules/agents/video-prompt-agent.js";
import { runPersonalizedVideoTemplatePromptAgent } from "../modules/agents/personalized-video-prompt-agent.js";
import { runPersonalizedVideoTemplateCritic } from "../modules/critics/personalized-video-prompt-critic.js";
import { runVideoPromptCritic } from "../modules/critics/video-prompt-critic.js";

const MAX_PROMPT_ATTEMPTS = 3;

type CampaignRecord = Prisma.CampaignGetPayload<Record<string, never>>;
type LeadRecord = Prisma.LeadGetPayload<Record<string, never>>;
type StrategyRecord = Prisma.StrategyGetPayload<Record<string, never>>;

export type VideoContext = {
  product: string;
  audience: string;
  tone: string;
  avatar: string;
  setting: string;
  leadFirstName: string;
  leadCompany: string;
  leadTitle: string;
  hasLogoReference: boolean;
  referenceUrls: string[];
};

export type TemplateVideoContext = Omit<
  VideoContext,
  "leadFirstName" | "leadCompany" | "leadTitle"
> & { logoUrl: string | null };

export type VideoGenerationPipeline = "standard" | "personalized";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    const string = stringValue(value);
    if (string) return string;
  }
  return undefined;
}

function recordString(
  record: Record<string, unknown> | null,
  key: string,
): string | undefined {
  return record ? stringValue(record[key]) : undefined;
}

function collectUrls(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((url): url is string => {
    if (typeof url !== "string") return false;
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  });
}

export function resolveSeedPrompt(
  providedPrompt: string | undefined,
  generatedPrompt: string,
  legacyPrompt: string,
): string {
  return providedPrompt && providedPrompt !== legacyPrompt
    ? providedPrompt
    : generatedPrompt;
}

export function buildVideoContext(
  job: VideoGenerationJob,
  campaign: CampaignRecord,
  lead: LeadRecord,
  strategy: StrategyRecord | null,
): VideoContext {
  const aiConfig = asRecord(campaign.aiConfig);
  const videoConfig = asRecord(aiConfig?.["video"]);
  const strategyVideoConfig = asRecord(strategy?.videoConfig);
  const positioning = asRecord(strategy?.positioning);
  const icpDefinition = asRecord(strategy?.icpDefinition);
  const creativeAssets = asRecord(strategy?.creativeAssets);
  const logoUrl = firstString(strategy?.logoUrl, recordString(creativeAssets, "logoUrl"));

  return {
    product: firstString(
      recordString(positioning, "businessModel"),
      recordString(positioning, "strengths"),
      campaign.name,
    ) ?? campaign.name,
    audience: firstString(
      recordString(icpDefinition, "idealCustomer"),
      "the campaign's target audience",
    ) ?? "the campaign's target audience",
    tone: firstString(
      job.tone,
      recordString(videoConfig, "tone"),
      recordString(strategyVideoConfig, "tone"),
      recordString(aiConfig, "tone"),
      "professional",
    ) ?? "professional",
    avatar: firstString(
      job.avatar,
      recordString(videoConfig, "avatar"),
      recordString(strategyVideoConfig, "avatar"),
      recordString(aiConfig, "avatar"),
      "professional spokesperson",
    ) ?? "professional spokesperson",
    setting: firstString(
      job.setting,
      recordString(videoConfig, "setting"),
      recordString(strategyVideoConfig, "setting"),
      recordString(aiConfig, "setting"),
      "clean professional workspace",
    ) ?? "clean professional workspace",
    leadFirstName: lead.firstName,
    leadCompany: lead.company,
    leadTitle: lead.title,
    hasLogoReference: Boolean(logoUrl),
    referenceUrls: [...new Set([
      ...(logoUrl ? [logoUrl] : []),
      ...collectUrls(job.referenceUrls),
      ...collectUrls(videoConfig?.["referenceUrls"]),
      ...collectUrls(strategyVideoConfig?.["referenceUrls"]),
      ...collectUrls(creativeAssets?.["referenceUrls"]),
    ])],
  };
}

export function buildTemplateVideoContext(
  job: VideoGenerationJob,
  campaign: CampaignRecord,
  strategy: StrategyRecord | null,
): TemplateVideoContext {
  const aiConfig = asRecord(campaign.aiConfig);
  const videoConfig = asRecord(aiConfig?.["video"]);
  const strategyVideoConfig = asRecord(strategy?.videoConfig);
  const positioning = asRecord(strategy?.positioning);
  const icpDefinition = asRecord(strategy?.icpDefinition);
  const creativeAssets = asRecord(strategy?.creativeAssets);
  const logoUrl = firstString(strategy?.logoUrl, recordString(creativeAssets, "logoUrl"));

  return {
    product: firstString(
      recordString(positioning, "businessModel"),
      recordString(positioning, "strengths"),
      campaign.name,
    ) ?? campaign.name,
    audience: firstString(
      recordString(icpDefinition, "idealCustomer"),
      "the campaign's target audience",
    ) ?? "the campaign's target audience",
    tone: firstString(
      job.tone,
      recordString(videoConfig, "tone"),
      recordString(strategyVideoConfig, "tone"),
      recordString(aiConfig, "tone"),
      "professional",
    ) ?? "professional",
    avatar: firstString(
      job.avatar,
      recordString(videoConfig, "avatar"),
      recordString(strategyVideoConfig, "avatar"),
      recordString(aiConfig, "avatar"),
      "professional spokesperson",
    ) ?? "professional spokesperson",
    setting: firstString(
      job.setting,
      recordString(videoConfig, "setting"),
      recordString(strategyVideoConfig, "setting"),
      recordString(aiConfig, "setting"),
      "clean professional workspace",
    ) ?? "clean professional workspace",
    hasLogoReference: Boolean(logoUrl),
    logoUrl: logoUrl ?? null,
    referenceUrls: [...new Set([
      ...collectUrls(job.referenceUrls),
      ...collectUrls(videoConfig?.["referenceUrls"]),
      ...collectUrls(strategyVideoConfig?.["referenceUrls"]),
      ...collectUrls(creativeAssets?.["referenceUrls"]),
    ])],
  };
}

export function resolveVideoGenerationPipeline(
  strategy: Pick<StrategyRecord, "campaignType" | "videoConfig"> | null,
  campaign?: Pick<CampaignRecord, "aiConfig"> | null,
): VideoGenerationPipeline {
  const campaignAiConfig = asRecord(campaign?.aiConfig);
  const campaignVideoConfig = asRecord(campaignAiConfig?.video);
  if (
    campaignVideoConfig?.enabled === true &&
    campaignVideoConfig.mode === "personalized" &&
    campaignVideoConfig.source === "generated"
  ) {
    return "personalized";
  }

  const videoConfig = asRecord(strategy?.videoConfig);
  return strategy?.campaignType === "personalized_outreach" &&
    videoConfig?.mode === "personalized" &&
    videoConfig.source === "generated"
    ? "personalized"
    : "standard";
}

export async function generateApprovedPrompts(
  orgId: string,
  videoAssetId: string,
  seedPrompt: string,
  context: VideoContext,
): Promise<{ imagePrompt: string; videoPrompt: string }> {
  let feedbackHints: string[] = [];
  for (let attempt = 1; attempt <= MAX_PROMPT_ATTEMPTS; attempt++) {
    const { imagePrompt, videoPrompt } = await runVideoPromptAgent({
      orgId,
      videoAssetId,
      seedPrompt,
      product: context.product,
      audience: context.audience,
      tone: context.tone,
      avatar: context.avatar,
      setting: context.setting,
      feedbackHints: feedbackHints.length ? feedbackHints : undefined,
    });
    const criticResult = await runVideoPromptCritic({
      orgId,
      videoAssetId,
      imagePrompt,
      videoPrompt,
      tone: context.tone,
      avatar: context.avatar,
      setting: context.setting,
    });
    if (criticResult.passed) return { imagePrompt, videoPrompt };

    feedbackHints = criticResult.feedback;
    logOperationalInfo("video-generation", {
      path: "prompt-critic-failed",
      videoAssetId,
      attempt,
      maxAttempts: MAX_PROMPT_ATTEMPTS,
      score: criticResult.score,
      feedback: feedbackHints,
    });
  }
  throw new Error(`Prompt critic failed after ${MAX_PROMPT_ATTEMPTS} attempts`);
}

export async function generateApprovedPersonalizedTemplatePrompts(
  orgId: string,
  templateId: string,
  seedPrompt: string,
  context: TemplateVideoContext,
): Promise<{
  storyboard: Awaited<ReturnType<typeof runPersonalizedVideoTemplatePromptAgent>>["storyboard"];
  imagePrompt: string;
  videoPrompt: string;
  sharedNarration: string;
}> {
  let feedbackHints: string[] = [];
  for (let attempt = 1; attempt <= MAX_PROMPT_ATTEMPTS; attempt++) {
    const promptResult = await runPersonalizedVideoTemplatePromptAgent({
      orgId,
      templateId,
      seedPrompt,
      product: context.product,
      audience: context.audience,
      tone: context.tone,
      avatar: context.avatar,
      setting: context.setting,
      hasLogoReference: context.hasLogoReference,
      feedbackHints: feedbackHints.length ? feedbackHints : undefined,
    });
    const criticResult = await runPersonalizedVideoTemplateCritic({
      orgId,
      templateId,
      storyboard: promptResult.storyboard,
      videoPrompt: promptResult.videoPrompt,
      sharedNarration: promptResult.sharedNarration,
      tone: context.tone,
      avatar: context.avatar,
      setting: context.setting,
      hasLogoReference: context.hasLogoReference,
    });
    if (criticResult.passed) return promptResult;

    feedbackHints = criticResult.feedback;
    logOperationalInfo("video-generation", {
      path: "personalized-template-prompt-critic-failed",
      templateId,
      attempt,
      maxAttempts: MAX_PROMPT_ATTEMPTS,
      score: criticResult.score,
      feedback: feedbackHints,
    });
  }
  throw new Error(`Personalized template prompt critic failed after ${MAX_PROMPT_ATTEMPTS} attempts`);
}
