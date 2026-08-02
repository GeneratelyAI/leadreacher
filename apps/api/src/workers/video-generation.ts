import { randomUUID } from "node:crypto";
import { DelayedError, Job, Worker } from "bullmq";
import type { Prisma } from "@prisma/client";
import {
  env,
  getBullMqIdleDrainDelaySeconds,
  getVeoParallelVariants,
} from "../config/env.js";
import {
  generateImageFromPrompt,
  generateImageWithAssets,
  type VideoJobStatus,
} from "../adapters/google-ai.js";
import {
  getConfiguredVideoProvider,
  getVideoJobResult,
  pollVideoJobStatus,
  submitVideoJobForProvider,
  type VideoProvider,
} from "../adapters/video-provider.js";
import { R2Adapter } from "../adapters/r2.js";
import { synthesizeSpeech } from "../adapters/google-tts.js";
import { prisma } from "../lib/prisma.js";
import { redis } from "../lib/redis.js";
import {
  type VideoGenerationJob,
  QUEUE_VIDEO_GENERATION,
  videoGenerationQueue,
} from "../lib/queue.js";
import {
  assertPersonalizedMasterVideo,
  extractRepresentativeFrames,
  inspectVideoMedia,
  normalizeVideoDuration,
} from "../lib/video-frames.js";
import {
  createPersonalizedTemplateManifest,
  sha256,
  updatePersonalizedTemplateManifest,
} from "../lib/personalized-video-manifest.js";
import { runVideoPromptAgent } from "../modules/agents/video-prompt-agent.js";
import { runPersonalizedVideoTemplatePromptAgent } from "../modules/agents/personalized-video-prompt-agent.js";
import { runVideoOutputCritic } from "../modules/critics/video-output-critic.js";
import { runPersonalizedVideoTemplateCritic } from "../modules/critics/personalized-video-prompt-critic.js";
import { runVideoPromptCritic } from "../modules/critics/video-prompt-critic.js";
import { composePersonalizedVideoAsset } from "../services/personalized-video.js";
import {
  buildPersonalizedVideoSeedPrompt,
  buildStandardVideoSeedPrompt,
} from "../lib/video-prompt-brief.js";

const POLL_INTERVAL_MS = 10_000;
const MAX_PROMPT_ATTEMPTS = 3;
const VEO_SUBMISSION_LEASE_MS = 2 * 60 * 1000;
const VEO_ACTIVE_POLL_LEASE_MS = 2 * 60 * 1000;
const VEO_RECOVERY_LEASE_MS = 5 * 60 * 1000;
const VEO_RECOVERY_BATCH_SIZE = 20;

type CampaignRecord = Prisma.CampaignGetPayload<Record<string, never>>;
type LeadRecord = Prisma.LeadGetPayload<Record<string, never>>;
type StrategyRecord = Prisma.StrategyGetPayload<Record<string, never>>;

type VideoContext = {
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

type TemplateVideoContext = Omit<
  VideoContext,
  "leadFirstName" | "leadCompany" | "leadTitle"
> & { logoUrl: string | null };

export type VideoGenerationPipeline = "standard" | "personalized";

type ReviewError = Error & {
  criticScore?: number;
  needsReview?: boolean;
  videoUrl?: string;
};

function logInfo(payload: Record<string, unknown>): void {
  console.log(JSON.stringify({ event: "video-generation", ...payload }));
}

function logError(payload: Record<string, unknown>): void {
  console.error(JSON.stringify({ event: "video-generation", ...payload }));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function toAuditMetadataValue(value: unknown): Prisma.InputJsonValue {
  try {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  } catch {
    return errorMessage(value);
  }
}

async function markVideoAssetFailed(
  orgId: string,
  videoAssetId: string,
  path: string,
  error: unknown,
): Promise<void> {
  const message = errorMessage(error);

  await prisma.videoAsset.update({
    where: { id: videoAssetId },
    data: {
      status: "failed",
      needsReview: true,
      veoOperationState: "failed",
      veoSubmitLeaseAt: null,
    },
  });

  await prisma.auditLog.create({
    data: {
      orgId,
      action: "video.generate.failed",
      resource: "VideoAsset",
      resourceId: videoAssetId,
      metadata: {
        path,
        error: message,
      },
    },
  });
}

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
    if (string) {
      return string;
    }
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
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((url): url is string => {
    if (typeof url !== "string") {
      return false;
    }

    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  });
}

function resolveSeedPrompt(
  providedPrompt: string | undefined,
  generatedPrompt: string,
  legacyPrompt: string,
): string {
  return providedPrompt && providedPrompt !== legacyPrompt
    ? providedPrompt
    : generatedPrompt;
}

function buildVideoContext(
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
    product:
      firstString(
        recordString(positioning, "businessModel"),
        recordString(positioning, "strengths"),
        campaign.name,
      ) ?? campaign.name,
    audience:
      firstString(
        recordString(icpDefinition, "idealCustomer"),
        "the campaign's target audience",
      ) ?? "the campaign's target audience",
    tone:
      firstString(
        job.tone,
        recordString(videoConfig, "tone"),
        recordString(strategyVideoConfig, "tone"),
        recordString(aiConfig, "tone"),
        "professional",
      ) ?? "professional",
    avatar:
      firstString(
        job.avatar,
        recordString(videoConfig, "avatar"),
        recordString(strategyVideoConfig, "avatar"),
        recordString(aiConfig, "avatar"),
        "professional spokesperson",
      ) ?? "professional spokesperson",
    setting:
      firstString(
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
    referenceUrls: [
      ...new Set([
        ...(logoUrl ? [logoUrl] : []),
        ...collectUrls(job.referenceUrls),
        ...collectUrls(videoConfig?.["referenceUrls"]),
        ...collectUrls(strategyVideoConfig?.["referenceUrls"]),
        ...collectUrls(creativeAssets?.["referenceUrls"]),
      ]),
    ],
  };
}

function buildTemplateVideoContext(
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
    product:
      firstString(
        recordString(positioning, "businessModel"),
        recordString(positioning, "strengths"),
        campaign.name,
      ) ?? campaign.name,
    audience:
      firstString(recordString(icpDefinition, "idealCustomer"), "the campaign's target audience") ??
      "the campaign's target audience",
    tone:
      firstString(
        job.tone,
        recordString(videoConfig, "tone"),
        recordString(strategyVideoConfig, "tone"),
        recordString(aiConfig, "tone"),
        "professional",
      ) ??
      "professional",
    avatar:
      firstString(
        job.avatar,
        recordString(videoConfig, "avatar"),
        recordString(strategyVideoConfig, "avatar"),
        recordString(aiConfig, "avatar"),
        "professional spokesperson",
      ) ??
      "professional spokesperson",
    setting:
      firstString(
        job.setting,
        recordString(videoConfig, "setting"),
        recordString(strategyVideoConfig, "setting"),
        recordString(aiConfig, "setting"),
        "clean professional workspace",
      ) ??
      "clean professional workspace",
    hasLogoReference: Boolean(logoUrl),
    logoUrl: logoUrl ?? null,
    referenceUrls: [
      ...new Set([
        ...collectUrls(job.referenceUrls),
        ...collectUrls(videoConfig?.["referenceUrls"]),
        ...collectUrls(strategyVideoConfig?.["referenceUrls"]),
        ...collectUrls(creativeAssets?.["referenceUrls"]),
      ]),
    ],
  };
}

export function resolveVideoGenerationPipeline(
  strategy: Pick<StrategyRecord, "campaignType" | "videoConfig"> | null,
): VideoGenerationPipeline {
  const videoConfig = asRecord(strategy?.videoConfig);
  return strategy?.campaignType === "personalized_outreach" &&
    videoConfig?.mode === "personalized" &&
    videoConfig.source === "generated"
    ? "personalized"
    : "standard";
}

async function generateApprovedPrompts(
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

    if (criticResult.passed) {
      return { imagePrompt, videoPrompt };
    }

    feedbackHints = criticResult.feedback;
    logInfo({
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

async function generateApprovedPersonalizedTemplatePrompts(
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

    if (criticResult.passed) {
      return {
        storyboard: promptResult.storyboard,
        imagePrompt: promptResult.imagePrompt,
        videoPrompt: promptResult.videoPrompt,
        sharedNarration: promptResult.sharedNarration,
      };
    }

    feedbackHints = criticResult.feedback;
    logInfo({
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

async function reserveOrLoadVeoOperation(
  orgId: string,
  videoAssetId: string,
  seedImageUrl: string,
  videoPrompt: string,
  referenceUrls: string[],
  videoProvider: VideoProvider,
): Promise<string | null> {
  const existing = await prisma.videoAsset.findUnique({
    where: { id: videoAssetId },
    select: {
      status: true,
      veoOperationId: true,
      veoOperationState: true,
      veoSubmitLeaseAt: true,
    },
  });

  if (!existing || existing.status === "ready" || existing.status === "failed") {
    return null;
  }

  if (existing.veoOperationId && existing.veoOperationState === "active") {
    return existing.veoOperationId;
  }

  if (existing.veoOperationState === "submitting") {
    if (
      existing.veoSubmitLeaseAt &&
      existing.veoSubmitLeaseAt.getTime() <= Date.now()
    ) {
      await prisma.videoAsset.updateMany({
        where: { id: videoAssetId, veoOperationState: "submitting" },
        data: {
          status: "failed",
          needsReview: true,
          veoOperationState: "unknown",
        },
      });
      await prisma.auditLog.create({
        data: {
          orgId,
          action: "video.generate.failed",
          resource: "VideoAsset",
          resourceId: videoAssetId,
          metadata: {
            path: "veo-submit-lease-expired",
            error: "Veo submit may have reached Google but no operation ID was persisted.",
          },
        },
      });
    }
    return null;
  }

  if (existing.veoOperationState === "unknown") {
    return null;
  }

  const reserved = await prisma.videoAsset.updateMany({
    where: {
      id: videoAssetId,
      veoOperationId: null,
      veoOperationState: null,
      status: "generating",
    },
    data: {
      veoOperationState: "submitting",
      veoSubmitLeaseAt: new Date(Date.now() + VEO_SUBMISSION_LEASE_MS),
    },
  });
  if (reserved.count === 0) {
    return null;
  }

  try {
    const { jobId } = await submitVideoJobForProvider(
      videoProvider,
      seedImageUrl,
      videoPrompt,
      referenceUrls,
      "9:16",
    );
    await prisma.videoAsset.update({
      where: { id: videoAssetId },
      data: {
        veoOperationId: jobId,
        veoOperationState: "active",
        // This lease makes a process crash between submission and the next
        // poll recoverable without resubmitting the paid Google operation.
        veoSubmitLeaseAt: new Date(Date.now() + VEO_ACTIVE_POLL_LEASE_MS),
      },
    });
    return jobId;
  } catch (error) {
    await prisma.videoAsset.updateMany({
      where: { id: videoAssetId, veoOperationState: "submitting" },
      data: {
        status: "failed",
        needsReview: true,
        veoOperationState: "unknown",
      },
    });
    await prisma.auditLog.create({
      data: {
        orgId,
        action: "video.generate.failed",
        resource: "VideoAsset",
        resourceId: videoAssetId,
        metadata: {
          path: "veo-submit-unknown",
          error: toAuditMetadataValue(error),
        },
      },
    });
    return null;
  }
}

async function markTemplateFailed(
  orgId: string,
  templateId: string,
  path: string,
  error: unknown,
): Promise<void> {
  await prisma.campaignVideoTemplate.update({
    where: { id: templateId },
    data: { status: "failed", needsReview: true, veoOperationState: "failed", veoSubmitLeaseAt: null },
  });
  await prisma.auditLog.create({
    data: {
      orgId,
      action: "video.template.failed",
      resource: "CampaignVideoTemplate",
      resourceId: templateId,
      metadata: { path, error: errorMessage(error) },
    },
  });
}

async function processTemplateOrchestrate(job: Job<VideoGenerationJob>): Promise<void> {
  const { orgId, campaignId } = job.data;
  const campaign = await prisma.campaign.findFirst({ where: { id: campaignId, orgId } });
  if (!campaign) throw new Error(`Campaign ${campaignId} not found for org ${orgId}`);
  const strategy = campaign.strategyId
    ? await prisma.strategy.findFirst({ where: { id: campaign.strategyId, orgId } })
    : null;
  if (resolveVideoGenerationPipeline(strategy) !== "personalized") return;

  const template = await prisma.campaignVideoTemplate.upsert({
    where: { campaignId_version: { campaignId, version: 1 } },
    create: {
      orgId,
      campaignId,
      version: 1,
      voice: env.PERSONALIZED_VIDEO_TTS_VOICE,
    },
    update: {},
  });
  if (template.status === "ready" || template.status === "failed") return;

  const claimed = await prisma.campaignVideoTemplate.updateMany({
    where: { id: template.id, status: "pending" },
    data: { status: "generating" },
  });
  if (claimed.count === 0) return;

  const context = buildTemplateVideoContext(job.data, campaign, strategy);
  const prompt = resolveSeedPrompt(
    job.data.prompt,
    buildPersonalizedVideoSeedPrompt({
      campaignName: campaign.name,
      strategy,
      product: context.product,
      audience: context.audience,
      tone: context.tone,
      avatar: context.avatar,
      setting: context.setting,
      hasLogoReference: context.hasLogoReference,
      logoUrl: context.logoUrl,
    }),
    `Generate the shared personalized B2B outreach video template for ${campaign.name}.`,
  );

  try {
    const approved = await generateApprovedPersonalizedTemplatePrompts(
      orgId,
      template.id,
      prompt,
      context,
    );
    // The provider renders one continuous shared master. The four-scene
    // storyboard is retained in the manifest as the approved creative brief,
    // rather than implying that the worker stitches generated scenes together.
    const [narration, image] = await Promise.all([
      synthesizeSpeech(approved.sharedNarration),
      context.referenceUrls.length > 0
        ? generateImageWithAssets(approved.imagePrompt, context.referenceUrls, "9:16")
        : generateImageFromPrompt(approved.imagePrompt, "9:16"),
    ]);
    const r2 = new R2Adapter();
    const imageExt = image.mimeType.split("/")[1] ?? "png";
    const [{ url: sharedNarrationUrl }, { url: seedImageUrl }] = await Promise.all([
      r2.uploadBuffer(
        `video-templates/${orgId}/${template.id}/${randomUUID()}-narration.mp3`,
        narration,
        "audio/mpeg",
      ),
      r2.uploadBuffer(
        `seed-images/${orgId}/${template.id}/${randomUUID()}.${imageExt}`,
        image.buffer,
        image.mimeType,
      ),
    ]);
    const renderManifest = createPersonalizedTemplateManifest({
      storyboard: approved.storyboard,
      imagePrompt: approved.imagePrompt,
      videoPrompt: approved.videoPrompt,
      sharedNarration: approved.sharedNarration,
      seedImageUrl,
      seedImage: image.buffer,
      sharedNarrationUrl,
      sharedNarrationAudio: narration,
      logoUrl: context.logoUrl,
      provider: getConfiguredVideoProvider(),
    });
    await prisma.campaignVideoTemplate.update({
      where: { id: template.id },
      data: {
        seedImageUrl,
        sharedNarrationUrl,
        imagePrompt: approved.imagePrompt,
        videoPrompt: approved.videoPrompt,
        sharedNarration: approved.sharedNarration,
        logoUrl: context.logoUrl,
        selectedTone: context.tone,
        renderManifest,
      },
    });
    await videoGenerationQueue.add(
      "generate-personalized-template-veo",
      {
        orgId,
        campaignId,
        pipeline: "personalized",
        jobType: "template-veo",
        templateId: template.id,
        seedImageUrl,
        videoPrompt: approved.videoPrompt,
        tone: context.tone,
        avatar: context.avatar,
        setting: context.setting,
        referenceUrls: context.referenceUrls,
        videoProvider: getConfiguredVideoProvider(),
      },
      { jobId: `personalized-template-veo:${template.id}`, attempts: 1 },
    );
  } catch (error) {
    await markTemplateFailed(orgId, template.id, "template-orchestration-failed", error);
    throw error;
  }
}

async function processTemplateVeo(job: Job<VideoGenerationJob>): Promise<void> {
  const {
    orgId,
    templateId,
    seedImageUrl,
    videoPrompt,
    referenceUrls = [],
    videoProvider = getConfiguredVideoProvider(),
  } = job.data;
  if (!templateId || !seedImageUrl || !videoPrompt) {
    throw new Error("Template Veo job is missing templateId, seedImageUrl, or videoPrompt");
  }
  const template = await prisma.campaignVideoTemplate.findFirst({
    where: { id: templateId, orgId },
  });
  if (!template || template.status === "failed" || template.status === "ready") return;

  let operationId = template.veoOperationId;
  if (!operationId) {
    if (template.veoOperationState === "submitting") {
      const leaseExpired = !template.veoSubmitLeaseAt ||
        template.veoSubmitLeaseAt.getTime() <= Date.now();
      if (leaseExpired) {
        await markTemplateFailed(
          orgId,
          template.id,
          "template-veo-submit-unknown",
          new Error("Template Veo submission lease expired before an operation ID was persisted"),
        );
      }
      return;
    }
    const claimed = await prisma.campaignVideoTemplate.updateMany({
      where: {
        id: template.id,
        veoOperationId: null,
        veoOperationState: null,
      },
      data: {
        veoOperationState: "submitting",
        veoSubmitLeaseAt: new Date(Date.now() + VEO_SUBMISSION_LEASE_MS),
      },
    });
    if (claimed.count === 0) return;
    try {
      const submitted = await submitVideoJobForProvider(
        videoProvider,
        seedImageUrl,
        videoPrompt,
        referenceUrls,
        "9:16",
      );
      operationId = submitted.jobId;
      await prisma.campaignVideoTemplate.update({
        where: { id: template.id },
        data: {
          veoOperationId: operationId,
          veoOperationState: "active",
          veoSubmitLeaseAt: new Date(Date.now() + VEO_ACTIVE_POLL_LEASE_MS),
        },
      });
    } catch (error) {
      await markTemplateFailed(orgId, template.id, "template-veo-submit-failed", error);
      throw error;
    }
  }

  const status = await pollVideoJobStatus(operationId);
  if (status.status === "pending") {
    await job.moveToDelayed(Date.now() + POLL_INTERVAL_MS, job.token);
    throw new DelayedError();
  }
  if (status.status === "failed") {
    await markTemplateFailed(orgId, template.id, "template-veo-terminal-failure", status.error);
    return;
  }

  await finalizeTemplateVeoOperation({
    template,
    operationId,
    setting: job.data.setting ?? "clean professional workspace",
  });
}

async function finalizeTemplateVeoOperation(input: {
  template: {
    id: string;
    orgId: string;
    selectedTone: string | null;
  };
  operationId: string;
  setting: string;
  failureMode?: "fail" | "defer";
}): Promise<boolean> {
  const { template, operationId, setting } = input;
  try {
    const generated = await getVideoJobResult(operationId);
    const normalized = await normalizeVideoDuration(
      generated.videoBuffer,
      generated.durationMs,
      { stripAudio: true },
    );
    const masterMedia = await inspectVideoMedia(normalized.videoBuffer);
    assertPersonalizedMasterVideo(masterMedia);
    const r2 = new R2Adapter();
    const { url: masterVideoUrl } = await r2.uploadBuffer(
      `video-templates/${template.orgId}/${template.id}/${randomUUID()}.mp4`,
      normalized.videoBuffer,
      "video/mp4",
    );
    const frames = await extractRepresentativeFrames(normalized.videoBuffer, normalized.durationMs);
    const critic = await runVideoOutputCritic({
      orgId: template.orgId,
      videoAssetId: template.id,
      videoUrl: masterVideoUrl,
      frames,
      tone: template.selectedTone ?? "professional",
      setting,
      attempt: 1,
    });
    const templateMetadata = await prisma.campaignVideoTemplate.findUnique({
      where: { id: template.id },
      select: { renderManifest: true },
    });
    const renderManifest = templateMetadata?.renderManifest
      ? updatePersonalizedTemplateManifest(templateMetadata.renderManifest, {
        assets: {
          masterVideoUrl,
          masterVideoSha256: sha256(normalized.videoBuffer),
        },
        provider: { operationId },
        quality: {
          durationMs: masterMedia.durationMs,
          width: masterMedia.width,
          height: masterMedia.height,
          sourceAudioStreams: masterMedia.audioStreams,
          criticScore: critic.score,
          criticPassed: critic.passed,
        },
      })
      : null;
    await prisma.campaignVideoTemplate.update({
      where: { id: template.id },
      data: {
        masterVideoUrl,
        status: critic.passed ? "ready" : "failed",
        criticScore: critic.score,
        needsReview: !critic.passed,
        veoOperationState: critic.passed ? "completed" : "failed",
        veoSubmitLeaseAt: null,
        ...(renderManifest ? { renderManifest } : {}),
      },
    });
    if (!critic.passed) {
      await prisma.auditLog.create({
        data: {
          orgId: template.orgId,
          action: "video.template.failed",
          resource: "CampaignVideoTemplate",
          resourceId: template.id,
          metadata: { path: "template-output-critic-failed", score: critic.score, issues: critic.issues },
        },
      });
    }
    return critic.passed;
  } catch (error) {
    if (input.failureMode !== "defer") {
      await markTemplateFailed(
        template.orgId,
        template.id,
        "template-veo-post-processing-failed",
        error,
      );
    }
    throw error;
  }
}

async function processPersonalizedCompose(job: Job<VideoGenerationJob>): Promise<void> {
  const { orgId, videoAssetId, templateId } = job.data;
  if (!videoAssetId || !templateId) {
    throw new Error("Personalized composition job is missing videoAssetId or templateId");
  }
  await composePersonalizedVideoAsset({ orgId, videoAssetId, templateId });
}

async function processOrchestrate(
  job: Job<VideoGenerationJob>,
): Promise<void> {
  const { orgId, campaignId, leadId, prompt: providedPrompt } = job.data;

  if (!leadId) {
    throw new Error("Standard video orchestration requires leadId");
  }

  const [campaign, lead] = await Promise.all([
    prisma.campaign.findFirst({ where: { id: campaignId, orgId } }),
    prisma.lead.findFirst({ where: { id: leadId, orgId } }),
  ]);

  if (!campaign) {
    throw new Error(`Campaign ${campaignId} not found for org ${orgId}`);
  }

  if (!lead) {
    throw new Error(`Lead ${leadId} not found for org ${orgId}`);
  }

  const strategy = campaign.strategyId
    ? await prisma.strategy.findFirst({
        where: { id: campaign.strategyId, orgId },
      })
    : null;

  const context = buildVideoContext(job.data, campaign, lead, strategy);
  const pipeline: VideoGenerationPipeline = "standard";
  const prompt = resolveSeedPrompt(
    providedPrompt,
    buildStandardVideoSeedPrompt({
      campaignName: campaign.name,
      strategy,
      product: context.product,
      audience: context.audience,
      tone: context.tone,
      avatar: context.avatar,
      setting: context.setting,
      hasLogoReference: context.hasLogoReference,
    }),
    `Generate a standardized B2B campaign video for ${campaign.name}.`,
  );

  const existingVideoAsset = job.data.videoAssetId
    ? await prisma.videoAsset.findFirst({
        where: { id: job.data.videoAssetId, orgId },
      })
    : null;

  if (job.data.videoAssetId && !existingVideoAsset) {
    throw new Error(
      `VideoAsset ${job.data.videoAssetId} not found for org ${orgId}`,
    );
  }

  const videoAsset = existingVideoAsset
    ? await prisma.videoAsset.update({
        where: { id: existingVideoAsset.id },
        data: {
          status: "generating",
          selectedTone: context.tone,
          pipeline,
        },
      })
    : await prisma.videoAsset.create({
        data: {
          orgId,
          campaignId,
          status: "generating",
          generation: 1,
          selectedTone: context.tone,
          leadId: null,
          pipeline,
        },
      });

  let imagePrompt: string;
  let videoPrompt: string;

  try {
    ({ imagePrompt, videoPrompt } = await generateApprovedPrompts(
      orgId,
      videoAsset.id,
      prompt,
      context,
    ));
  } catch (error) {
    await markVideoAssetFailed(
      orgId,
      videoAsset.id,
      "prompt-generation-failed",
      error,
    );

    logError({
      path: "prompt-generation-failed",
      videoAssetId: videoAsset.id,
      error: errorMessage(error),
    });
    return;
  }

  try {
    const { buffer: imageBuffer, mimeType: imageMime } =
      context.referenceUrls.length > 0
        ? await generateImageWithAssets(imagePrompt, context.referenceUrls, "9:16")
        : await generateImageFromPrompt(imagePrompt, "9:16");

    const imageExt = imageMime.split("/")[1] ?? "png";
    const imageR2Key = `seed-images/${orgId}/${videoAsset.id}/${randomUUID()}.${imageExt}`;
    const r2 = new R2Adapter();
    const { url: seedImageUrl } = await r2.uploadBuffer(
      imageR2Key,
      imageBuffer,
      imageMime,
    );

    await prisma.videoAsset.update({
      where: { id: videoAsset.id },
      data: { seedImageUrl },
    });

    const variantBase = {
      orgId,
      campaignId,
      status: "generating",
      selectedTone: context.tone,
      seedImageUrl,
      leadId: null,
      pipeline,
    };

    const parallelVariants = getVeoParallelVariants();
    const extraVariants = await Promise.all(
      Array.from({ length: parallelVariants - 1 }, (_, index) =>
        prisma.videoAsset.create({
          data: { ...variantBase, generation: index + 2 },
        }),
      ),
    );

    const veoJobOptions = {
      attempts: 1,
      backoff: { type: "exponential" as const, delay: 30_000 },
    };
    const veoPayload = (videoAssetId: string): VideoGenerationJob => ({
      orgId,
      campaignId,
      leadId,
      prompt,
      pipeline,
      jobType: "veo",
      videoAssetId,
      seedImageUrl,
      videoPrompt,
      tone: context.tone,
      avatar: context.avatar,
      setting: context.setting,
      referenceUrls: context.referenceUrls,
      videoProvider: getConfiguredVideoProvider(),
    });

    await Promise.all(
      [videoAsset, ...extraVariants].map((asset) =>
        videoGenerationQueue.add(
          "generate-veo",
          veoPayload(asset.id),
          { ...veoJobOptions, jobId: `generate-veo:${asset.id}` },
        ),
      ),
    );

    logInfo({
      path: "spawned-veo-jobs",
      videoAssetId: videoAsset.id,
      variants: parallelVariants,
      pipeline,
    });
  } catch (error) {
    await markVideoAssetFailed(
      orgId,
      videoAsset.id,
      "seed-image-or-veo-enqueue-failed",
      error,
    );

    logError({
      path: "seed-image-or-veo-enqueue-failed",
      videoAssetId: videoAsset.id,
      error: errorMessage(error),
    });
  }
}

async function processVeo(job: Job<VideoGenerationJob>): Promise<void> {
  const {
    orgId,
    videoAssetId,
    seedImageUrl,
    videoPrompt,
    tone = "professional",
    setting = "clean professional workspace",
    referenceUrls = [],
    videoProvider = getConfiguredVideoProvider(),
  } = job.data;

  if (!videoAssetId || !seedImageUrl || !videoPrompt) {
    throw new Error("Veo job missing videoAssetId, seedImageUrl, or videoPrompt");
  }

  try {
    const jobId = await reserveOrLoadVeoOperation(
      orgId,
      videoAssetId,
      seedImageUrl,
      videoPrompt,
      referenceUrls,
      videoProvider,
    );
    if (!jobId) return;

    // Renew the active-poll lease before every provider read. A delayed
    // BullMQ job normally polls again in 10 seconds; an expired lease means a
    // worker was lost and the reconciliation worker may safely take over.
    await prisma.videoAsset.updateMany({
      where: {
        id: videoAssetId,
        veoOperationId: jobId,
        veoOperationState: "active",
      },
      data: {
        veoSubmitLeaseAt: new Date(Date.now() + VEO_ACTIVE_POLL_LEASE_MS),
      },
    });

    // One poll per BullMQ execution keeps a slow Veo operation from occupying
    // a worker slot. Pending work moves this exact job back to delayed.
    const jobStatus: VideoJobStatus = await pollVideoJobStatus(jobId);

    if (jobStatus.status === "pending") {
      await job.moveToDelayed(Date.now() + POLL_INTERVAL_MS, job.token);
      throw new DelayedError();
    }

    if (jobStatus.status === "failed") {
      await prisma.videoAsset.update({
        where: { id: videoAssetId },
        data: {
          status: "failed",
          needsReview: true,
          veoOperationState: "failed",
          veoSubmitLeaseAt: null,
        },
      });
      await prisma.auditLog.create({
        data: {
          orgId,
          action: "video.generate.failed",
          resource: "VideoAsset",
          resourceId: videoAssetId,
          metadata: {
            path: "veo-terminal-failure",
            veoJobId: jobId,
            error: toAuditMetadataValue(jobStatus.error),
          },
        },
      });
      return;
    }

    const r2 = new R2Adapter();
    const generatedVideo = await getVideoJobResult(jobId);
    const { videoBuffer, durationMs } = await normalizeVideoDuration(
      generatedVideo.videoBuffer,
      generatedVideo.durationMs,
    );
    const videoR2Key = `videos/${orgId}/${videoAssetId}/${randomUUID()}.mp4`;
    const { url: videoUrl } = await r2.uploadBuffer(videoR2Key, videoBuffer, "video/mp4");
    const frames = await extractRepresentativeFrames(videoBuffer, durationMs);
    const criticResult = await runVideoOutputCritic({
      orgId,
      videoAssetId,
      videoUrl,
      frames,
      tone,
      setting,
      attempt: 1,
    });

    await prisma.videoAsset.update({
      where: { id: videoAssetId },
      data: {
        videoUrl,
        status: "ready",
        criticScore: criticResult.score,
        needsReview: !criticResult.passed,
        veoOperationState: "completed",
        veoSubmitLeaseAt: null,
      },
    });
  } catch (error: unknown) {
    if (
      error instanceof DelayedError ||
      (error instanceof Error && error.name === "DelayedError")
    ) {
      throw error;
    }
    const reviewError = error as ReviewError;
    if (reviewError.needsReview) {
      const videoUrl =
        typeof reviewError.videoUrl === "string" && reviewError.videoUrl.length > 0
          ? reviewError.videoUrl
          : undefined;

      await prisma.videoAsset.update({
        where: { id: videoAssetId },
        data: {
          status: videoUrl ? "ready" : "failed",
          needsReview: true,
          criticScore: reviewError.criticScore ?? 0,
          ...(videoUrl
            ? { videoUrl, veoOperationState: "completed" }
            : { veoOperationState: "failed" }),
        },
      });
      return;
    }

    await markVideoAssetFailed(
      orgId,
      videoAssetId,
      "veo-generation-failed",
      error,
    );
    throw error;
  }
}

async function processVideoGeneration(
  job: Job<VideoGenerationJob>,
): Promise<void> {
  const { jobType = "orchestrate" } = job.data;

  if (jobType === "template-orchestrate") {
    return processTemplateOrchestrate(job);
  }
  if (jobType === "template-veo") {
    return processTemplateVeo(job);
  }
  if (jobType === "personalized-compose") {
    return processPersonalizedCompose(job);
  }
  if (jobType === "veo") {
    return processVeo(job);
  }

  return processOrchestrate(job);
}

export function shouldAttemptUnknownVeoRecovery(
  veoOperationId: string | null,
  veoOperationState: string | null,
  veoSubmitLeaseAt: Date | null,
  now: Date,
): boolean {
  if (!veoOperationId) {
    return false;
  }

  const leaseExpired =
    veoSubmitLeaseAt === null || veoSubmitLeaseAt.getTime() <= now.getTime();
  return (
    (veoOperationState === "active" && leaseExpired) ||
    (veoOperationState === "unknown" && leaseExpired) ||
    (veoOperationState === "recovering" && leaseExpired)
  );
}

async function recoverUnknownVeoOperation(asset: {
  id: string;
  orgId: string;
  selectedTone: string | null;
  veoOperationId: string | null;
  veoOperationState: string | null;
  veoSubmitLeaseAt: Date | null;
}): Promise<boolean> {
  const now = new Date();
  if (
    !shouldAttemptUnknownVeoRecovery(
      asset.veoOperationId,
      asset.veoOperationState,
      asset.veoSubmitLeaseAt,
      now,
    )
  ) {
    return false;
  }

  const operationId = asset.veoOperationId;
  if (!operationId) {
    return false;
  }
  const claimed = await prisma.videoAsset.updateMany({
    where: {
      id: asset.id,
      veoOperationId: operationId,
      OR: [
        {
          veoOperationState: "active",
          veoSubmitLeaseAt: { lte: now },
        },
        {
          veoOperationState: "unknown",
          OR: [
            { veoSubmitLeaseAt: null },
            { veoSubmitLeaseAt: { lte: now } },
          ],
        },
        {
          veoOperationState: "recovering",
          veoSubmitLeaseAt: { lte: now },
        },
      ],
    },
      data: {
        veoOperationState: "recovering",
      veoSubmitLeaseAt: new Date(now.getTime() + VEO_RECOVERY_LEASE_MS),
    },
  });
  if (claimed.count === 0) {
    return false;
  }

  try {
    const jobStatus = await pollVideoJobStatus(operationId);
    if (jobStatus.status === "pending") {
      await prisma.videoAsset.updateMany({
        where: { id: asset.id, veoOperationState: "recovering" },
        data: {
          veoOperationState: "active",
          veoSubmitLeaseAt: new Date(now.getTime() + VEO_RECOVERY_LEASE_MS),
        },
      });
      return false;
    }

    if (jobStatus.status === "failed") {
      await prisma.videoAsset.updateMany({
        where: { id: asset.id, veoOperationState: "recovering" },
        data: {
          status: "failed",
          needsReview: true,
          veoOperationState: "failed",
          veoSubmitLeaseAt: null,
        },
      });
      await prisma.auditLog.create({
        data: {
          orgId: asset.orgId,
          action: "video.generate.failed",
          resource: "VideoAsset",
          resourceId: asset.id,
          metadata: {
            path: "veo-unknown-recovery-terminal-failure",
            veoJobId: operationId,
            error: toAuditMetadataValue(jobStatus.error),
          },
        },
      });
      return false;
    }

    // A completed operation is positive provider evidence. Re-run the normal
    // post-processing gate before exposing its output to the application.
    const r2 = new R2Adapter();
    const generatedVideo = await getVideoJobResult(operationId);
    const { videoBuffer, durationMs } = await normalizeVideoDuration(
      generatedVideo.videoBuffer,
      generatedVideo.durationMs,
    );
    const videoR2Key = `videos/${asset.orgId}/${asset.id}/${randomUUID()}.mp4`;
    const { url: videoUrl } = await r2.uploadBuffer(
      videoR2Key,
      videoBuffer,
      "video/mp4",
    );
    const frames = await extractRepresentativeFrames(videoBuffer, durationMs);
    const criticResult = await runVideoOutputCritic({
      orgId: asset.orgId,
      videoAssetId: asset.id,
      videoUrl,
      frames,
      tone: asset.selectedTone ?? "professional",
      setting: "clean professional workspace",
      attempt: 1,
    });

    const recovered = await prisma.videoAsset.updateMany({
      where: { id: asset.id, veoOperationState: "recovering" },
      data: {
        videoUrl,
        status: "ready",
        criticScore: criticResult.score,
        needsReview: !criticResult.passed,
        veoOperationState: "completed",
        veoSubmitLeaseAt: null,
      },
    });
    if (recovered.count === 0) {
      return false;
    }

    await prisma.auditLog.create({
      data: {
        orgId: asset.orgId,
        action: "video.generate.recovered",
        resource: "VideoAsset",
        resourceId: asset.id,
        metadata: {
          path: "veo-unknown-recovery-completed",
          veoJobId: operationId,
          criticScore: criticResult.score,
          needsReview: !criticResult.passed,
        },
      },
    });
    return true;
  } catch (error) {
    // An inconclusive read or post-processing failure does not prove that the
    // Google operation failed. Keep the operation recoverable for a later run.
    await prisma.videoAsset.updateMany({
      where: { id: asset.id, veoOperationState: "recovering" },
      data: {
        veoOperationState: "unknown",
        veoSubmitLeaseAt: new Date(now.getTime() + VEO_RECOVERY_LEASE_MS),
      },
    });
    logError({
      path: "veo-unknown-recovery-deferred",
      videoAssetId: asset.id,
      veoJobId: operationId,
      error: errorMessage(error),
    });
    return false;
  }
}

export async function reconcileUnknownVeoOperations(): Promise<{
  checked: number;
  recovered: number;
}> {
  const now = new Date();
  const assets = await prisma.videoAsset.findMany({
    where: {
      veoOperationId: { not: null },
      OR: [
        {
          veoOperationState: "active",
          veoSubmitLeaseAt: { lte: now },
        },
        {
          veoOperationState: "unknown",
          OR: [
            { veoSubmitLeaseAt: null },
            { veoSubmitLeaseAt: { lte: now } },
          ],
        },
        {
          veoOperationState: "recovering",
          veoSubmitLeaseAt: { lte: now },
        },
      ],
    },
    select: {
      id: true,
      orgId: true,
      selectedTone: true,
      veoOperationId: true,
      veoOperationState: true,
      veoSubmitLeaseAt: true,
    },
    take: VEO_RECOVERY_BATCH_SIZE,
  });

  let recovered = 0;
  for (const asset of assets) {
    if (await recoverUnknownVeoOperation(asset)) {
      recovered += 1;
    }
  }

  return { checked: assets.length, recovered };
}

async function recoverUnknownTemplateVeoOperation(template: {
  id: string;
  orgId: string;
  selectedTone: string | null;
  veoOperationId: string | null;
  veoOperationState: string | null;
  veoSubmitLeaseAt: Date | null;
}): Promise<boolean> {
  const now = new Date();
  if (!shouldAttemptUnknownVeoRecovery(
    template.veoOperationId,
    template.veoOperationState,
    template.veoSubmitLeaseAt,
    now,
  )) {
    return false;
  }

  const operationId = template.veoOperationId;
  if (!operationId) return false;

  const claimed = await prisma.campaignVideoTemplate.updateMany({
    where: {
      id: template.id,
      veoOperationId: operationId,
      OR: [
        { veoOperationState: "active", veoSubmitLeaseAt: { lte: now } },
        {
          veoOperationState: "unknown",
          OR: [
            { veoSubmitLeaseAt: null },
            { veoSubmitLeaseAt: { lte: now } },
          ],
        },
        { veoOperationState: "recovering", veoSubmitLeaseAt: { lte: now } },
      ],
    },
    data: {
      veoOperationState: "recovering",
      veoSubmitLeaseAt: new Date(now.getTime() + VEO_RECOVERY_LEASE_MS),
    },
  });
  if (claimed.count === 0) return false;

  try {
    const jobStatus = await pollVideoJobStatus(operationId);
    if (jobStatus.status === "pending") {
      await prisma.campaignVideoTemplate.updateMany({
        where: { id: template.id, veoOperationState: "recovering" },
        data: {
          veoOperationState: "active",
          veoSubmitLeaseAt: new Date(now.getTime() + VEO_RECOVERY_LEASE_MS),
        },
      });
      return false;
    }

    if (jobStatus.status === "failed") {
      await markTemplateFailed(
        template.orgId,
        template.id,
        "template-veo-recovery-terminal-failure",
        jobStatus.error,
      );
      return false;
    }

    const recovered = await finalizeTemplateVeoOperation({
      template,
      operationId,
      setting: "clean professional workspace",
      failureMode: "defer",
    });
    if (recovered) {
      await prisma.auditLog.create({
        data: {
          orgId: template.orgId,
          action: "video.template.recovered",
          resource: "CampaignVideoTemplate",
          resourceId: template.id,
          metadata: { path: "template-veo-recovery-completed", veoJobId: operationId },
        },
      });
    }
    return recovered;
  } catch (error) {
    // A provider read failure does not prove a paid operation failed. Keep the
    // persisted operation recoverable; never submit another generation here.
    await prisma.campaignVideoTemplate.updateMany({
      where: { id: template.id, veoOperationState: "recovering" },
      data: {
        veoOperationState: "unknown",
        veoSubmitLeaseAt: new Date(now.getTime() + VEO_RECOVERY_LEASE_MS),
      },
    });
    logError({
      path: "template-veo-recovery-deferred",
      templateId: template.id,
      veoJobId: operationId,
      error: errorMessage(error),
    });
    return false;
  }
}

export async function reconcileUnknownTemplateVeoOperations(): Promise<{
  checked: number;
  recovered: number;
}> {
  const now = new Date();
  const templates = await prisma.campaignVideoTemplate.findMany({
    where: {
      status: "generating",
      veoOperationId: { not: null },
      OR: [
        { veoOperationState: "active", veoSubmitLeaseAt: { lte: now } },
        {
          veoOperationState: "unknown",
          OR: [
            { veoSubmitLeaseAt: null },
            { veoSubmitLeaseAt: { lte: now } },
          ],
        },
        { veoOperationState: "recovering", veoSubmitLeaseAt: { lte: now } },
      ],
    },
    select: {
      id: true,
      orgId: true,
      selectedTone: true,
      veoOperationId: true,
      veoOperationState: true,
      veoSubmitLeaseAt: true,
    },
    take: VEO_RECOVERY_BATCH_SIZE,
  });

  let recovered = 0;
  for (const template of templates) {
    if (await recoverUnknownTemplateVeoOperation(template)) recovered += 1;
  }
  return { checked: templates.length, recovered };
}

export function startVideoGenerationWorker(): Worker<VideoGenerationJob> {
  const worker = new Worker<VideoGenerationJob>(
    QUEUE_VIDEO_GENERATION,
    processVideoGeneration,
    {
      connection: redis,
      concurrency: 6,
      drainDelay: getBullMqIdleDrainDelaySeconds(),
    },
  );

  worker.on("completed", (job) => {
    logInfo({
      path: "job-completed",
      jobId: job.id,
      videoAssetId: job.data.videoAssetId,
      jobType: job.data.jobType ?? "orchestrate",
    });
  });

  worker.on("failed", async (job, error) => {
    logError({
      path: "job-failed",
      jobId: job?.id,
      videoAssetId: job?.data.videoAssetId,
      jobType: job?.data.jobType ?? "orchestrate",
      error: error.message,
    });

    if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
      const { videoAssetId } = job.data;
      if (videoAssetId) {
        try {
          const asset = await prisma.videoAsset.findUnique({
            where: { id: videoAssetId },
            select: { veoOperationId: true, veoOperationState: true },
          });

          if (
            asset?.veoOperationId &&
            asset.veoOperationState === "active"
          ) {
            // The job may have died after Google accepted the operation. Keep
            // it recoverable rather than turning a paid generation into a
            // terminal failure without polling Google first.
            await prisma.videoAsset.updateMany({
              where: {
                id: videoAssetId,
                veoOperationState: "active",
              },
              data: {
                veoOperationState: "unknown",
                veoSubmitLeaseAt: null,
              },
            });
          } else {
            await prisma.videoAsset.update({
              where: { id: videoAssetId },
              data: {
                status: "failed",
                needsReview: true,
                veoOperationState: "failed",
                veoSubmitLeaseAt: null,
              },
            });
          }
        } catch (dbError) {
          logError({
            path: "mark-generation-failed-error",
            videoAssetId,
            error: errorMessage(dbError),
          });
        }
      }
    }
  });

  return worker;
}
