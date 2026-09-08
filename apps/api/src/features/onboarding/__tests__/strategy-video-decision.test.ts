import Fastify from "fastify";
import { applyZodCompilers } from "../../../platform/http/zod-compilers.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";
import { AppError } from "../../../platform/http/errors.js";

const { findFirst, update } = vi.hoisted(() => ({
  findFirst: vi.fn(),
  update: vi.fn(),
}));

vi.mock("../../../platform/persistence/prisma.js", () => ({
  prisma: {
    strategy: { findFirst, update },
  },
}));
vi.mock("../../../platform/redis/connection.js", () => ({
  redis: { get: vi.fn(), set: vi.fn(), del: vi.fn() },
}));
vi.mock("../../../platform/config/env.js", () => ({
  env: { APIFY_API_KEY: "test-key" },
}));

import { strategyRoutes } from "../public/strategy-routes.js";
import { discoveryRoutes } from "../public/discovery-routes.js";

const strategy = {
  id: "strategy-1",
  orgId: "org-1",
  campaignType: "personalized_outreach",
  videoConfig: null,
};

async function buildTestApp() {
  const app = Fastify();
  applyZodCompilers(app);
  app.addHook("preHandler", async (request) => {
    request.orgId = "org-1";
  });
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof AppError) {
      return reply
        .status(error.statusCode)
        .send({ code: error.code, message: error.message });
    }
    if (error instanceof ZodError) {
      return reply.status(400).send({ code: "VALIDATION_ERROR" });
    }
    throw error;
  });
  await app.register(strategyRoutes);
  await app.register(discoveryRoutes);
  return app;
}

let app: Awaited<ReturnType<typeof buildTestApp>>;

beforeEach(async () => {
  findFirst.mockReset();
  update.mockReset();
  findFirst.mockResolvedValue(strategy);
  update.mockImplementation(async ({ data }) => ({ ...strategy, ...data }));
  app = await buildTestApp();
});

afterEach(async () => {
  await app.close();
});

describe("confirmed onboarding state", () => {
  it("visiting the introduction retains approved data without approving suggestions", async () => {
    const icpDefinition = {
      onboarding: { introductionSeen: false, prospectsApproved: false },
      prospectProfile: { decisionMakers: ["Edited role"] },
      approvedContent: { type: "Document", documentName: "Brief.pdf" },
    };
    findFirst.mockResolvedValue({ ...strategy, icpDefinition });
    const response = await app.inject({
      method: "POST", url: "/discovery/complete",
      payload: {
        mode: "introduction", websiteUrl: "https://acme.example",
        summary: { businessModel: "Outreach", industry: "Software", strengths: "Automation", idealCustomer: "Sales teams" },
        messages: [{ role: "user", content: "Continue to prospects" }],
      },
    });
    expect(response.statusCode).toBe(200);
    expect(findFirst).toHaveBeenCalledWith({ where: { orgId: "org-1" }, orderBy: { updatedAt: "desc" } });
    expect(update).toHaveBeenCalledExactlyOnceWith({
      where: { id: "strategy-1" },
      data: { icpDefinition: { ...icpDefinition, onboarding: { introductionSeen: true, prospectsApproved: false } } },
    });
  });

  it("saves the document descriptor without discarding audience metadata", async () => {
    const icpDefinition = { prospectProfile: { locations: ["Canada"] } };
    findFirst.mockResolvedValue({ ...strategy, icpDefinition });
    const response = await app.inject({ method: "PATCH", url: "/strategy/org-1/content-approval", payload: { type: "Document", documentName: "Brief.pdf" } });
    expect(response.statusCode).toBe(200);
    expect(update).toHaveBeenCalledWith({ where: { id: "strategy-1" }, data: { icpDefinition: { ...icpDefinition, approvedContent: { type: "Document", documentName: "Brief.pdf" } } } });
  });

  it("rejects approval for another organization before reading or writing data", async () => {
    const response = await app.inject({ method: "PATCH", url: "/strategy/org-2/content-approval", payload: { type: "Document", documentName: "Brief.pdf" } });
    expect(response.statusCode).toBe(403);
    expect(findFirst).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });
});

describe("PATCH /strategy/:orgId/video-decision", () => {
  it("persists the explicit video decision without enqueuing generation", async () => {
    const videoConfig = {
      enabled: true,
      mode: "personalized",
      source: "generated",
      tone: "professional",
      uploadedVideoUrl: null,
    };

    const response = await app.inject({
      method: "PATCH",
      url: "/strategy/org-1/video-decision",
      payload: videoConfig,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ videoConfig });
    expect(update).toHaveBeenCalledWith({
      where: { id: "strategy-1" },
      data: { videoConfig, icpDefinition: { approvedContent: { type: "Personalized video", style: "professional" } } },
    });
  });

  it("rejects a partially enabled decision", async () => {
    const response = await app.inject({
      method: "PATCH",
      url: "/strategy/org-1/video-decision",
      payload: { enabled: true, mode: null, source: null },
    });

    expect(response.statusCode).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

  it("rejects disabled video because every campaign requires video", async () => {
    const response = await app.inject({
      method: "PATCH",
      url: "/strategy/org-1/video-decision",
      payload: {
        enabled: false,
        mode: null,
        source: null,
        tone: null,
        uploadedVideoUrl: null,
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      code: "VALIDATION_ERROR",
      message: "Video is required for every campaign type",
    });
    expect(update).not.toHaveBeenCalled();
  });

  it("requires a tone for personalized outreach", async () => {
    const response = await app.inject({
      method: "PATCH",
      url: "/strategy/org-1/video-decision",
      payload: {
        enabled: true,
        mode: "personalized",
        source: "generated",
        tone: null,
        uploadedVideoUrl: null,
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      code: "VALIDATION_ERROR",
      message:
        "Personalized outreach requires a professional, casual, or aggressive tone",
    });
    expect(update).not.toHaveBeenCalled();
  });

  it("requires a tone for AI campaign video", async () => {
    findFirst.mockResolvedValue({ ...strategy, campaignType: "ai_video_ad" });

    const response = await app.inject({
      method: "PATCH",
      url: "/strategy/org-1/video-decision",
      payload: {
        enabled: true,
        mode: "standardized",
        source: "generated",
        tone: null,
        uploadedVideoUrl: null,
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      code: "VALIDATION_ERROR",
      message:
        "AI campaign video requires a professional, casual, or aggressive tone",
    });
    expect(update).not.toHaveBeenCalled();
  });

  it("accepts a generated AI campaign video with a selected tone", async () => {
    findFirst.mockResolvedValue({ ...strategy, campaignType: "ai_video_ad" });
    const videoConfig = {
      enabled: true,
      mode: "standardized",
      source: "generated",
      tone: "casual",
      uploadedVideoUrl: null,
    };

    const response = await app.inject({
      method: "PATCH",
      url: "/strategy/org-1/video-decision",
      payload: videoConfig,
    });

    expect(response.statusCode).toBe(200);
    expect(update).toHaveBeenCalledWith({
      where: { id: "strategy-1" },
      data: { videoConfig, icpDefinition: { approvedContent: { type: "AI video", style: "casual" } } },
    });
  });

  it("accepts an uploaded video configuration only after an upload URL exists", async () => {
    findFirst.mockResolvedValue({ ...strategy, campaignType: "uploaded_video" });
    const videoConfig = {
      enabled: true,
      mode: null,
      source: "uploaded",
      tone: null,
      uploadedVideoUrl: "https://cdn.example/strategy-uploads/org-1/video.mp4",
    };

    const response = await app.inject({
      method: "PATCH",
      url: "/strategy/org-1/video-decision",
      payload: videoConfig,
    });

    expect(response.statusCode).toBe(200);
    expect(update).toHaveBeenCalledWith({
      where: { id: "strategy-1" },
      data: { videoConfig, icpDefinition: { approvedContent: { type: "Your video", style: null } } },
    });
  });
});
