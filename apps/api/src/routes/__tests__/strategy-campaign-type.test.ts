import Fastify from "fastify";
import { applyZodCompilers } from "../../lib/zod-compilers.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../../lib/errors.js";

const { findFirst, update } = vi.hoisted(() => ({
  findFirst: vi.fn(),
  update: vi.fn(),
}));

vi.mock("../../lib/prisma.js", () => ({
  prisma: {
    strategy: { findFirst, update },
  },
}));
vi.mock("../../lib/redis.js", () => ({
  redis: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
  },
}));
vi.mock("../../config/env.js", () => ({
  env: { APIFY_API_KEY: "test-key" },
}));

import { strategyRoutes } from "../strategy.js";

const strategy = {
  id: "strategy-1",
  orgId: "org-1",
  campaignType: null,
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
    throw error;
  });
  await app.register(strategyRoutes);
  return app;
}

let app: Awaited<ReturnType<typeof buildTestApp>>;

beforeEach(async () => {
  findFirst.mockReset();
  update.mockReset();
  findFirst.mockResolvedValue(strategy);
  update.mockResolvedValue({
    ...strategy,
    campaignType: "personalized_outreach",
  });
  app = await buildTestApp();
});

afterEach(async () => {
  await app.close();
});

describe("PATCH /strategy/:orgId/campaign-type", () => {
  it("saves a valid campaign type on the current organization strategy", async () => {
    const response = await app.inject({
      method: "PATCH",
      url: "/strategy/org-1/campaign-type",
      payload: { campaignType: "personalized_outreach" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      id: "strategy-1",
      campaignType: "personalized_outreach",
    });
    expect(update).toHaveBeenCalledWith({
      where: { id: "strategy-1" },
      data: { campaignType: "personalized_outreach" },
    });
  });

  it("rejects an invalid campaign type with ValidationError", async () => {
    const response = await app.inject({
      method: "PATCH",
      url: "/strategy/org-1/campaign-type",
      payload: { campaignType: "unsupported" },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      code: "VALIDATION_ERROR",
      message: "Invalid campaign type",
    });
    expect(findFirst).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("rejects a request for another organization", async () => {
    const response = await app.inject({
      method: "PATCH",
      url: "/strategy/other-org/campaign-type",
      payload: { campaignType: "ai_video_ad" },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ code: "FORBIDDEN" });
    expect(findFirst).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });
});
