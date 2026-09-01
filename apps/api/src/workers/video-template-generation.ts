import { randomUUID } from "node:crypto";
import { DelayedError, type Job } from "bullmq";
import {
  generateImageFromPrompt,
  generateImageWithAssets,
} from "../adapters/google-ai.js";
import { R2Adapter } from "../adapters/r2.js";
import { synthesizeSpeech } from "../adapters/google-tts.js";
import {
  getConfiguredVideoProvider,
  getVideoJobResult,
  pollVideoJobStatus,
  submitVideoJobForProvider,
} from "../adapters/video-provider.js";
import { env } from "../config/env.js";
import { logOperationalError } from "../lib/operational-logger.js";
import { prisma } from "../lib/prisma.js";
import { type VideoGenerationJob, videoGenerationQueue } from "../lib/queue.js";
import {
  assertPersonalizedMasterVideo,
  extractRepresentativeFrames,
  inspectAudioDurationMs,
  inspectVideoMedia,
  normalizeVideoDuration,
  PERSONALIZED_SHARED_NARRATION_DURATION_SECONDS,
} from "../lib/video-frames.js";
import {
  createPersonalizedTemplateManifest,
  sha256,
  updatePersonalizedTemplateManifest,
} from "../lib/personalized-video-manifest.js";
import { buildPersonalizedVideoSeedPrompt } from "../lib/video-prompt-brief.js";
import { runVideoOutputCritic } from "../modules/critics/video-output-critic.js";
import { enqueueOrganizationEmail } from "../services/product-email-outbox.js";
import {
  buildTemplateVideoContext,
  generateApprovedPersonalizedTemplatePrompts,
  resolveSeedPrompt,
  resolveVideoGenerationPipeline,
} from "./video-generation-context.js";

const POLL_INTERVAL_MS = 10_000;
const VEO_SUBMISSION_LEASE_MS = 2 * 60 * 1000;
const VEO_ACTIVE_POLL_LEASE_MS = 2 * 60 * 1000;
const MAX_NARRATION_TIMING_ATTEMPTS = 3;
const AUDIO_DURATION_TOLERANCE_MS = 50;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function generateTimedTemplateNarration(
  orgId: string,
  templateId: string,
  seedPrompt: string,
  context: Parameters<typeof generateApprovedPersonalizedTemplatePrompts>[3],
) {
  const limitMs = PERSONALIZED_SHARED_NARRATION_DURATION_SECONDS * 1000;
  let timingFeedback: string[] = [];
  for (let attempt = 1; attempt <= MAX_NARRATION_TIMING_ATTEMPTS; attempt++) {
    const approved = await generateApprovedPersonalizedTemplatePrompts(
      orgId,
      templateId,
      seedPrompt,
      context,
      timingFeedback,
    );
    const narration = await synthesizeSpeech(approved.sharedNarration);
    const narrationDurationMs = await inspectAudioDurationMs(narration);
    if (narrationDurationMs <= limitMs + AUDIO_DURATION_TOLERANCE_MS) {
      return { approved, narration, narrationDurationMs };
    }
    timingFeedback = [
      `The shared narration rendered at ${narrationDurationMs}ms and must fit within ${limitMs}ms. Rewrite it with shorter words and a more concise cadence while keeping 14-18 words.`,
    ];
  }
  throw new Error(
    `Shared narration exceeded ${limitMs}ms after ${MAX_NARRATION_TIMING_ATTEMPTS} attempts`,
  );
}

export async function markTemplateFailed(
  orgId: string,
  templateId: string,
  path: string,
  error: unknown,
): Promise<void> {
  await prisma.campaignVideoTemplate.update({
    where: { id: templateId },
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
      action: "video.template.failed",
      resource: "CampaignVideoTemplate",
      resourceId: templateId,
      metadata: { path, error: errorMessage(error) },
    },
  });
  try {
    await enqueueOrganizationEmail({
      orgId,
      idempotencyKey: `video-template-failed:${templateId}`,
      template: "video_generation_failed",
      subject: "A LeadReacher campaign video needs attention",
      text: "The shared campaign video could not be generated. Open the campaign in LeadReacher to review the failure and retry safely.",
    });
  } catch (notificationError) {
    logOperationalError("video-generation", {
      path: "template-failure-notification",
      templateId,
      error: errorMessage(notificationError),
    });
  }
}

export async function processTemplateOrchestrate(
  job: Job<VideoGenerationJob>,
): Promise<void> {
  const { orgId, campaignId } = job.data;
  const campaign = await prisma.campaign.findFirst({ where: { id: campaignId, orgId } });
  if (!campaign) throw new Error(`Campaign ${campaignId} not found for org ${orgId}`);
  const strategy = campaign.strategyId
    ? await prisma.strategy.findFirst({ where: { id: campaign.strategyId, orgId } })
    : null;
  if (resolveVideoGenerationPipeline(strategy, campaign) !== "personalized") return;

  const template = await prisma.campaignVideoTemplate.upsert({
    where: { campaignId_version: { campaignId, version: 1 } },
    create: { orgId, campaignId, version: 1, voice: env.PERSONALIZED_VIDEO_TTS_VOICE },
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
    const { approved, narration, narrationDurationMs } = await generateTimedTemplateNarration(
      orgId,
      template.id,
      prompt,
      context,
    );
    const image = context.referenceUrls.length > 0
      ? await generateImageWithAssets(approved.imagePrompt, context.referenceUrls, "9:16")
      : await generateImageFromPrompt(approved.imagePrompt, "9:16");
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
      narrationDurationMs,
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
      { jobId: `personalized-template-veo-${template.id}`, attempts: 1 },
    );
  } catch (error) {
    await markTemplateFailed(orgId, template.id, "template-orchestration-failed", error);
    throw error;
  }
}

export async function processTemplateVeo(job: Job<VideoGenerationJob>): Promise<void> {
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
  const template = await prisma.campaignVideoTemplate.findFirst({ where: { id: templateId, orgId } });
  if (!template || template.status === "failed" || template.status === "ready") return;

  let operationId = template.veoOperationId;
  if (!operationId) {
    if (template.veoOperationState === "submitting") {
      const leaseExpired = !template.veoSubmitLeaseAt || template.veoSubmitLeaseAt.getTime() <= Date.now();
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
      where: { id: template.id, veoOperationId: null, veoOperationState: null },
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

export async function finalizeTemplateVeoOperation(input: {
  template: { id: string; orgId: string; selectedTone: string | null };
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
          metadata: {
            path: "template-output-critic-failed",
            score: critic.score,
            issues: critic.issues,
          },
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
