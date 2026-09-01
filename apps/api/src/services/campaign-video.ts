import { randomUUID } from "node:crypto";
import { R2Adapter } from "../adapters/r2.js";
import { synthesizeSpeech } from "../adapters/google-tts.js";
import {
  assertPersonalizedDeliveryVideo,
  composePersonalizedVideo,
  inspectAudioDurationMs,
  inspectVideoMedia,
  PERSONALIZED_GREETING_DURATION_SECONDS,
  speedUpAudio,
} from "../lib/video-frames.js";
import {
  PersonalizedRenderManifestSchema,
  sha256,
  updatePersonalizedTemplateManifest,
} from "../lib/personalized-video-manifest.js";
import { prisma } from "../lib/prisma.js";
import {
  QUEUE_VIDEO_GENERATION,
  videoGenerationQueue,
} from "../lib/queue.js";

type ReadyState =
  | { state: "not-required" }
  | { state: "pending" }
  | { state: "ready"; videoUrl: string }
  | { state: "failed"; reason: string };

const MAX_LINKEDIN_VIDEO_MESSAGE_BYTES = 15 * 1024 * 1024;
const MAX_GREETING_TEMPO = 1.2;
const GREETING_DURATION_TOLERANCE_MS = 50;

export async function fitGreetingAudio(audio: Buffer): Promise<Buffer | null> {
  const limitMs = PERSONALIZED_GREETING_DURATION_SECONDS * 1000;
  const durationMs = await inspectAudioDurationMs(audio);
  if (durationMs <= limitMs + GREETING_DURATION_TOLERANCE_MS) return audio;

  const requiredTempo = durationMs / limitMs;
  const adjusted = await speedUpAudio(audio, Math.min(MAX_GREETING_TEMPO, requiredTempo * 1.02));
  return await inspectAudioDurationMs(adjusted) <= limitMs + GREETING_DURATION_TOLERANCE_MS
    ? adjusted
    : null;
}

export async function createPersonalizedGreetingAudio(
  firstName: string,
  speechSynthesizer: typeof synthesizeSpeech = synthesizeSpeech,
): Promise<Buffer> {
  const name = firstName.replace(/\s+/g, " ").trim();
  if (!name) throw new Error("Lead first name is required for personalized video");

  const fullGreeting = await speechSynthesizer(`Hey ${name},`, { mockDurationSeconds: 1 });
  const fittedGreeting = await fitGreetingAudio(fullGreeting);
  if (fittedGreeting) return fittedGreeting;

  const shortGreeting = await speechSynthesizer(name, { mockDurationSeconds: 1 });
  const fittedShortGreeting = await fitGreetingAudio(shortGreeting);
  if (fittedShortGreeting) return fittedShortGreeting;

  throw new Error(`Could not fit the personalized greeting for ${name} within 1.5 seconds`);
}

export type PersonalizedVideoDelivery = {
  videoUrl: string;
  thumbnailUrl?: string;
  buffer: Buffer;
  filename: string;
  contentType: string;
};

export function templateUsesNativeOmniEndCard(renderManifest: unknown): boolean {
  const parsed = PersonalizedRenderManifestSchema.safeParse(renderManifest);
  return parsed.success && parsed.data.provider.name === "omni";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function isPersonalizedStrategy(strategy: {
  campaignType: string | null;
  videoConfig: unknown;
} | null): boolean {
  const config = asRecord(strategy?.videoConfig);
  return strategy?.campaignType === "personalized_outreach" &&
    config?.enabled === true &&
    config?.mode === "personalized" &&
    config.source === "generated";
}

function campaignVideoConfig(aiConfig: unknown): Record<string, unknown> | null {
  const config = asRecord(aiConfig);
  return asRecord(config?.video);
}

function isEnabledVideo(config: Record<string, unknown> | null): boolean {
  return config?.enabled === true && typeof config.source === "string";
}

function videoFilename(url: string, fallback: string): string {
  const pathname = new URL(url).pathname;
  const filename = pathname.split("/").pop();
  return filename && /\.[a-z0-9]{1,10}$/i.test(filename) ? filename : fallback;
}

async function downloadVideoForDelivery(
  videoUrl: string,
  fallbackFilename: string,
  thumbnailUrl?: string | null,
): Promise<PersonalizedVideoDelivery> {
  const response = await fetch(videoUrl);
  if (!response.ok) {
    throw new Error(`Campaign video download failed: ${response.status}`);
  }

  const contentType = (response.headers.get("content-type") ?? "video/mp4")
    .split(";", 1)[0]
    ?.trim()
    .toLowerCase() ?? "video/mp4";
  if (!contentType.startsWith("video/")) {
    throw new Error("Campaign video must resolve to a video file");
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength > MAX_LINKEDIN_VIDEO_MESSAGE_BYTES) {
    throw new Error(
      `Campaign video is ${buffer.byteLength} bytes; LinkedIn native video messages are limited to ${MAX_LINKEDIN_VIDEO_MESSAGE_BYTES} bytes`,
    );
  }

  return {
    videoUrl,
    ...(thumbnailUrl ? { thumbnailUrl } : {}),
    buffer,
    filename: videoFilename(videoUrl, fallbackFilename),
    contentType,
  };
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

async function getOrCreateLeadAsset(input: {
  orgId: string;
  campaignId: string;
  leadId: string;
  templateId: string;
}): Promise<{ id: string; status: string; videoUrl: string | null }> {
  const existing = await prisma.videoAsset.findUnique({
    where: {
      templateId_leadId: {
        templateId: input.templateId,
        leadId: input.leadId,
      },
    },
    select: { id: true, status: true, videoUrl: true },
  });
  if (existing) return existing;

  try {
    return await prisma.videoAsset.create({
      data: {
        orgId: input.orgId,
        campaignId: input.campaignId,
        leadId: input.leadId,
        templateId: input.templateId,
        pipeline: "personalized",
        status: "pending",
        generation: 1,
      },
      select: { id: true, status: true, videoUrl: true },
    });
  } catch (error) {
    if (!isUniqueViolation(error)) {
      throw error;
    }
    const concurrent = await prisma.videoAsset.findUnique({
      where: {
        templateId_leadId: {
          templateId: input.templateId,
          leadId: input.leadId,
        },
      },
      select: { id: true, status: true, videoUrl: true },
    });
    if (!concurrent) throw new Error("Could not reserve personalized video asset");
    return concurrent;
  }
}

export async function ensurePersonalizedVideoReady(input: {
  orgId: string;
  campaignId: string;
  leadId: string;
}): Promise<ReadyState> {
  const campaign = await prisma.campaign.findFirst({
    where: { id: input.campaignId, orgId: input.orgId },
    select: { id: true, name: true, strategyId: true },
  });
  if (!campaign) return { state: "failed", reason: "Campaign not found" };

  const strategy = campaign.strategyId
    ? await prisma.strategy.findFirst({
        where: { id: campaign.strategyId, orgId: input.orgId },
        select: { campaignType: true, videoConfig: true },
      })
    : null;
  if (!isPersonalizedStrategy(strategy)) return { state: "not-required" };

  let template = await prisma.campaignVideoTemplate.findUnique({
    where: { campaignId_version: { campaignId: campaign.id, version: 1 } },
    select: { id: true, status: true },
  });

  if (!template) {
    await videoGenerationQueue.add(
      "personalized-template-orchestrate",
      {
        orgId: input.orgId,
        campaignId: campaign.id,
        pipeline: "personalized",
        jobType: "template-orchestrate",
      },
      { jobId: `personalized-template-${campaign.id}-1` },
    );
    return { state: "pending" };
  }

  if (template.status === "failed") {
    return { state: "failed", reason: "Campaign video template generation failed" };
  }
  if (template.status !== "ready") return { state: "pending" };

  const asset = await getOrCreateLeadAsset({ ...input, templateId: template.id });
  if (asset.status === "ready" && asset.videoUrl) {
    return { state: "ready", videoUrl: asset.videoUrl };
  }
  if (asset.status === "failed") {
    return { state: "failed", reason: "Lead video composition failed" };
  }

  await videoGenerationQueue.add(
    "compose-personalized-video",
    {
      orgId: input.orgId,
      campaignId: input.campaignId,
      leadId: input.leadId,
      pipeline: "personalized",
      jobType: "personalized-compose",
      videoAssetId: asset.id,
      templateId: template.id,
    },
    { jobId: `personalized-compose-${template.id}-${input.leadId}`, attempts: 3 },
  );
  return { state: "pending" };
}

/**
 * Resolves the video mode saved with a reviewed campaign. Every outbound video
 * format uses this before the connection request so a follow-up never starts
 * without the video the operator approved.
 */
export async function ensureCampaignVideoReady(input: {
  orgId: string;
  campaignId: string;
  leadId: string;
}): Promise<ReadyState> {
  const campaign = await prisma.campaign.findFirst({
    where: { id: input.campaignId, orgId: input.orgId },
    select: { aiConfig: true },
  });
  const config = campaignVideoConfig(campaign?.aiConfig);
  if (!isEnabledVideo(config)) return { state: "not-required" };

  if (config?.source === "uploaded") {
    return typeof config.uploadedVideoUrl === "string" && config.uploadedVideoUrl.length > 0
      ? { state: "ready", videoUrl: config.uploadedVideoUrl }
      : { state: "failed", reason: "Uploaded campaign video is unavailable" };
  }

  if (config?.mode === "personalized") {
    return ensurePersonalizedVideoReady(input);
  }

  if (config?.source !== "generated" || config.mode !== "standardized") {
    return { state: "failed", reason: "Campaign video configuration is invalid" };
  }

  const asset = await prisma.videoAsset.findFirst({
    where: { orgId: input.orgId, campaignId: input.campaignId, pipeline: "standard" },
    orderBy: { updatedAt: "desc" },
    select: { status: true, videoUrl: true },
  });
  if (asset?.status === "ready" && asset.videoUrl) {
    return { state: "ready", videoUrl: asset.videoUrl };
  }
  if (asset?.status === "failed" || asset?.status === "rejected") {
    return { state: "failed", reason: "AI campaign video generation failed" };
  }

  await videoGenerationQueue.add(
    "standard-campaign-video-orchestrate",
    {
      orgId: input.orgId,
      campaignId: input.campaignId,
      leadId: input.leadId,
      pipeline: "standard",
      jobType: "orchestrate",
    },
    {
      jobId: `standard-campaign-video-${input.campaignId}`,
      attempts: 3,
    },
  );
  return { state: "pending" };
}

export async function getReadyPersonalizedVideoForDelivery(input: {
  campaignId: string;
  leadId: string;
}): Promise<PersonalizedVideoDelivery | null> {
  const campaign = await prisma.campaign.findFirst({
    where: { id: input.campaignId },
    select: { aiConfig: true },
  });
  const videoConfig =
    campaign?.aiConfig && typeof campaign.aiConfig === "object" && !Array.isArray(campaign.aiConfig)
      ? (campaign.aiConfig as Record<string, unknown>).video
      : null;
  const paused =
    videoConfig && typeof videoConfig === "object" && !Array.isArray(videoConfig)
      ? (videoConfig as Record<string, unknown>).paused === true
      : false;
  if (paused) return null;

  const asset = await prisma.videoAsset.findFirst({
    where: {
      campaignId: input.campaignId,
      leadId: input.leadId,
      pipeline: "personalized",
      status: "ready",
      videoUrl: { not: null },
    },
    orderBy: { updatedAt: "desc" },
    select: { videoUrl: true, thumbnailUrl: true },
  });
  if (!asset?.videoUrl) return null;

  return downloadVideoForDelivery(asset.videoUrl, `personalized-video-${input.leadId}.mp4`, asset.thumbnailUrl);
}

/** Return the exact approved campaign video to attach to a direct message. */
export async function getReadyCampaignVideoForDelivery(input: {
  campaignId: string;
  leadId: string;
}): Promise<PersonalizedVideoDelivery | null> {
  const campaign = await prisma.campaign.findFirst({
    where: { id: input.campaignId },
    select: { aiConfig: true },
  });
  const config = campaignVideoConfig(campaign?.aiConfig);
  if (!isEnabledVideo(config) || config?.paused === true) return null;

  if (config?.source === "uploaded" && typeof config.uploadedVideoUrl === "string") {
    return downloadVideoForDelivery(config.uploadedVideoUrl, "uploaded-campaign-video.mp4");
  }

  if (config?.source === "generated" && config.mode === "standardized") {
    const asset = await prisma.videoAsset.findFirst({
      where: {
        campaignId: input.campaignId,
        pipeline: "standard",
        status: "ready",
        videoUrl: { not: null },
      },
      orderBy: { updatedAt: "desc" },
      select: { videoUrl: true, thumbnailUrl: true },
    });
    return asset?.videoUrl
      ? downloadVideoForDelivery(asset.videoUrl, "ai-campaign-video.mp4", asset.thumbnailUrl)
      : null;
  }

  return getReadyPersonalizedVideoForDelivery(input);
}

async function fetchPublicMedia(url: string, label: string): Promise<{
  buffer: Buffer;
  mimeType: string;
}> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${label} download failed: ${response.status}`);
  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    mimeType: (response.headers.get("content-type") ?? "application/octet-stream")
      .split(";")[0]
      .trim()
      .toLowerCase(),
  };
}

function imageExtension(mimeType: string): string {
  switch (mimeType) {
    case "image/png": return "png";
    case "image/jpeg": return "jpg";
    case "image/webp": return "webp";
    case "image/svg+xml": return "svg";
    default: throw new Error(`Unsupported logo format for personalized end card: ${mimeType}`);
  }
}

export async function composePersonalizedVideoAsset(input: {
  orgId: string;
  videoAssetId: string;
  templateId: string;
}): Promise<void> {
  const asset = await prisma.videoAsset.findFirst({
    where: { id: input.videoAssetId, orgId: input.orgId, templateId: input.templateId },
    include: { lead: { select: { firstName: true } }, template: true },
  });
  if (!asset) throw new Error("Personalized video asset not found");
  if (asset.status === "ready" && asset.videoUrl) return;
  if (!asset.lead || !asset.template?.masterVideoUrl || !asset.template.sharedNarrationUrl) {
    throw new Error("Personalized video asset is missing its lead or ready template media");
  }

  await prisma.videoAsset.update({
    where: { id: asset.id },
    data: { status: "generating" },
  });

  try {
    const nativeOmniEndCard = templateUsesNativeOmniEndCard(asset.template.renderManifest);
    const [masterVideo, sharedNarration, greeting, logo] = await Promise.all([
      fetchPublicMedia(asset.template.masterVideoUrl, "Template video"),
      fetchPublicMedia(asset.template.sharedNarrationUrl, "Template narration"),
      createPersonalizedGreetingAudio(asset.lead.firstName),
      asset.template.logoUrl && !nativeOmniEndCard
        ? fetchPublicMedia(asset.template.logoUrl, "Template logo")
        : Promise.resolve(null),
    ]);
    const composed = await composePersonalizedVideo(
      masterVideo.buffer,
      greeting,
      sharedNarration.buffer,
      logo && !nativeOmniEndCard
        ? { buffer: logo.buffer, extension: imageExtension(logo.mimeType) }
        : undefined,
    );
    const deliveryMedia = await inspectVideoMedia(composed.videoBuffer);
    assertPersonalizedDeliveryVideo(deliveryMedia);
    const r2 = new R2Adapter();
    const { url } = await r2.uploadBuffer(
      `personalized-videos/${input.orgId}/${asset.template.id}/${asset.leadId}/${randomUUID()}.mp4`,
      composed.videoBuffer,
      "video/mp4",
    );
    const renderManifest = asset.template.renderManifest
      ? updatePersonalizedTemplateManifest(asset.template.renderManifest, {
        assets: {
          ...(logo ? { logoSha256: sha256(logo.buffer) } : {}),
          deliveryVideoSha256: sha256(composed.videoBuffer),
        },
        quality: {
          outputAudioStreams: deliveryMedia.audioStreams,
          greetingDurationMs: composed.audioTiming.greetingDurationMs,
          narrationDurationMs: composed.audioTiming.narrationDurationMs,
          durationMs: deliveryMedia.durationMs,
          width: deliveryMedia.width,
          height: deliveryMedia.height,
        },
      })
      : null;
    await prisma.videoAsset.update({
      where: { id: asset.id },
      data: {
        status: "ready",
        videoUrl: url,
        needsReview: false,
        ...(renderManifest ? { renderManifest } : {}),
      },
    });
  } catch (error) {
    await prisma.videoAsset.update({
      where: { id: asset.id },
      data: { status: "failed", needsReview: true },
    });
    await prisma.auditLog.create({
      data: {
        orgId: input.orgId,
        action: "video.personalized.compose.failed",
        resource: "VideoAsset",
        resourceId: asset.id,
        metadata: { error: error instanceof Error ? error.message : String(error) },
      },
    });
    throw error;
  }
}
