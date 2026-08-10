import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConflictError, ValidationError } from "../../lib/errors.js";

const {
  campaignFindUnique,
  campaignUpdate,
  ensureCampaignStepZeroQueued,
  resolveAndSyncCampaignChannelAccounts,
  getCampaignRelationshipSummary,
  cancelCampaignPendingSequenceJobs,
  requireOrganizationEntitlement,
  invalidateDashboardChrome,
  socialAccountFindFirst,
  resolveInstagramCampaignIdentities,
} = vi.hoisted(() => ({
  campaignFindUnique: vi.fn(),
  campaignUpdate: vi.fn(),
  ensureCampaignStepZeroQueued: vi.fn(),
  resolveAndSyncCampaignChannelAccounts: vi.fn(),
  getCampaignRelationshipSummary: vi.fn(),
  cancelCampaignPendingSequenceJobs: vi.fn(),
  requireOrganizationEntitlement: vi.fn(),
  invalidateDashboardChrome: vi.fn(),
  socialAccountFindFirst: vi.fn(),
  resolveInstagramCampaignIdentities: vi.fn(),
}));

vi.mock("../../lib/prisma.js", () => ({
  prisma: {
    campaign: { findUnique: campaignFindUnique, update: campaignUpdate },
    socialAccount: { findFirst: socialAccountFindFirst },
  },
}));
vi.mock("../campaign-step0-queue.js", () => ({ ensureCampaignStepZeroQueued }));
vi.mock("../campaign-channel-accounts.js", () => ({ resolveAndSyncCampaignChannelAccounts }));
vi.mock("../campaign-relationship-routing.js", () => ({ getCampaignRelationshipSummary }));
vi.mock("../campaign-sequence-control.js", () => ({ cancelCampaignPendingSequenceJobs }));
vi.mock("../entitlements.js", () => ({ requireOrganizationEntitlement }));
vi.mock("../../lib/dashboard-cache.js", () => ({ invalidateDashboardChrome }));
vi.mock("../instagram-identity-resolution.js", () => ({
  resolveInstagramCampaignIdentities,
}));

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
  leads: [
    { id: "campaign-lead-1", lead: { phone: null, providerWhatsappId: null, reviewStatus: "approved" } },
    { id: "campaign-lead-2", lead: { phone: null, providerWhatsappId: null, reviewStatus: "approved" } },
  ],
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
  socialAccountFindFirst.mockReset().mockResolvedValue({ unipileId: "instagram-account" });
  resolveInstagramCampaignIdentities.mockReset().mockResolvedValue({
    total: 2,
    reachable: 1,
    unresolved: 1,
    invalid: 0,
    errors: 0,
    suppressed: 0,
  });
});

describe("launchCampaign", () => {
  it("blocks launch while any enrolled prospect is still pending review", async () => {
    campaignFindUnique.mockResolvedValue({
      ...campaign,
      leads: [
        campaign.leads[0],
        {
          ...campaign.leads[1],
          lead: { ...campaign.leads[1].lead, reviewStatus: "pending" },
        },
      ],
    });

    await expect(launchCampaign({
      campaignId: "campaign-1",
      orgId: "org-1",
    })).rejects.toBeInstanceOf(ValidationError);

    expect(resolveAndSyncCampaignChannelAccounts).not.toHaveBeenCalled();
    expect(ensureCampaignStepZeroQueued).not.toHaveBeenCalled();
    expect(campaignUpdate).not.toHaveBeenCalled();
  });

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

  it("rejects a WhatsApp campaign when no enrolled prospect has a reachable phone", async () => {
    campaignFindUnique.mockResolvedValue({
      ...campaign,
      channels: ["whatsapp"],
      sequence: [{ type: "whatsapp_message", message: "Hi", delayHours: 0 }],
    });

    await expect(launchCampaign({
      campaignId: "campaign-1",
      orgId: "org-1",
    })).rejects.toBeInstanceOf(ValidationError);

    expect(resolveAndSyncCampaignChannelAccounts).toHaveBeenCalled();
    expect(ensureCampaignStepZeroQueued).not.toHaveBeenCalled();
  });

  it("launches WhatsApp sequencing when at least one prospect has a valid phone", async () => {
    campaignFindUnique.mockResolvedValue({
      ...campaign,
      channels: ["whatsapp"],
      sequence: [{ type: "whatsapp_message", message: "Hi", delayHours: 0 }],
      leads: [{
        id: "campaign-lead-1",
        lead: {
          phone: "+14165550123",
          providerWhatsappId: null,
          whatsappConsentAt: new Date("2026-07-20T12:00:00.000Z"),
          whatsappConsentSource: "website form",
          outreachSuppressedAt: null,
          reviewStatus: "approved",
        },
      }],
    });
    ensureCampaignStepZeroQueued.mockResolvedValue("enqueued");

    await expect(launchCampaign({
      campaignId: "campaign-1",
      orgId: "org-1",
    })).resolves.toMatchObject({ launched: true, jobCount: 1 });
  });

  it("resolves Instagram identities before queueing and returns reachability", async () => {
    campaignFindUnique.mockResolvedValue({
      ...campaign,
      channels: ["instagram"],
      sequence: [{ type: "instagram_message", message: "Hi", delayHours: 0 }],
    });
    resolveAndSyncCampaignChannelAccounts.mockResolvedValue({
      linkedInSocialAccountId: null,
      channelAccounts: { instagram: "instagram-sender" },
    });
    ensureCampaignStepZeroQueued.mockResolvedValue("enqueued");

    const result = await launchCampaign({ campaignId: "campaign-1", orgId: "org-1" });

    expect(resolveInstagramCampaignIdentities).toHaveBeenCalledWith(expect.objectContaining({
      unipileAccountId: "instagram-account",
    }));
    expect(result.channelReachability?.instagram).toMatchObject({ reachable: 1, unresolved: 1 });
  });

  it("blocks Instagram launch when no messaging identities can be resolved", async () => {
    campaignFindUnique.mockResolvedValue({
      ...campaign,
      channels: ["instagram"],
      sequence: [{ type: "instagram_message", message: "Hi", delayHours: 0 }],
    });
    resolveAndSyncCampaignChannelAccounts.mockResolvedValue({
      linkedInSocialAccountId: null,
      channelAccounts: { instagram: "instagram-sender" },
    });
    resolveInstagramCampaignIdentities.mockResolvedValue({
      total: 2,
      reachable: 0,
      unresolved: 2,
      invalid: 0,
      errors: 0,
      suppressed: 0,
    });

    await expect(launchCampaign({ campaignId: "campaign-1", orgId: "org-1" }))
      .rejects.toBeInstanceOf(ValidationError);
    expect(ensureCampaignStepZeroQueued).not.toHaveBeenCalled();
  });
});
