import Fastify from "fastify";
import { applyZodCompilers } from "../../lib/zod-compilers.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../../lib/errors.js";

const {
  campaignFindUnique,
  campaignFindFirst,
  campaignFindMany,
  campaignCreate,
  campaignUpdate,
  campaignLeadFindMany,
  campaignLeadCount,
  messageFindMany,
  videoAssetFindMany,
  socialAccountFindFirst,
  cancelCampaignPendingSequenceJobs,
  resumeCampaignSequenceJobs,
} = vi.hoisted(() => ({
  campaignFindUnique: vi.fn(),
  campaignFindFirst: vi.fn(),
  campaignFindMany: vi.fn(),
  campaignCreate: vi.fn(),
  campaignUpdate: vi.fn(),
  campaignLeadFindMany: vi.fn(),
  campaignLeadCount: vi.fn(),
  messageFindMany: vi.fn(),
  videoAssetFindMany: vi.fn(),
  socialAccountFindFirst: vi.fn(),
  cancelCampaignPendingSequenceJobs: vi.fn(),
  resumeCampaignSequenceJobs: vi.fn(),
}));

vi.mock("../../lib/prisma.js", () => ({
  prisma: {
    campaign: {
      findUnique: campaignFindUnique,
      findFirst: campaignFindFirst,
      findMany: campaignFindMany,
      create: campaignCreate,
      update: campaignUpdate,
    },
    campaignLead: { findMany: campaignLeadFindMany, count: campaignLeadCount },
    message: { findMany: messageFindMany },
    videoAsset: { findMany: videoAssetFindMany },
    socialAccount: { findFirst: socialAccountFindFirst },
  },
}));

vi.mock("../../services/campaign-step0-queue.js", () => ({
  ensureCampaignStepZeroQueued: vi.fn(),
}));

vi.mock("../../services/campaign-sequence-control.js", () => ({
  cancelCampaignPendingSequenceJobs,
  resumeCampaignSequenceJobs,
}));

import { campaignRoutes } from "../campaigns.js";

async function buildTestApp() {
  const app = Fastify();
  applyZodCompilers(app);
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({ code: error.code, message: error.message });
    }
    throw error;
  });
  app.addHook("onRequest", async (request) => {
    (request as { orgId?: string }).orgId = "org-1";
  });
  await app.register(campaignRoutes);
  return app;
}

let app: Awaited<ReturnType<typeof buildTestApp>>;

beforeEach(async () => {
  campaignFindUnique.mockReset();
  campaignFindFirst.mockReset();
  campaignFindMany.mockReset();
  campaignCreate.mockReset();
  campaignUpdate.mockReset();
  campaignLeadFindMany.mockReset();
  campaignLeadCount.mockReset();
  messageFindMany.mockReset();
  videoAssetFindMany.mockReset();
  socialAccountFindFirst.mockReset();
  cancelCampaignPendingSequenceJobs.mockReset().mockResolvedValue(1);
  resumeCampaignSequenceJobs.mockReset().mockResolvedValue(1);
  app = await buildTestApp();
});

afterEach(async () => {
  await app.close();
});

describe("campaign lifecycle routes", () => {
  it("pauses an active campaign and cancels pending jobs", async () => {
    campaignFindUnique.mockResolvedValue({
      id: "campaign-1",
      orgId: "org-1",
      status: "active",
      channels: ["linkedin"],
      socialAccountId: "sender-1",
      aiConfig: null,
      sequence: [{ type: "linkedin_invite", message: "Hi", delayHours: 0 }],
    });
    campaignUpdate.mockResolvedValue({
      id: "campaign-1",
      name: "Q3",
      status: "paused",
      channels: ["linkedin"],
      socialAccountId: "sender-1",
      aiConfig: null,
      updatedAt: new Date("2026-07-23T12:00:00.000Z"),
    });

    const response = await app.inject({
      method: "PATCH",
      url: "/campaigns/campaign-1",
      payload: { status: "paused" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ id: "campaign-1", status: "paused" });
    expect(cancelCampaignPendingSequenceJobs).toHaveBeenCalledWith({
      campaignId: "campaign-1",
      orgId: "org-1",
    });
  });

  it("resumes a paused campaign and requeues jobs", async () => {
    campaignFindUnique.mockResolvedValue({
      id: "campaign-1",
      orgId: "org-1",
      status: "paused",
      channels: ["linkedin"],
      socialAccountId: "sender-1",
      aiConfig: null,
      sequence: [{ type: "linkedin_invite", message: "Hi", delayHours: 0 }],
    });
    campaignUpdate.mockResolvedValue({
      id: "campaign-1",
      name: "Q3",
      status: "active",
      channels: ["linkedin"],
      socialAccountId: "sender-1",
      aiConfig: null,
      updatedAt: new Date("2026-07-23T12:00:00.000Z"),
    });

    const response = await app.inject({
      method: "PATCH",
      url: "/campaigns/campaign-1",
      payload: { status: "active" },
    });

    expect(response.statusCode).toBe(200);
    expect(resumeCampaignSequenceJobs).toHaveBeenCalledWith({
      campaignId: "campaign-1",
      orgId: "org-1",
    });
  });

  it("duplicates a campaign as a draft without leads", async () => {
    campaignFindUnique.mockResolvedValue({
      id: "campaign-1",
      orgId: "org-1",
      name: "Pipeline",
      status: "active",
      channels: ["linkedin"],
      sequence: [{ type: "linkedin_invite", message: "Hi", delayHours: 0 }],
      socialAccountId: "sender-1",
      aiConfig: { archived: false },
    });
    campaignCreate.mockResolvedValue({
      id: "campaign-2",
      name: "Pipeline (copy)",
      status: "draft",
    });

    const response = await app.inject({
      method: "POST",
      url: "/campaigns/campaign-1/duplicate",
    });

    expect(response.statusCode).toBe(200);
    expect(campaignCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "Pipeline (copy)",
          status: "draft",
          channels: ["linkedin"],
        }),
      }),
    );
  });

  it("bulk pauses matching campaigns", async () => {
    campaignFindMany.mockResolvedValue([
      { id: "campaign-1", status: "active", aiConfig: null },
      { id: "campaign-2", status: "draft", aiConfig: null },
    ]);
    campaignUpdate.mockResolvedValue({
      id: "campaign-1",
      status: "paused",
      aiConfig: null,
    });

    const response = await app.inject({
      method: "PATCH",
      url: "/campaigns/bulk",
      payload: { campaignIds: ["campaign-1", "campaign-2"], status: "paused" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ updated: 1 });
    expect(campaignUpdate).toHaveBeenCalledTimes(1);
  });
});
