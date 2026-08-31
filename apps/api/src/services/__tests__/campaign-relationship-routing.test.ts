import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  campaignLeadCount,
  campaignLeadFindFirst,
  campaignLeadFindMany,
  campaignLeadGroupBy,
  campaignLeadUpdate,
  leadUpdate,
  transaction,
} = vi.hoisted(() => ({
  campaignLeadCount: vi.fn(),
  campaignLeadFindFirst: vi.fn(),
  campaignLeadFindMany: vi.fn(),
  campaignLeadGroupBy: vi.fn(),
  campaignLeadUpdate: vi.fn(),
  leadUpdate: vi.fn(),
  transaction: vi.fn(async (operations: Promise<unknown>[]) => Promise.all(operations)),
}));

vi.mock("../../config/env.js", () => ({
  env: { UNIPILE_API_KEY: "key" },
}));
vi.mock("../../lib/prisma.js", () => ({
  prisma: {
    campaignLead: {
      count: campaignLeadCount,
      findFirst: campaignLeadFindFirst,
      findMany: campaignLeadFindMany,
      groupBy: campaignLeadGroupBy,
      update: campaignLeadUpdate,
    },
    lead: { update: leadUpdate },
    $transaction: transaction,
  },
}));

import {
  getCampaignRelationshipSummary,
  refreshCampaignRelationshipRouting,
} from "../campaign-relationship-routing.js";

beforeEach(() => {
  campaignLeadCount.mockReset();
  campaignLeadFindFirst.mockReset();
  campaignLeadFindMany.mockReset();
  campaignLeadGroupBy.mockReset();
  campaignLeadUpdate.mockReset().mockResolvedValue({});
  leadUpdate.mockReset().mockResolvedValue({});
  transaction.mockClear();
});

describe("campaign relationship routing", () => {
  it("treats checks from another sender as unknown", async () => {
    campaignLeadGroupBy.mockResolvedValue([
      { linkedinRelationship: "connected", _count: { _all: 2 } },
      { linkedinRelationship: "invite_required", _count: { _all: 3 } },
      { linkedinRelationship: "unresolved", _count: { _all: 1 } },
    ]);

    await expect(getCampaignRelationshipSummary({
      campaignId: "campaign-1",
      senderId: "sender-2",
      total: 8,
    })).resolves.toEqual({
      total: 8,
      directMessage: 2,
      inviteRequired: 3,
      unresolved: 1,
      checked: 6,
      unknown: 2,
    });
    expect(campaignLeadGroupBy).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ relationshipSenderId: "sender-2" }),
    }));
  });

  it("classifies connected, invite, and identifier-free enrollments", async () => {
    campaignLeadFindMany.mockResolvedValue([
      {
        id: "membership-connected",
        leadId: "lead-connected",
        lead: { linkedinUrl: "https://linkedin.com/in/connected", providerLinkedinId: null },
      },
      {
        id: "membership-invite",
        leadId: "lead-invite",
        lead: { linkedinUrl: null, providerLinkedinId: "invite-provider" },
      },
      {
        id: "membership-unresolved",
        leadId: "lead-unresolved",
        lead: { linkedinUrl: null, providerLinkedinId: null },
      },
    ]);
    campaignLeadCount.mockResolvedValue(3);
    campaignLeadGroupBy.mockResolvedValue([
      { linkedinRelationship: "connected", _count: { _all: 1 } },
      { linkedinRelationship: "invite_required", _count: { _all: 1 } },
      { linkedinRelationship: "unresolved", _count: { _all: 1 } },
    ]);
    const getProfile = vi.fn(async (_accountId: string, identifier: string) => ({
      provider_id: `${identifier}-resolved`,
      public_identifier: identifier,
      first_name: "Test",
      last_name: "Lead",
      headline: "",
      network_distance: identifier === "connected" ? "FIRST_DEGREE" : "SECOND_DEGREE",
      is_relationship: identifier === "connected",
    }));

    await expect(refreshCampaignRelationshipRouting({
      campaignId: "campaign-1",
      orgId: "org-1",
      sender: { id: "sender-1", unipileId: "unipile-1" },
      adapter: { getProfile },
    })).resolves.toMatchObject({
      total: 3,
      directMessage: 1,
      inviteRequired: 1,
      unresolved: 1,
      processed: 3,
      hasMore: false,
    });

    expect(campaignLeadUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "membership-connected" },
      data: expect.objectContaining({ linkedinRelationship: "connected", relationshipSenderId: "sender-1" }),
    }));
    expect(campaignLeadUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "membership-invite" },
      data: expect.objectContaining({ linkedinRelationship: "invite_required", relationshipSenderId: "sender-1" }),
    }));
    expect(campaignLeadUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "membership-unresolved" },
      data: expect.objectContaining({ linkedinRelationship: "unresolved", relationshipSenderId: "sender-1" }),
    }));
    expect(leadUpdate).toHaveBeenCalledWith({
      where: { id: "lead-connected" },
      data: { providerLinkedinId: "connected-resolved" },
    });
    expect(leadUpdate).not.toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "connected" }),
    }));
  });

  it("rejects a cursor outside the organization-scoped campaign", async () => {
    campaignLeadFindFirst.mockResolvedValue(null);

    await expect(refreshCampaignRelationshipRouting({
      campaignId: "campaign-1",
      orgId: "org-1",
      sender: { id: "sender-1", unipileId: "unipile-1" },
      cursor: "membership-from-another-campaign",
      adapter: { getProfile: vi.fn() },
    })).rejects.toMatchObject({
      statusCode: 400,
      code: "VALIDATION_ERROR",
    });
    expect(campaignLeadFindMany).not.toHaveBeenCalled();
  });
});
