import Fastify from "fastify";
import { applyZodCompilers } from "../../lib/zod-compilers.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";
import { AppError } from "../../lib/errors.js";

const { findFirst, update, uploadBuffer } = vi.hoisted(() => ({
  findFirst: vi.fn(),
  update: vi.fn(),
  uploadBuffer: vi.fn(),
}));

vi.mock("../../lib/prisma.js", () => ({
  prisma: {
    strategy: { findFirst, update },
  },
}));
vi.mock("../../lib/redis.js", () => ({
  redis: { get: vi.fn(), set: vi.fn(), del: vi.fn() },
}));
vi.mock("../../config/env.js", () => ({
  env: { APIFY_API_KEY: "test-key" },
}));
vi.mock("../../adapters/r2.js", () => ({
  R2Adapter: class {
    uploadBuffer = uploadBuffer;
  },
}));

import { strategyRoutes } from "../strategy.js";

const strategy = {
  id: "strategy-1",
  orgId: "org-1",
  campaignType: "uploaded_video",
  videoConfig: null,
};

function multipartFile(
  filename: string,
  contentType: string,
  content: string,
): { body: Buffer; contentType: string } {
  const boundary = "leadreacher-test-boundary";
  const body = Buffer.from(
    [
      `--${boundary}`,
      `Content-Disposition: form-data; name="video"; filename="${filename}"`,
      `Content-Type: ${contentType}`,
      "",
      content,
      `--${boundary}--`,
      "",
    ].join("\r\n"),
  );

  return { body, contentType: `multipart/form-data; boundary=${boundary}` };
}

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
  return app;
}

let app: Awaited<ReturnType<typeof buildTestApp>>;

beforeEach(async () => {
  findFirst.mockReset();
  update.mockReset();
  uploadBuffer.mockReset();
  findFirst.mockResolvedValue(strategy);
  update.mockImplementation(async ({ data }) => ({ ...strategy, ...data }));
  uploadBuffer.mockResolvedValue({
    url: "https://cdn.example/strategy-uploads/org-1/video.mp4",
    r2Key: "strategy-uploads/org-1/video.mp4",
  });
  app = await buildTestApp();
});

afterEach(async () => {
  await app.close();
});

describe("POST /strategy/:orgId/video-upload", () => {
  it("uploads a video to R2 and persists its URL on the strategy", async () => {
    const file = multipartFile("campaign.mp4", "video/mp4", "video-bytes");

    const response = await app.inject({
      method: "POST",
      url: "/strategy/org-1/video-upload",
      headers: { "content-type": file.contentType },
      payload: file.body,
    });

    const videoConfig = {
      enabled: true,
      mode: null,
      source: "uploaded",
      tone: null,
      uploadedVideoUrl: "https://cdn.example/strategy-uploads/org-1/video.mp4",
    };
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ videoConfig });
    expect(uploadBuffer).toHaveBeenCalledWith(
      expect.stringMatching(/^strategy-uploads\/org-1\/.+\.mp4$/),
      expect.any(Buffer),
      "video/mp4",
    );
    expect(update).toHaveBeenCalledWith({
      where: { id: "strategy-1" },
      data: { videoConfig },
    });
  });

  it("rejects files that do not have a video content type", async () => {
    const file = multipartFile("notes.txt", "text/plain", "not-a-video");

    const response = await app.inject({
      method: "POST",
      url: "/strategy/org-1/video-upload",
      headers: { "content-type": file.contentType },
      payload: file.body,
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      code: "VALIDATION_ERROR",
      message: "Uploaded file must have a video content type",
    });
    expect(uploadBuffer).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });
});
