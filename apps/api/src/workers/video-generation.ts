import { randomUUID } from "node:crypto";
import { Job, Worker } from "bullmq";
import type { Prisma } from "@prisma/client";
import { getVeoParallelVariants } from "../config/env.js";
import {
  generateImageFromPrompt,
  generateImageWithAssets,
  getJobResult,
  pollJobStatus,
  submitVideoJob,
  type VideoJobStatus,
} from "../adapters/google-ai.js";
import { R2Adapter } from "../adapters/r2.js";
import { prisma } from "../lib/prisma.js";
import { redis } from "../lib/redis.js";
import {
  type VideoGenerationJob,
  QUEUE_VIDEO_GENERATION,
  videoGenerationQueue,
} from "../lib/queue.js";
import { extractRepresentativeFrames } from "../lib/video-frames.js";
import { runVideoPromptAgent } from "../modules/agents/video-prompt-agent.js";
import { runVideoOutputCritic } from "../modules/critics/video-output-critic.js";
import { runVideoPromptCritic } from "../modules/critics/video-prompt-critic.js";

const POLL_INTERVAL_MS = 10_000;
const MAX_POLL_DURATION_MS = 300_000;
const MAX_PROMPT_ATTEMPTS = 3;
const MAX_OUTPUT_ATTEMPTS = 3;

type CampaignRecord = Prisma.CampaignGetPayload<Record<string, never>>;
type LeadRecord = Prisma.LeadGetPayload<Record<string, never>>;
type StrategyRecord = Prisma.StrategyGetPayload<Record<string, never>>;

type VideoContext = {
  product: string;
  audience: string;
  tone: string;
  avatar: string;
  setting: string;
  referenceUrls: string[];
};

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
    data: { status: "failed", needsReview: true },
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

function buildVideoContext(
  job: VideoGenerationJob,
  campaign: CampaignRecord,
  lead: LeadRecord,
  strategy: StrategyRecord | null,
): VideoContext {
  const aiConfig = asRecord(campaign.aiConfig);
  const videoConfig = asRecord(aiConfig?.["video"]);
  const positioning = asRecord(strategy?.positioning);
  const icpDefinition = asRecord(strategy?.icpDefinition);
  const creativeAssets = asRecord(strategy?.creativeAssets);

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
        `${lead.title} at ${lead.company}`,
      ) ?? `${lead.title} at ${lead.company}`,
    tone:
      firstString(
        job.tone,
        recordString(videoConfig, "tone"),
        recordString(aiConfig, "tone"),
        "professional",
      ) ?? "professional",
    avatar:
      firstString(
        job.avatar,
        recordString(videoConfig, "avatar"),
        recordString(aiConfig, "avatar"),
        "professional spokesperson",
      ) ?? "professional spokesperson",
    setting:
      firstString(
        job.setting,
        recordString(videoConfig, "setting"),
        recordString(aiConfig, "setting"),
        "clean professional workspace",
      ) ?? "clean professional workspace",
    referenceUrls: [
      ...new Set([
        ...collectUrls(job.referenceUrls),
        ...collectUrls(videoConfig?.["referenceUrls"]),
        ...collectUrls(creativeAssets?.["referenceUrls"]),
      ]),
    ],
  };
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

async function generateApprovedVideo(
  orgId: string,
  videoAssetId: string,
  seedImageUrl: string,
  videoPrompt: string,
  context: Pick<VideoContext, "tone" | "setting" | "referenceUrls">,
  r2: R2Adapter,
): Promise<{ videoUrl: string; criticScore: number }> {
  let lastScore = 0;
  let lastVideoUrl: string | undefined;

  for (let attempt = 1; attempt <= MAX_OUTPUT_ATTEMPTS; attempt++) {
    const { jobId } = await submitVideoJob(
      seedImageUrl,
      videoPrompt,
      context.referenceUrls,
      "9:16",
    );

    const pollStart = Date.now();
    let jobStatus: VideoJobStatus = { status: "pending" };

    while (Date.now() - pollStart < MAX_POLL_DURATION_MS) {
      await sleep(POLL_INTERVAL_MS);
      jobStatus = await pollJobStatus(jobId);
      if (jobStatus.status === "complete" || jobStatus.status === "failed") {
        break;
      }
    }

    if (jobStatus.status !== "complete") {
      const pollError =
        jobStatus.status === "failed"
          ? (jobStatus.error ?? "Veo job failed without error details")
          : "Veo job did not complete before the poll timeout";

      await prisma.auditLog.create({
        data: {
          orgId,
          action: "video.generate.failed",
          resource: "VideoAsset",
          resourceId: videoAssetId,
          metadata: {
            path: "veo-job-incomplete",
            error: toAuditMetadataValue(pollError),
            veoJobId: jobId,
            attempt,
            status: jobStatus.status,
          },
        },
      });

      logInfo({
        path: "veo-job-incomplete",
        videoAssetId,
        veoJobId: jobId,
        attempt,
        status: jobStatus.status,
        error: pollError,
      });
      continue;
    }

    const { videoBuffer, durationMs } = await getJobResult(jobId);
    const videoR2Key = `videos/${orgId}/${videoAssetId}/attempt-${attempt}-${randomUUID()}.mp4`;
    const { url: videoUrl } = await r2.uploadBuffer(
      videoR2Key,
      videoBuffer,
      "video/mp4",
    );
    lastVideoUrl = videoUrl;
    const frames = await extractRepresentativeFrames(videoBuffer, durationMs);

    const criticResult = await runVideoOutputCritic({
      orgId,
      videoAssetId,
      videoUrl,
      frames,
      tone: context.tone,
      setting: context.setting,
      attempt,
    });

    lastScore = criticResult.score;

    if (criticResult.passed) {
      return { videoUrl, criticScore: criticResult.score };
    }

    logInfo({
      path: "output-critic-failed",
      videoAssetId,
      attempt,
      maxAttempts: MAX_OUTPUT_ATTEMPTS,
      score: criticResult.score,
      issues: criticResult.issues,
    });
  }

  throw Object.assign(
    new Error(`Output critic failed after ${MAX_OUTPUT_ATTEMPTS} attempts`),
    {
      criticScore: lastScore,
      needsReview: true,
      videoUrl: lastVideoUrl,
    },
  );
}

async function processOrchestrate(
  job: Job<VideoGenerationJob>,
): Promise<void> {
  const { orgId, campaignId, leadId, prompt } = job.data;

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
        },
      })
    : await prisma.videoAsset.create({
        data: {
          orgId,
          campaignId,
          status: "generating",
          generation: 1,
          selectedTone: context.tone,
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
      jobType: "veo",
      videoAssetId,
      seedImageUrl,
      videoPrompt,
      tone: context.tone,
      avatar: context.avatar,
      setting: context.setting,
      referenceUrls: context.referenceUrls,
    });

    await Promise.all(
      [videoAsset, ...extraVariants].map((asset) =>
        videoGenerationQueue.add(
          "generate-veo",
          veoPayload(asset.id),
          veoJobOptions,
        ),
      ),
    );

    logInfo({
      path: "spawned-veo-jobs",
      videoAssetId: videoAsset.id,
      variants: parallelVariants,
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
  } = job.data;

  if (!videoAssetId || !seedImageUrl || !videoPrompt) {
    throw new Error("Veo job missing videoAssetId, seedImageUrl, or videoPrompt");
  }

  const r2 = new R2Adapter();

  try {
    const { videoUrl, criticScore } = await generateApprovedVideo(
      orgId,
      videoAssetId,
      seedImageUrl,
      videoPrompt,
      { tone, setting, referenceUrls },
      r2,
    );

    await prisma.videoAsset.update({
      where: { id: videoAssetId },
      data: { videoUrl, status: "ready", criticScore },
    });
  } catch (error: unknown) {
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
          ...(videoUrl ? { videoUrl } : {}),
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

  if (jobType === "veo") {
    return processVeo(job);
  }

  return processOrchestrate(job);
}

export function startVideoGenerationWorker(): Worker<VideoGenerationJob> {
  const worker = new Worker<VideoGenerationJob>(
    QUEUE_VIDEO_GENERATION,
    processVideoGeneration,
    {
      connection: redis,
      concurrency: 6,
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
          await prisma.videoAsset.update({
            where: { id: videoAssetId },
            data: { status: "failed", needsReview: true },
          });
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
