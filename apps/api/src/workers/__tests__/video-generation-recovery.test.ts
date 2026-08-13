import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  findMany,
  updateMany,
  auditCreate,
  getJobResult,
  pollJobStatus,
  uploadBuffer,
  extractFrames,
  normalizeDuration,
  inspectMedia,
  assertMaster,
  runOutputCritic,
  templateFindMany,
  templateFindUnique,
  templateUpdateMany,
  templateUpdate,
} = vi.hoisted(() => ({
  findMany: vi.fn(),
  updateMany: vi.fn(),
  auditCreate: vi.fn(),
  getJobResult: vi.fn(),
  pollJobStatus: vi.fn(),
  uploadBuffer: vi.fn(),
  extractFrames: vi.fn(),
  normalizeDuration: vi.fn(),
  inspectMedia: vi.fn(),
  assertMaster: vi.fn(),
  runOutputCritic: vi.fn(),
  templateFindMany: vi.fn(),
  templateFindUnique: vi.fn(),
  templateUpdateMany: vi.fn(),
  templateUpdate: vi.fn(),
}));

vi.mock("bullmq", () => ({
  DelayedError: class DelayedError extends Error {},
  Worker: class {
    on() {
      return this;
    }
  },
}));
vi.mock("../../config/env.js", () => ({
  getBullMqIdleDrainDelaySeconds: () => 60,
  getVeoParallelVariants: () => 1,
}));
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
    campaignVideoTemplate: {
      findMany: templateFindMany,
      findUnique: templateFindUnique,
      updateMany: templateUpdateMany,
      update: templateUpdate,
    },
    auditLog: { create: auditCreate },
  },
}));
vi.mock("../../lib/redis.js", () => ({ redis: {} }));
vi.mock("../../lib/queue.js", () => ({
  QUEUE_VIDEO_GENERATION: "video-generation",
  videoGenerationQueue: { add: vi.fn() },
}));
vi.mock("../../lib/video-frames.js", () => ({
  extractRepresentativeFrames: extractFrames,
  normalizeVideoDuration: normalizeDuration,
  inspectVideoMedia: inspectMedia,
  assertPersonalizedMasterVideo: assertMaster,
}));
vi.mock("../../modules/agents/video-prompt-agent.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../modules/agents/video-prompt-agent.js")>();
  return { ...actual, runVideoPromptAgent: vi.fn() };
});
vi.mock("../../modules/critics/video-output-critic.js", () => ({
  runVideoOutputCritic: runOutputCritic,
}));
vi.mock("../../modules/critics/video-prompt-critic.js", () => ({
  runVideoPromptCritic: vi.fn(),
}));

import {
  reconcileUnknownVeoOperations,
  reconcileUnknownTemplateVeoOperations,
  resolveVideoGenerationPipeline,
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
  normalizeDuration.mockReset();
  inspectMedia.mockReset();
  assertMaster.mockReset();
  runOutputCritic.mockReset();
  templateFindMany.mockReset();
  templateUpdateMany.mockReset();
  templateUpdate.mockReset();
  updateMany.mockResolvedValue({ count: 1 });
  templateUpdateMany.mockResolvedValue({ count: 1 });
  templateUpdate.mockResolvedValue({});
  auditCreate.mockResolvedValue({});
  normalizeDuration.mockImplementation(async (videoBuffer: Buffer) => ({
    videoBuffer,
    durationMs: 10_000,
  }));
  inspectMedia.mockResolvedValue({
    durationMs: 10_000,
    width: 90,
    height: 160,
    videoStreams: 1,
    audioStreams: 0,
  });
  templateFindUnique.mockResolvedValue({ renderManifest: null });
});

describe("reconcileUnknownTemplateVeoOperations", () => {
  it("recovers a persisted template operation without submitting another Veo job", async () => {
    templateFindMany.mockResolvedValue([
      {
        id: "template-1",
        orgId: "org-1",
        selectedTone: "professional",
        veoOperationId: "operations/template-1",
        veoOperationState: "unknown",
        veoSubmitLeaseAt: null,
      },
    ]);
    pollJobStatus.mockResolvedValue({ status: "complete" });
    getJobResult.mockResolvedValue({
      videoBuffer: Buffer.from("template-video"),
      durationMs: 8_000,
    });
    uploadBuffer.mockResolvedValue({ url: "https://r2.example/template.mp4" });
    extractFrames.mockResolvedValue([]);
    runOutputCritic.mockResolvedValue({ score: 9, passed: true, issues: [] });

    await expect(reconcileUnknownTemplateVeoOperations()).resolves.toEqual({
      checked: 1,
      recovered: 1,
    });

    expect(templateUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "template-1" },
      data: expect.objectContaining({
        status: "ready",
        masterVideoUrl: "https://r2.example/template.mp4",
        veoOperationState: "completed",
      }),
    }));
  });
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

describe("resolveVideoGenerationPipeline", () => {
  it("routes only generated personalized outreach to the lead-specific pipeline", () => {
    expect(
      resolveVideoGenerationPipeline({
        campaignType: "personalized_outreach",
        videoConfig: { mode: "personalized", source: "generated" },
      }),
    ).toBe("personalized");
    expect(
      resolveVideoGenerationPipeline({
        campaignType: "ai_video_ad",
        videoConfig: { mode: "standardized", source: "generated" },
      }),
    ).toBe("standard");
    expect(
      resolveVideoGenerationPipeline({
        campaignType: "uploaded_video",
        videoConfig: { mode: null, source: "uploaded" },
      }),
    ).toBe("standard");
  });

  it("uses an explicitly enabled personalized campaign video over the legacy strategy type", () => {
    expect(
      resolveVideoGenerationPipeline(
        { campaignType: "ai_video_ad", videoConfig: { mode: "standardized", source: "generated" } },
        { aiConfig: { video: { enabled: true, mode: "personalized", source: "generated" } } },
      ),
    ).toBe("personalized");
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

    expect(normalizeDuration).toHaveBeenCalledWith(
      Buffer.from("video"),
      8_000,
    );
    expect(extractFrames).toHaveBeenCalledWith(
      Buffer.from("video"),
      10_000,
    );

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
