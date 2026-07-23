import { randomUUID } from "node:crypto";
import { R2Adapter } from "../adapters/r2.js";
import { synthesizeSpeech } from "../adapters/google-tts.js";
import { composePersonalizedVideo } from "../lib/video-frames.js";
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

export type PersonalizedVideoDelivery = {
  videoUrl: string;
  buffer: Buffer;
  filename: string;
  contentType: "video/mp4";
};

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
        prompt: `Generate the shared personalized B2B outreach video template for ${campaign.name}.`,
        pipeline: "personalized",
        jobType: "template-orchestrate",
      },
      { jobId: `personalized-template:${campaign.id}:1` },
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
    { jobId: `personalized-compose:${template.id}:${input.leadId}`, attempts: 3 },
  );
  return { state: "pending" };
}

export async function getReadyPersonalizedVideoUrl(input: {
  campaignId: string;
  leadId: string;
}): Promise<string | null> {
  const asset = await prisma.videoAsset.findFirst({
    where: {
      campaignId: input.campaignId,
      leadId: input.leadId,
      pipeline: "personalized",
      status: "ready",
      videoUrl: { not: null },
    },
    orderBy: { updatedAt: "desc" },
    select: { videoUrl: true },
  });
  return asset?.videoUrl ?? null;
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

  const videoUrl = await getReadyPersonalizedVideoUrl(input);
  if (!videoUrl) return null;

  const response = await fetch(videoUrl);
  if (!response.ok) {
    throw new Error(`Personalized video download failed: ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength > MAX_LINKEDIN_VIDEO_MESSAGE_BYTES) {
    throw new Error(
      `Personalized video is ${buffer.byteLength} bytes; LinkedIn native video messages are limited to ${MAX_LINKEDIN_VIDEO_MESSAGE_BYTES} bytes`,
    );
  }

  return {
    videoUrl,
    buffer,
    filename: `personalized-video-${input.leadId}.mp4`,
    contentType: "video/mp4",
  };
}

async function fetchPublicMedia(url: string, label: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${label} download failed: ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
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
    const [masterVideo, sharedNarration, greeting] = await Promise.all([
      fetchPublicMedia(asset.template.masterVideoUrl, "Template video"),
      fetchPublicMedia(asset.template.sharedNarrationUrl, "Template narration"),
      synthesizeSpeech(`Hey ${asset.lead.firstName},`),
    ]);
    const composed = await composePersonalizedVideo(
      masterVideo,
      greeting,
      sharedNarration,
    );
    const r2 = new R2Adapter();
    const { url } = await r2.uploadBuffer(
      `personalized-videos/${input.orgId}/${asset.template.id}/${asset.leadId}/${randomUUID()}.mp4`,
      composed.videoBuffer,
      "video/mp4",
    );
    await prisma.videoAsset.update({
      where: { id: asset.id },
      data: { status: "ready", videoUrl: url, needsReview: false },
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
