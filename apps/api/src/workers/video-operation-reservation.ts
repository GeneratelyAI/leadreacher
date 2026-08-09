import type { Prisma } from "@prisma/client";
import {
  submitVideoJobForProvider,
  type VideoProvider,
} from "../adapters/video-provider.js";
import { prisma } from "../lib/prisma.js";

const VEO_SUBMISSION_LEASE_MS = 2 * 60 * 1000;
const VEO_ACTIVE_POLL_LEASE_MS = 2 * 60 * 1000;

function auditValue(value: unknown): Prisma.InputJsonValue {
  try {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  } catch {
    return value instanceof Error ? value.message : String(value);
  }
}

export async function reserveOrLoadVeoOperation(
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
  if (!existing || existing.status === "ready" || existing.status === "failed") return null;
  if (existing.veoOperationId && existing.veoOperationState === "active") {
    return existing.veoOperationId;
  }
  if (existing.veoOperationState === "submitting") {
    if (existing.veoSubmitLeaseAt && existing.veoSubmitLeaseAt.getTime() <= Date.now()) {
      await prisma.videoAsset.updateMany({
        where: { id: videoAssetId, veoOperationState: "submitting" },
        data: { status: "failed", needsReview: true, veoOperationState: "unknown" },
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
  if (existing.veoOperationState === "unknown") return null;

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
  if (reserved.count === 0) return null;

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
        veoSubmitLeaseAt: new Date(Date.now() + VEO_ACTIVE_POLL_LEASE_MS),
      },
    });
    return jobId;
  } catch (error) {
    await prisma.videoAsset.updateMany({
      where: { id: videoAssetId, veoOperationState: "submitting" },
      data: { status: "failed", needsReview: true, veoOperationState: "unknown" },
    });
    await prisma.auditLog.create({
      data: {
        orgId,
        action: "video.generate.failed",
        resource: "VideoAsset",
        resourceId: videoAssetId,
        metadata: { path: "veo-submit-unknown", error: auditValue(error) },
      },
    });
    return null;
  }
}
