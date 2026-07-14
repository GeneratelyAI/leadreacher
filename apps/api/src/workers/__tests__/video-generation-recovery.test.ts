import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  findMany,
  updateMany,
  auditCreate,
  getJobResult,
  pollJobStatus,
  uploadBuffer,
  extractFrames,
  runOutputCritic,
} = vi.hoisted(() => ({
  findMany: vi.fn(),
  updateMany: vi.fn(),
  auditCreate: vi.fn(),
  getJobResult: vi.fn(),
  pollJobStatus: vi.fn(),
  uploadBuffer: vi.fn(),
  extractFrames: vi.fn(),
  runOutputCritic: vi.fn(),
}));

vi.mock("bullmq", () => ({
  DelayedError: class DelayedError extends Error {},
  Worker: class {
    on() {
      return this;
    }
  },
}));
vi.mock("../../config/env.js", () => ({ getVeoParallelVariants: () => 1 }));
vi.mock("../../adapters/google-ai.js", () => ({
  generateImageFromPrompt: vi.fn(),
  generateImageWithAssets: vi.fn(),
  getJobResult,
  pollJobStatus,
  submitVideoJob: vi.fn(),
}));
vi.mock("../../adapters/r2.js", () => ({
  R2Adapter: class {
    uploadBuffer = uploadBuffer;
  },
}));
vi.mock("../../lib/prisma.js", () => ({
  prisma: {
    videoAsset: { findMany, updateMany },
    auditLog: { create: auditCreate },
  },
}));
vi.mock("../../lib/redis.js", () => ({ redis: {} }));
vi.mock("../../lib/queue.js", () => ({
  QUEUE_RECONCILE_VEO_OPERATIONS: "reconcile-veo-operations",
  QUEUE_VIDEO_GENERATION: "video-generation",
  scheduleVeoOperationReconciliation: vi.fn(),
  videoGenerationQueue: { add: vi.fn() },
}));
vi.mock("../../lib/video-frames.js", () => ({
  extractRepresentativeFrames: extractFrames,
}));
vi.mock("../../modules/agents/video-prompt-agent.js", () => ({
  runVideoPromptAgent: vi.fn(),
}));
vi.mock("../../modules/critics/video-output-critic.js", () => ({
  runVideoOutputCritic: runOutputCritic,
}));
vi.mock("../../modules/critics/video-prompt-critic.js", () => ({
  runVideoPromptCritic: vi.fn(),
}));

import {
  reconcileUnknownVeoOperations,
  shouldAttemptUnknownVeoRecovery,
} from "../video-generation.js";

const RECOVERABLE_ASSET = {
  id: "video-asset-1",
  orgId: "org-1",
  selectedTone: "professional",
  veoOperationId: "operations/123",
  veoOperationState: "unknown",
  veoSubmitLeaseAt: null,
};

beforeEach(() => {
  findMany.mockReset();
  updateMany.mockReset();
  auditCreate.mockReset();
  getJobResult.mockReset();
  pollJobStatus.mockReset();
  uploadBuffer.mockReset();
  extractFrames.mockReset();
  runOutputCritic.mockReset();
  updateMany.mockResolvedValue({ count: 1 });
  auditCreate.mockResolvedValue({});
});

describe("shouldAttemptUnknownVeoRecovery", () => {
  const now = new Date("2026-07-12T12:00:00.000Z");

  it("requires a persisted operation ID", () => {
    expect(shouldAttemptUnknownVeoRecovery(null, "unknown", null, now)).toBe(
      false,
    );
  });

  it("claims an eligible unknown operation and an expired recovery lease", () => {
    expect(
      shouldAttemptUnknownVeoRecovery("operations/123", "unknown", null, now),
    ).toBe(true);
    expect(
      shouldAttemptUnknownVeoRecovery(
        "operations/123",
        "recovering",
        new Date("2026-07-12T11:59:59.000Z"),
        now,
      ),
    ).toBe(true);
  });

  it("claims an active operation only after its poll lease expires", () => {
    expect(
      shouldAttemptUnknownVeoRecovery(
        "operations/123",
        "active",
        new Date("2026-07-12T11:59:59.000Z"),
        now,
      ),
    ).toBe(true);
    expect(
      shouldAttemptUnknownVeoRecovery(
        "operations/123",
        "active",
        new Date("2026-07-12T12:05:00.000Z"),
        now,
      ),
    ).toBe(false);
  });

  it("does not duplicate an in-flight recovery or recover terminal states", () => {
    expect(
      shouldAttemptUnknownVeoRecovery(
        "operations/123",
        "recovering",
        new Date("2026-07-12T12:05:00.000Z"),
        now,
      ),
    ).toBe(false);
    expect(
      shouldAttemptUnknownVeoRecovery("operations/123", "completed", null, now),
    ).toBe(false);
  });
});

describe("reconcileUnknownVeoOperations", () => {
  it("marks ready only after a persisted operation is positively complete", async () => {
    findMany.mockResolvedValue([RECOVERABLE_ASSET]);
    pollJobStatus.mockResolvedValue({ status: "complete" });
    getJobResult.mockResolvedValue({
      videoBuffer: Buffer.from("video"),
      durationMs: 8_000,
    });
    uploadBuffer.mockResolvedValue({ url: "https://r2.example/video.mp4" });
    extractFrames.mockResolvedValue([
      { label: "opening", mimeType: "image/jpeg", data: "a" },
      { label: "early", mimeType: "image/jpeg", data: "b" },
      { label: "middle", mimeType: "image/jpeg", data: "c" },
      { label: "closing", mimeType: "image/jpeg", data: "d" },
    ]);
    runOutputCritic.mockResolvedValue({ score: 9, passed: true, issues: [] });

    await expect(reconcileUnknownVeoOperations()).resolves.toEqual({
      checked: 1,
      recovered: 1,
    });

    expect(updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { id: "video-asset-1", veoOperationState: "recovering" },
        data: expect.objectContaining({
          status: "ready",
          veoOperationState: "completed",
          videoUrl: "https://r2.example/video.mp4",
        }),
      }),
    );
  });

  it("returns a pending operation to active with a renewed poll lease", async () => {
    findMany.mockResolvedValue([RECOVERABLE_ASSET]);
    pollJobStatus.mockResolvedValue({ status: "pending" });

    await expect(reconcileUnknownVeoOperations()).resolves.toEqual({
      checked: 1,
      recovered: 0,
    });

    expect(uploadBuffer).not.toHaveBeenCalled();
    expect(updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: {
          id: "video-asset-1",
          veoOperationState: "recovering",
        },
        data: expect.objectContaining({
          veoOperationState: "active",
          veoSubmitLeaseAt: expect.any(Date),
        }),
      }),
    );
  });
});
