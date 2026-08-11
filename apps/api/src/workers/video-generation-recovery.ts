import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { R2Adapter } from "../adapters/r2.js";
import { getVideoJobResult, pollVideoJobStatus } from "../adapters/video-provider.js";
import { logOperationalError } from "../lib/operational-logger.js";
import { prisma } from "../lib/prisma.js";
import {
  extractRepresentativeFrames,
  normalizeVideoDuration,
} from "../lib/video-frames.js";
import { runVideoOutputCritic } from "../modules/critics/video-output-critic.js";

const VEO_RECOVERY_LEASE_MS = 5 * 60 * 1000;
const VEO_RECOVERY_BATCH_SIZE = 20;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function auditValue(error: unknown): Prisma.InputJsonValue {
  try {
    return JSON.parse(JSON.stringify(error)) as Prisma.InputJsonValue;
  } catch {
    return errorMessage(error);
  }
}

export function shouldAttemptUnknownVeoRecovery(
  veoOperationId: string | null,
  veoOperationState: string | null,
  veoSubmitLeaseAt: Date | null,
  now: Date,
): boolean {
  if (!veoOperationId) return false;

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
  if (!shouldAttemptUnknownVeoRecovery(
    asset.veoOperationId,
    asset.veoOperationState,
    asset.veoSubmitLeaseAt,
    now,
  )) return false;

  const operationId = asset.veoOperationId;
  if (!operationId) return false;

  const claimed = await prisma.videoAsset.updateMany({
    where: {
      id: asset.id,
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
            error: auditValue(jobStatus.error),
          },
        },
      });
      return false;
    }

    const r2 = new R2Adapter();
    const generatedVideo = await getVideoJobResult(operationId);
    const { videoBuffer, durationMs } = await normalizeVideoDuration(
      generatedVideo.videoBuffer,
      generatedVideo.durationMs,
    );
    const videoR2Key = `videos/${asset.orgId}/${asset.id}/${randomUUID()}.mp4`;
    const { url: videoUrl } = await r2.uploadBuffer(videoR2Key, videoBuffer, "video/mp4");
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
    if (recovered.count === 0) return false;

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
    await prisma.videoAsset.updateMany({
      where: { id: asset.id, veoOperationState: "recovering" },
      data: {
        veoOperationState: "unknown",
        veoSubmitLeaseAt: new Date(now.getTime() + VEO_RECOVERY_LEASE_MS),
      },
    });
    logOperationalError("video-generation", {
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
  for (const asset of assets) {
    if (await recoverUnknownVeoOperation(asset)) recovered += 1;
  }
  return { checked: assets.length, recovered };
}
