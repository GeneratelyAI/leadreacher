import type { Strategy } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ValidationError } from "../../lib/errors.js";
import { COMPANY_SEARCH_NO_RESULTS_REASON } from "../strategy-filters.js";

const {
  searchCompanies,
  scrapeLeadsWithTotal,
  strategyUpdate,
  auditCreate,
  redisGet,
} = vi.hoisted(() => ({
  searchCompanies: vi.fn(),
  scrapeLeadsWithTotal: vi.fn(),
  strategyUpdate: vi.fn(),
  auditCreate: vi.fn(),
  redisGet: vi.fn(),
}));

vi.mock("../../adapters/apify.js", () => ({
  ApifyAdapter: class {
    searchCompanies = searchCompanies;
    scrapeLeadsWithTotal = scrapeLeadsWithTotal;
  },
}));
vi.mock("../../config/env.js", () => ({ env: { APIFY_API_KEY: "test-key" } }));
vi.mock("../../lib/prisma.js", () => ({
  prisma: {
    strategy: { update: strategyUpdate },
    auditLog: { create: auditCreate },
  },
}));
vi.mock("../../lib/redis.js", () => ({
  redis: { get: redisGet },
}));

import { generateStrategy } from "../strategy.js";

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

const profile = {
  linkedinUrl: "https://www.linkedin.com/in/founder",
  firstName: "Ada",
  lastName: "Lovelace",
  title: "Founder",
  company: "Example Company",
  enrichmentData: {},
};

beforeEach(() => {
  searchCompanies.mockReset();
  scrapeLeadsWithTotal.mockReset();
  strategyUpdate.mockReset();
  auditCreate.mockReset();
  redisGet.mockReset();
  redisGet.mockResolvedValue(null);
  auditCreate.mockResolvedValue({});
  strategyUpdate.mockImplementation(async ({ data }) => ({ ...strategy, ...data }));
});

describe("Strategy company-search degradation", () => {
  it("keeps real decision-maker data when an attempted company search returns zero results", async () => {
    searchCompanies.mockResolvedValue({
      companies: [],
      totalFound: 0,
      skipped: false,
    });
    scrapeLeadsWithTotal.mockResolvedValue({ profiles: [profile], totalFound: 1 });

    await expect(generateStrategy(strategy, "org-1")).resolves.toBeDefined();

    const updateData = strategyUpdate.mock.calls[0]?.[0]?.data as {
      icpDefinition: {
        audienceAnalysis: {
          companies: { status: string; reason?: string; totalFound: number };
          decisionMakers: { totalFound: number };
          topIndustries: unknown[];
        };
      };
    };
    expect(updateData.icpDefinition.audienceAnalysis).toMatchObject({
      companies: {
        status: "unavailable",
        reason: COMPANY_SEARCH_NO_RESULTS_REASON,
        totalFound: 0,
      },
      decisionMakers: { totalFound: 1 },
      topIndustries: [],
    });
  });

  it("still fails when the profile search returns zero decision makers", async () => {
    searchCompanies.mockResolvedValue({
      companies: [],
      totalFound: 0,
      skipped: false,
    });
    scrapeLeadsWithTotal.mockResolvedValue({ profiles: [], totalFound: 0 });

    await expect(generateStrategy(strategy, "org-1")).rejects.toBeInstanceOf(
      ValidationError,
    );
  });
});
