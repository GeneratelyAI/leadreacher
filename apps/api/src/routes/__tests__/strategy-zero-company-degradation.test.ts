import type { Strategy } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { strategyUpdate, auditCreate, redisGet } = vi.hoisted(() => ({
  strategyUpdate: vi.fn(),
  auditCreate: vi.fn(),
  redisGet: vi.fn(),
}));

vi.mock("../../lib/prisma.js", () => ({
  prisma: {
    strategy: { update: strategyUpdate },
    auditLog: { create: auditCreate },
  },
}));
vi.mock("../../lib/redis.js", () => ({ redis: { get: redisGet } }));

import {
  buildStrategyBrief,
  generateStrategy,
  StrategyGenerationBodySchema,
  strategyBriefPersistence,
} from "../strategy.js";

const strategy = {
  id: "strategy-1",
  orgId: "org-1",
  icpDefinition: { idealCustomer: "Engineering leaders" },
  positioning: {
    industry: "Software Development",
    businessModel: "Developer data platform",
    strengths: "Reliable real-time web data",
  },
  channels: {},
  messagingAngles: {},
  creativeAssets: {},
  executionPlan: [],
  completedSteps: [],
  campaignType: null,
  videoConfig: null,
  version: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
} as unknown as Strategy;

beforeEach(() => {
  strategyUpdate.mockReset();
  auditCreate.mockReset();
  redisGet.mockReset();
  redisGet.mockResolvedValue(null);
  auditCreate.mockResolvedValue({});
  strategyUpdate.mockImplementation(async ({ data }) => ({ ...strategy, ...data }));
});

describe("Strategy generation without prospect sourcing", () => {
  it.each([
    ["a null body", null],
    ["an omitted body", undefined],
    ["an empty object", {}],
  ])("normalizes %s", (_label, body) => {
    expect(StrategyGenerationBodySchema.parse(body)).toEqual({ force: false });
  });

  it("builds and persists a usable plan from Discovery", () => {
    const brief = buildStrategyBrief(strategy);
    const persistence = strategyBriefPersistence(strategy, brief) as unknown as {
      icpDefinition: { strategyBrief: { audience: string; decisionMakerRoles: string[] } };
      executionPlan: unknown[];
    };

    expect(brief.decisionMakerRoles).toEqual(["Founder", "CEO"]);
    expect(persistence.icpDefinition.strategyBrief.audience).toBe("Engineering leaders");
    expect(persistence.executionPlan).toHaveLength(3);
  });

  it("defers prospect sourcing until LinkedIn is connected", async () => {
    await expect(generateStrategy(strategy, "org-1")).resolves.toBeDefined();

    const updateData = strategyUpdate.mock.calls[0]?.[0]?.data as {
      icpDefinition: {
        audienceAnalysis: {
          status: string;
          source: string;
          decisionMakers: { sampleSize: number };
        };
      };
      channels: { recommendations: Array<{ channel: string }> };
    };
    expect(updateData.icpDefinition.audienceAnalysis).toMatchObject({
      status: "completed",
      source: "connected_linkedin",
      decisionMakers: { sampleSize: 0 },
    });
    expect(updateData.channels.recommendations.map((item) => item.channel)).toEqual([
      "linkedin",
      "email",
      "whatsapp",
    ]);
  });
});
