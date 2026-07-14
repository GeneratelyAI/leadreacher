import { randomUUID } from "node:crypto";
import { DelayedError, Job, Worker } from "bullmq";
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
  QUEUE_RECONCILE_VEO_OPERATIONS,
  QUEUE_VIDEO_GENERATION,
  scheduleVeoOperationReconciliation,
  videoGenerationQueue,
} from "../lib/queue.js";
import { extractRepresentativeFrames } from "../lib/video-frames.js";
import { runVideoPromptAgent } from "../modules/agents/video-prompt-agent.js";
import { runVideoOutputCritic } from "../modules/critics/video-output-critic.js";
import { runVideoPromptCritic } from "../modules/critics/video-prompt-critic.js";

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

async function reserveOrLoadVeoOperation(
  orgId: string,
  videoAssetId: string,
  seedImageUrl: string,
  videoPrompt: string,
  referenceUrls: string[],
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
    const { jobId } = await submitVideoJob(
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
          { ...veoJobOptions, jobId: `generate-veo:${asset.id}` },
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

  try {
    const jobId = await reserveOrLoadVeoOperation(
      orgId,
      videoAssetId,
      seedImageUrl,
      videoPrompt,
      referenceUrls,
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
    const jobStatus: VideoJobStatus = await pollJobStatus(jobId);

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
    const { videoBuffer, durationMs } = await getJobResult(jobId);
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
    const jobStatus = await pollJobStatus(operationId);
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
    const { videoBuffer, durationMs } = await getJobResult(operationId);
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

export function startVeoOperationReconciliationWorker(): Worker {
  const worker = new Worker(
    QUEUE_RECONCILE_VEO_OPERATIONS,
    async () => reconcileUnknownVeoOperations(),
    { connection: redis },
  );

  worker.on("failed", (job, error) => {
    logError({
      path: "veo-reconciliation-job-failed",
      jobId: job?.id,
      error: error.message,
    });
  });

  void scheduleVeoOperationReconciliation();
  return worker;
}
