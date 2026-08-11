import Fastify from "fastify";
import { applyZodCompilers } from "../../lib/zod-compilers.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../../lib/errors.js";

const { findFirst, update, runOutreachMessageAgent } = vi.hoisted(() => ({
  findFirst: vi.fn(),
  update: vi.fn(),
  runOutreachMessageAgent: vi.fn(),
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
vi.mock("../../modules/agents/outreach-message-agent.js", () => ({
  runOutreachMessageAgent,
}));

import { strategyRoutes } from "../strategy.js";

const originalStrategy = {
  id: "strategy-1",
  orgId: "org-1",
  positioning: { businessModel: "Lead generation platform" },
  icpDefinition: { idealCustomer: "Revenue leaders" },
  messagingAngles: {},
  videoConfig: { tone: "professional" },
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
let strategy: typeof originalStrategy;

beforeEach(async () => {
  findFirst.mockReset();
  update.mockReset();
  runOutreachMessageAgent.mockReset();
  strategy = structuredClone(originalStrategy);
  findFirst.mockImplementation(async () => strategy);
  update.mockImplementation(async ({ data }) => {
    strategy = { ...strategy, ...data };
    return strategy;
  });
  runOutreachMessageAgent.mockResolvedValue({
    message:
      "Hi {{FirstName}}, {{Company}} can create more qualified conversations. Would a quick chat help?",
  });
  app = await buildTestApp();
});

afterEach(async () => {
  await app.close();
});

describe("outreach message routes", () => {
  it("reads persisted outreach copy without generating it", async () => {
    strategy.messagingAngles = {
      outreachMessage: "Hi {{FirstName}}, I have an idea for {{Company}}.",
      cta: { label: "See the walkthrough", url: "https://leadreacher.com/demo" },
    };

    const response = await app.inject({
      method: "GET",
      url: "/strategy/org-1/outreach-message",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      message: "Hi {{FirstName}}, I have an idea for {{Company}}.",
      ctaLabel: "See the walkthrough",
      ctaUrl: "https://leadreacher.com/demo",
    });
    expect(runOutreachMessageAgent).not.toHaveBeenCalled();
  });

  it("returns an empty persisted message without triggering generation", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/strategy/org-1/outreach-message",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      message: null,
      ctaLabel: null,
      ctaUrl: null,
    });
    expect(runOutreachMessageAgent).not.toHaveBeenCalled();
  });

  it("generates once and returns the stored message on later requests", async () => {
    const first = await app.inject({
      method: "POST",
      url: "/strategy/org-1/outreach-message",
    });
    const second = await app.inject({
      method: "POST",
      url: "/strategy/org-1/outreach-message",
    });

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(runOutreachMessageAgent).toHaveBeenCalledTimes(1);
    expect(runOutreachMessageAgent).toHaveBeenCalledWith({
      orgId: "org-1",
      product: "Lead generation platform",
      audience: "Revenue leaders",
      tone: "professional",
    });
  });

  it("overwrites the stored message when edited", async () => {
    const message =
      "Hi {{FirstName}}, I saw {{Company}} is growing. Would a quick chat next week help?";
    const response = await app.inject({
      method: "PATCH",
      url: "/strategy/org-1/outreach-message",
      payload: { message },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ message, ctaLabel: null, ctaUrl: null });
    expect(update).toHaveBeenCalledWith({
      where: { id: "strategy-1" },
      data: { messagingAngles: { outreachMessage: message, cta: null } },
    });
  });

  it("stores a CTA only when it has both a label and destination", async () => {
    const message = "Hi {{FirstName}}, I have an idea for {{Company}}.";
    const response = await app.inject({
      method: "PATCH",
      url: "/strategy/org-1/outreach-message",
      payload: {
        message,
        ctaLabel: "See the walkthrough",
        ctaUrl: "https://leadreacher.com/demo",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      message,
      ctaLabel: "See the walkthrough",
      ctaUrl: "https://leadreacher.com/demo",
    });
    expect(update).toHaveBeenCalledWith({
      where: { id: "strategy-1" },
      data: {
        messagingAngles: {
          outreachMessage: message,
          cta: {
            label: "See the walkthrough",
            url: "https://leadreacher.com/demo",
          },
        },
      },
    });
  });

  it("rejects a partial CTA", async () => {
    const response = await app.inject({
      method: "PATCH",
      url: "/strategy/org-1/outreach-message",
      payload: { message: "Hi {{FirstName}}", ctaLabel: "Book time" },
    });

    expect(response.statusCode).toBe(400);
  });
});
