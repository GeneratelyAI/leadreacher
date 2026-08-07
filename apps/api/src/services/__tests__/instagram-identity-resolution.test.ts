import { beforeEach, describe, expect, it, vi } from "vitest";

const { leadUpdate, getProfile } = vi.hoisted(() => ({
  leadUpdate: vi.fn(),
  getProfile: vi.fn(),
}));

vi.mock("../../lib/prisma.js", () => ({
  prisma: { lead: { update: leadUpdate } },
}));

import { resolveInstagramCampaignIdentities } from "../instagram-identity-resolution.js";

beforeEach(() => {
  leadUpdate.mockReset().mockResolvedValue({});
  getProfile.mockReset();
});

describe("resolveInstagramCampaignIdentities", () => {
  it("resolves imported usernames and reports unreachable and suppressed leads", async () => {
    getProfile.mockResolvedValue({
      provider_id: "profile-1",
      messaging_identifier: "message-1",
    });

    const result = await resolveInstagramCampaignIdentities({
      unipileAccountId: "account-1",
      adapter: { getProfile },
      leads: [
        { id: "lead-1", instagramUsername: "@ada", instagramMessagingId: null, providerInstagramId: null, outreachSuppressedAt: null, enrichmentData: null },
        { id: "lead-2", instagramUsername: null, instagramMessagingId: null, providerInstagramId: null, outreachSuppressedAt: null, enrichmentData: null },
        { id: "lead-3", instagramUsername: "grace", instagramMessagingId: null, providerInstagramId: null, outreachSuppressedAt: new Date(), enrichmentData: null },
      ],
    });

    expect(getProfile).toHaveBeenCalledWith("account-1", "ada");
    expect(leadUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "lead-1" },
      data: expect.objectContaining({
        instagramMessagingId: "message-1",
        instagramIdentityStatus: "resolved",
      }),
    }));
    expect(result).toEqual({ total: 3, reachable: 1, unresolved: 1, invalid: 0, errors: 0, suppressed: 1 });
  });

  it("records a retryable resolution error without failing the whole audience", async () => {
    getProfile.mockRejectedValue(new Error("provider unavailable"));
    await expect(resolveInstagramCampaignIdentities({
      unipileAccountId: "account-1",
      adapter: { getProfile },
      leads: [{ id: "lead-1", instagramUsername: "ada", instagramMessagingId: null, providerInstagramId: null, outreachSuppressedAt: null, enrichmentData: null }],
    })).resolves.toEqual({ total: 1, reachable: 0, unresolved: 0, invalid: 0, errors: 1, suppressed: 0 });
    expect(leadUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: { instagramIdentityStatus: "error" },
    }));
  });
});
