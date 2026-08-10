import type { Strategy } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ValidationError } from "../../lib/errors.js";

const {
  searchCompanies,
  scrapeLeadsWithTotal,
  strategyUpdate,
  auditCreate,
  redisGet,
  importScrapedProfiles,
} = vi.hoisted(() => ({
  searchCompanies: vi.fn(),
  scrapeLeadsWithTotal: vi.fn(),
  strategyUpdate: vi.fn(),
  auditCreate: vi.fn(),
  redisGet: vi.fn(),
  importScrapedProfiles: vi.fn(),
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
vi.mock("../../services/lead-import.js", () => ({ importScrapedProfiles }));

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
  importScrapedProfiles.mockReset();
  redisGet.mockResolvedValue(null);
  auditCreate.mockResolvedValue({});
  strategyUpdate.mockImplementation(async ({ data }) => ({ ...strategy, ...data }));
  importScrapedProfiles.mockResolvedValue({
    imported: 1,
    skipped: 0,
    leadIds: ["lead-1"],
  });
});

describe("Strategy company-search degradation", () => {
  it("keeps onboarding fast by deferring optional company enrichment", async () => {
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
        reason: "Company-level insights are enriched after onboarding.",
        totalFound: 0,
      },
      decisionMakers: { totalFound: 1 },
      topIndustries: [],
    });
    expect(importScrapedProfiles).toHaveBeenCalledWith("org-1", [profile]);
    expect(searchCompanies).not.toHaveBeenCalled();
  });

  it("still fails when the profile search returns zero decision makers", async () => {
    searchCompanies.mockResolvedValue({
      companies: [],
      totalFound: 0,
      skipped: false,
    });
    scrapeLeadsWithTotal
      .mockResolvedValueOnce({ profiles: [], totalFound: 0 })
      .mockResolvedValueOnce({ profiles: [], totalFound: 0 });

    await expect(generateStrategy(strategy, "org-1")).rejects.toBeInstanceOf(
      ValidationError,
    );
    expect(scrapeLeadsWithTotal).toHaveBeenCalledTimes(2);
  });

  it("rejects an off-target sample instead of importing irrelevant prospects", async () => {
    const offTargetStrategy = {
      ...strategy,
      icpDefinition: { idealCustomer: "Marketing leaders" },
    } as Strategy;
    const offTargetProfile = {
      ...profile,
      title: "Clinical Hypnotherapist",
    };
    scrapeLeadsWithTotal.mockResolvedValue({
      profiles: [offTargetProfile],
      totalFound: 1,
    });

    await expect(generateStrategy(offTargetStrategy, "org-1")).rejects.toMatchObject({
      message: expect.stringContaining("outside the selected decision-maker roles"),
    });
    expect(importScrapedProfiles).not.toHaveBeenCalled();
  });

  it("imports only matching roles when the provider returns a mixed sample", async () => {
    const offTargetProfile = {
      ...profile,
      linkedinUrl: "https://www.linkedin.com/in/off-target",
      title: "Clinical Hypnotherapist",
    };
    scrapeLeadsWithTotal.mockResolvedValue({
      profiles: [profile, offTargetProfile],
      totalFound: 2,
    });

    await expect(generateStrategy(strategy, "org-1")).resolves.toBeDefined();

    expect(importScrapedProfiles).toHaveBeenCalledWith("org-1", [profile]);
  });

  it("uses a bounded role-keyword fallback when exact title filtering returns no rows", async () => {
    searchCompanies.mockResolvedValue({
      companies: [],
      totalFound: 0,
      skipped: false,
    });
    scrapeLeadsWithTotal
      .mockResolvedValueOnce({ profiles: [], totalFound: 0 })
      .mockResolvedValueOnce({ profiles: [profile], totalFound: 1 });

    await expect(generateStrategy(strategy, "org-1")).resolves.toBeDefined();

    expect(scrapeLeadsWithTotal).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        jobTitles: [],
        keywords: ["Founder", "CEO"],
      }),
      25,
      { profileScraperMode: "Full" },
    );
  });

  it("still rejects an off-target keyword fallback sample", async () => {
    const offTargetProfile = {
      ...profile,
      title: "Clinical Hypnotherapist",
    };
    scrapeLeadsWithTotal
      .mockResolvedValueOnce({ profiles: [], totalFound: 0 })
      .mockResolvedValueOnce({ profiles: [offTargetProfile], totalFound: 1 });

    await expect(generateStrategy(strategy, "org-1")).rejects.toMatchObject({
      message: expect.stringContaining("outside the selected decision-maker roles"),
    });
    expect(importScrapedProfiles).not.toHaveBeenCalled();
  });
});
