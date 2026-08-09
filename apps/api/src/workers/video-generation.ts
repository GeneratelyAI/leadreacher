import { randomUUID } from "node:crypto";
import { DelayedError, Job, Worker } from "bullmq";
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
} from "../adapters/video-provider.js";
import { R2Adapter } from "../adapters/r2.js";
import { prisma } from "../lib/prisma.js";
import {
  logOperationalError,
  logOperationalInfo,
} from "../lib/operational-logger.js";
import { enqueueOrganizationEmail } from "../services/product-email-outbox.js";
import { redis } from "../lib/redis.js";
import {
  type VideoGenerationJob,
  QUEUE_VIDEO_GENERATION,
  videoGenerationQueue,
} from "../lib/queue.js";
import {
  extractRepresentativeFrames,
  normalizeVideoDuration,
} from "../lib/video-frames.js";
import { runVideoOutputCritic } from "../modules/critics/video-output-critic.js";
import { composePersonalizedVideoAsset } from "../services/personalized-video.js";
import { buildStandardVideoSeedPrompt } from "../lib/video-prompt-brief.js";
import { shouldAttemptUnknownVeoRecovery } from "./video-generation-recovery.js";
import {
  buildVideoContext,
  generateApprovedPrompts,
  resolveSeedPrompt,
  type VideoGenerationPipeline,
} from "./video-generation-context.js";
import {
  finalizeTemplateVeoOperation,
  markTemplateFailed,
  processTemplateOrchestrate,
  processTemplateVeo,
} from "./video-template-generation.js";
import { reserveOrLoadVeoOperation } from "./video-operation-reservation.js";

export {
  reconcileUnknownVeoOperations,
  shouldAttemptUnknownVeoRecovery,
} from "./video-generation-recovery.js";
export { resolveVideoGenerationPipeline } from "./video-generation-context.js";

const POLL_INTERVAL_MS = 10_000;
const VEO_ACTIVE_POLL_LEASE_MS = 2 * 60 * 1000;
const VEO_RECOVERY_LEASE_MS = 5 * 60 * 1000;
const VEO_RECOVERY_BATCH_SIZE = 20;


type ReviewError = Error & {
  criticScore?: number;
  needsReview?: boolean;
  videoUrl?: string;
};

function logInfo(payload: Record<string, unknown>): void {
  logOperationalInfo("video-generation", payload);
}

function logError(payload: Record<string, unknown>): void {
  logOperationalError("video-generation", payload);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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
  try {
    await enqueueOrganizationEmail({
      orgId,
      idempotencyKey: `video-failed:${videoAssetId}`,
      template: "video_generation_failed",
      subject: "A LeadReacher video needs attention",
      text: "Video generation did not complete. Open the campaign in LeadReacher to review the failure and retry safely.",
    });
  } catch (notificationError) {
    logError({ path: "video-failure-notification", videoAssetId, error: errorMessage(notificationError) });
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
      await markVideoAssetFailed(orgId, videoAssetId, "veo-terminal-failure", jobStatus.error);
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
