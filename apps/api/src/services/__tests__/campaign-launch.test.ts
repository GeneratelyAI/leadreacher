import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConflictError } from "../../lib/errors.js";

const {
  campaignFindUnique,
  campaignUpdate,
  ensureCampaignStepZeroQueued,
  resolveAndSyncCampaignChannelAccounts,
  getCampaignRelationshipSummary,
  cancelCampaignPendingSequenceJobs,
  requireOrganizationEntitlement,
  invalidateDashboardChrome,
} = vi.hoisted(() => ({
  campaignFindUnique: vi.fn(),
  campaignUpdate: vi.fn(),
  ensureCampaignStepZeroQueued: vi.fn(),
  resolveAndSyncCampaignChannelAccounts: vi.fn(),
  getCampaignRelationshipSummary: vi.fn(),
  cancelCampaignPendingSequenceJobs: vi.fn(),
  requireOrganizationEntitlement: vi.fn(),
  invalidateDashboardChrome: vi.fn(),
}));

vi.mock("../../lib/prisma.js", () => ({
  prisma: {
    campaign: { findUnique: campaignFindUnique, update: campaignUpdate },
  },
}));
vi.mock("../campaign-step0-queue.js", () => ({ ensureCampaignStepZeroQueued }));
vi.mock("../campaign-channel-accounts.js", () => ({ resolveAndSyncCampaignChannelAccounts }));
vi.mock("../campaign-relationship-routing.js", () => ({ getCampaignRelationshipSummary }));
vi.mock("../campaign-sequence-control.js", () => ({ cancelCampaignPendingSequenceJobs }));
vi.mock("../entitlements.js", () => ({ requireOrganizationEntitlement }));
vi.mock("../../lib/dashboard-cache.js", () => ({ invalidateDashboardChrome }));

import { launchCampaign } from "../campaign-launch.js";

const campaign = {
  id: "campaign-1",
  orgId: "org-1",
  status: "review",
  channels: ["linkedin"],
  sequence: [
    { type: "linkedin_invite", message: "Hi {{FirstName}}", delayHours: 0 },
  ],
  socialAccountId: "sender-1",
  aiConfig: { requiresSequenceReview: false },
  senderAccount: { id: "sender-1" },
  leads: [{ id: "campaign-lead-1" }, { id: "campaign-lead-2" }],
};

beforeEach(() => {
  campaignFindUnique.mockReset().mockResolvedValue(campaign);
  campaignUpdate.mockReset().mockResolvedValue({ ...campaign, status: "active" });
  ensureCampaignStepZeroQueued.mockReset();
  resolveAndSyncCampaignChannelAccounts.mockReset().mockResolvedValue({
    linkedInSocialAccountId: "sender-1",
    channelAccounts: { linkedin: "sender-1" },
  });
  getCampaignRelationshipSummary.mockReset().mockResolvedValue({
    total: 2,
    directMessage: 0,
    inviteRequired: 0,
    unresolved: 0,
    unknown: 2,
    checked: 0,
  });
  cancelCampaignPendingSequenceJobs.mockReset().mockResolvedValue(undefined);
  requireOrganizationEntitlement.mockReset().mockResolvedValue(undefined);
  invalidateDashboardChrome.mockReset().mockResolvedValue(undefined);
});

describe("launchCampaign", () => {
  it("uses the shared guards and activates a campaign after all step-zero jobs are pending", async () => {
    ensureCampaignStepZeroQueued
      .mockResolvedValueOnce("enqueued")
      .mockResolvedValueOnce("pending");

    const result = await launchCampaign({
      campaignId: "campaign-1",
      orgId: "org-1",
      delayMs: 5_000,
    });

    expect(requireOrganizationEntitlement).toHaveBeenCalledWith("org-1");
    expect(resolveAndSyncCampaignChannelAccounts).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: "org-1",
        campaignId: "campaign-1",
        socialAccountId: "sender-1",
      }),
    );
    expect(ensureCampaignStepZeroQueued).toHaveBeenCalledTimes(2);
    expect(campaignUpdate).toHaveBeenCalledWith({
      where: { id: "campaign-1" },
      data: { status: "active", suspensionReason: null },
    });
    expect(cancelCampaignPendingSequenceJobs).not.toHaveBeenCalled();
    expect(result).toMatchObject({ launched: true, jobCount: 2 });
  });

  it("cancels queued work and leaves the campaign inactive when one lead cannot be scheduled", async () => {
    ensureCampaignStepZeroQueued
      .mockResolvedValueOnce("enqueued")
      .mockResolvedValueOnce("completed");

    await expect(launchCampaign({
      campaignId: "campaign-1",
      orgId: "org-1",
    })).rejects.toBeInstanceOf(ConflictError);

    expect(cancelCampaignPendingSequenceJobs).toHaveBeenCalledWith({
      campaignId: "campaign-1",
      orgId: "org-1",
    });
    expect(campaignUpdate).not.toHaveBeenCalled();
  });
});
