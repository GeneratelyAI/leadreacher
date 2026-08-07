import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { create, findUnique } = vi.hoisted(() => ({ create: vi.fn(), findUnique: vi.fn() }));
vi.mock("../../lib/prisma.js", () => ({ prisma: { channelOutreachClaim: { create, findUnique } } }));

import { claimFirstChannelOutreach } from "../channel-outreach-claim.js";

describe("claimFirstChannelOutreach", () => {
  beforeEach(() => { create.mockReset(); findUnique.mockReset(); });

  it("acquires the first organization/lead/channel claim", async () => {
    create.mockResolvedValue({ campaignId: "campaign-a" });
    await expect(claimFirstChannelOutreach({ orgId: "org", leadId: "lead", campaignId: "campaign-a", channel: "instagram" }))
      .resolves.toEqual({ acquired: true, campaignId: "campaign-a" });
  });

  it("rejects a concurrent claim owned by another campaign", async () => {
    create.mockRejectedValue(new Prisma.PrismaClientKnownRequestError("duplicate", { code: "P2002", clientVersion: "test" }));
    findUnique.mockResolvedValue({ campaignId: "campaign-a" });
    await expect(claimFirstChannelOutreach({ orgId: "org", leadId: "lead", campaignId: "campaign-b", channel: "whatsapp" }))
      .resolves.toEqual({ acquired: false, campaignId: "campaign-a" });
  });
});
