import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  campaignFindFirst,
  strategyFindFirst,
  templateFindUnique,
  assetFindUnique,
  assetFindFirst,
  assetCreate,
  queueAdd,
} = vi.hoisted(() => ({
  campaignFindFirst: vi.fn(),
  strategyFindFirst: vi.fn(),
  templateFindUnique: vi.fn(),
  assetFindUnique: vi.fn(),
  assetFindFirst: vi.fn(),
  assetCreate: vi.fn(),
  queueAdd: vi.fn(),
}));

vi.mock("../../lib/prisma.js", () => ({
  prisma: {
    campaign: { findFirst: campaignFindFirst },
    strategy: { findFirst: strategyFindFirst },
    campaignVideoTemplate: { findUnique: templateFindUnique },
    videoAsset: { findUnique: assetFindUnique, findFirst: assetFindFirst, create: assetCreate },
  },
}));
vi.mock("../../lib/queue.js", () => ({
  QUEUE_VIDEO_GENERATION: "video-generation",
  videoGenerationQueue: { add: queueAdd },
}));
vi.mock("../../adapters/google-tts.js", () => ({ synthesizeSpeech: vi.fn() }));
vi.mock("../../adapters/r2.js", () => ({ R2Adapter: class {} }));
vi.mock("../../lib/video-frames.js", () => ({ composePersonalizedVideo: vi.fn() }));

import {
  ensureCampaignVideoReady,
  ensurePersonalizedVideoReady,
} from "../campaign-video.js";

beforeEach(() => {
  campaignFindFirst.mockReset();
  strategyFindFirst.mockReset();
  templateFindUnique.mockReset();
  assetFindUnique.mockReset();
  assetFindFirst.mockReset();
  assetCreate.mockReset();
  queueAdd.mockReset();
  campaignFindFirst.mockResolvedValue({ id: "campaign-1", name: "Outreach", strategyId: "strategy-1" });
  strategyFindFirst.mockResolvedValue({
    campaignType: "personalized_outreach",
    videoConfig: { enabled: true, mode: "personalized", source: "generated" },
  });
});

describe("ensurePersonalizedVideoReady", () => {
  const input = { orgId: "org-1", campaignId: "campaign-1", leadId: "lead-1" };

  it("queues one template instead of a lead-specific Veo job when no template exists", async () => {
    templateFindUnique.mockResolvedValue(null);

    await expect(ensurePersonalizedVideoReady(input)).resolves.toEqual({ state: "pending" });
    expect(queueAdd).toHaveBeenCalledWith(
      "personalized-template-orchestrate",
      expect.objectContaining({ jobType: "template-orchestrate", campaignId: "campaign-1" }),
      expect.objectContaining({ jobId: "personalized-template:campaign-1:1" }),
    );
  });

  it("returns the existing lead asset without composing another video", async () => {
    templateFindUnique.mockResolvedValue({ id: "template-1", status: "ready" });
    assetFindUnique.mockResolvedValue({
      id: "asset-1",
      status: "ready",
      videoUrl: "https://r2.example/personalized.mp4",
    });

    await expect(ensurePersonalizedVideoReady(input)).resolves.toEqual({
      state: "ready",
      videoUrl: "https://r2.example/personalized.mp4",
    });
    expect(queueAdd).not.toHaveBeenCalled();
  });

  it("queues one deterministic composition job for a pending lead asset", async () => {
    templateFindUnique.mockResolvedValue({ id: "template-1", status: "ready" });
    assetFindUnique.mockResolvedValue({ id: "asset-1", status: "pending", videoUrl: null });

    await expect(ensurePersonalizedVideoReady(input)).resolves.toEqual({ state: "pending" });
    expect(queueAdd).toHaveBeenCalledWith(
      "compose-personalized-video",
      expect.objectContaining({ jobType: "personalized-compose", templateId: "template-1", videoAssetId: "asset-1" }),
      expect.objectContaining({ jobId: "personalized-compose:template-1:lead-1" }),
    );
  });
});

describe("ensureCampaignVideoReady", () => {
  const input = { orgId: "org-1", campaignId: "campaign-1", leadId: "lead-1" };

  it("accepts an approved uploaded campaign video without queuing generation", async () => {
    campaignFindFirst.mockResolvedValue({
      aiConfig: {
        video: {
          enabled: true,
          source: "uploaded",
          uploadedVideoUrl: "https://r2.example/campaign-video.mp4",
        },
      },
    });

    await expect(ensureCampaignVideoReady(input)).resolves.toEqual({
      state: "ready",
      videoUrl: "https://r2.example/campaign-video.mp4",
    });
    expect(queueAdd).not.toHaveBeenCalled();
  });

  it("reuses a ready standardized AI campaign video", async () => {
    campaignFindFirst.mockResolvedValue({
      aiConfig: {
        video: { enabled: true, source: "generated", mode: "standardized" },
      },
    });
    assetFindFirst.mockResolvedValue({
      status: "ready",
      videoUrl: "https://r2.example/standardized-video.mp4",
    });

    await expect(ensureCampaignVideoReady(input)).resolves.toEqual({
      state: "ready",
      videoUrl: "https://r2.example/standardized-video.mp4",
    });
    expect(queueAdd).not.toHaveBeenCalled();
  });

  it("queues one standardized AI campaign video when there is no ready asset", async () => {
    campaignFindFirst.mockResolvedValue({
      aiConfig: {
        video: { enabled: true, source: "generated", mode: "standardized" },
      },
    });
    assetFindFirst.mockResolvedValue(null);

    await expect(ensureCampaignVideoReady(input)).resolves.toEqual({ state: "pending" });
    expect(queueAdd).toHaveBeenCalledWith(
      "standard-campaign-video-orchestrate",
      expect.objectContaining({ pipeline: "standard", campaignId: "campaign-1" }),
      expect.objectContaining({ jobId: "standard-campaign-video:campaign-1" }),
    );
  });
});
