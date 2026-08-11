import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  campaignFindFirst,
  campaignUpdate,
  strategyFindFirst,
  leadFindMany,
  campaignLeadCreateMany,
  searchAndImportLinkedInProspects,
} = vi.hoisted(() => ({
  campaignFindFirst: vi.fn(),
  campaignUpdate: vi.fn(),
  strategyFindFirst: vi.fn(),
  leadFindMany: vi.fn(),
  campaignLeadCreateMany: vi.fn(),
  searchAndImportLinkedInProspects: vi.fn(),
}));

vi.mock("../../lib/prisma.js", () => ({
  prisma: {
    campaign: {
      findFirst: campaignFindFirst,
      update: campaignUpdate,
    },
    strategy: { findFirst: strategyFindFirst },
    lead: { findMany: leadFindMany },
    campaignLead: { createMany: campaignLeadCreateMany },
  },
}));
vi.mock("../prospect-search.js", () => ({ searchAndImportLinkedInProspects }));

import { runOnboardingProspectDiscovery } from "../onboarding-prospect-discovery.js";

const campaign = {
  id: "campaign-1",
  status: "review",
  aiConfig: { source: "onboarding" },
  socialAccountId: "linkedin-sender-1",
  strategyId: "strategy-1",
  _count: { leads: 0 },
};

const strategy = {
  icpDefinition: {
    idealCustomer: "Revenue leaders",
    audienceAnalysis: {
      filters: { jobTitles: ["VP Sales"], locations: ["Canada"] },
    },
  },
};

beforeEach(() => {
  campaignFindFirst.mockReset();
  campaignUpdate.mockReset();
  strategyFindFirst.mockReset();
  leadFindMany.mockReset();
  campaignLeadCreateMany.mockReset();
  searchAndImportLinkedInProspects.mockReset();

  campaignFindFirst.mockResolvedValue(campaign);
  strategyFindFirst.mockResolvedValue(strategy);
  searchAndImportLinkedInProspects.mockResolvedValue({ leadIds: ["lead-1", "lead-2"] });
  leadFindMany.mockResolvedValue([
    { id: "lead-1", enrichmentData: { networkDistance: "FIRST_DEGREE" } },
    { id: "lead-2", enrichmentData: { networkDistance: "SECOND_DEGREE" } },
  ]);
  campaignLeadCreateMany.mockResolvedValue({ count: 2 });
  campaignUpdate.mockResolvedValue({});
});

describe("runOnboardingProspectDiscovery", () => {
  it("uses the campaign sender and enrolls discovered prospects for review", async () => {
    await expect(
      runOnboardingProspectDiscovery({ orgId: "org-1", campaignId: "campaign-1" }),
    ).resolves.toEqual({ prospectCount: 2 });

    expect(searchAndImportLinkedInProspects).toHaveBeenCalledWith(
      "org-1",
      {
        filters: {
          jobTitles: ["VP Sales"],
          industries: [],
          companySizes: [],
          locations: ["Canada"],
          keywords: [],
        },
        maxResults: 25,
      },
      { socialAccountId: "linkedin-sender-1" },
    );
    expect(campaignLeadCreateMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          campaignId: "campaign-1",
          leadId: "lead-1",
          linkedinRelationship: "connected",
          relationshipSenderId: "linkedin-sender-1",
        }),
        expect.objectContaining({
          campaignId: "campaign-1",
          leadId: "lead-2",
          linkedinRelationship: "invite_required",
          relationshipSenderId: "linkedin-sender-1",
        }),
      ],
      skipDuplicates: true,
    });
    expect(campaignUpdate).toHaveBeenLastCalledWith(expect.objectContaining({
      where: { id: "campaign-1" },
      data: expect.objectContaining({ aiConfig: expect.objectContaining({
        onboardingDiscovery: expect.objectContaining({ status: "completed", prospectCount: 2 }),
      }) }),
    }));
  });

  it("records a recoverable failure when LinkedIn finds no matching prospects", async () => {
    searchAndImportLinkedInProspects.mockResolvedValue({ leadIds: [] });
    leadFindMany.mockResolvedValue([]);

    await expect(
      runOnboardingProspectDiscovery({ orgId: "org-1", campaignId: "campaign-1" }),
    ).rejects.toThrow("LinkedIn returned no prospects matching this strategy.");

    expect(campaignUpdate).toHaveBeenLastCalledWith(expect.objectContaining({
      data: expect.objectContaining({ aiConfig: expect.objectContaining({
        onboardingDiscovery: expect.objectContaining({ status: "failed", prospectCount: 0 }),
      }) }),
    }));
  });
});
