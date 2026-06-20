import { beforeEach, describe, expect, it, vi } from "vitest";

const { findMany, findFirst, leadUpdate, getProfile, deliver } = vi.hoisted(
  () => ({
    findMany: vi.fn(),
    findFirst: vi.fn(),
    leadUpdate: vi.fn(),
    getProfile: vi.fn(),
    deliver: vi.fn(),
  }),
);

vi.mock("../../lib/prisma.js", () => ({
  prisma: {
    campaignLead: { findMany },
    socialAccount: { findFirst },
    lead: { update: leadUpdate },
  },
}));
vi.mock("../../config/env.js", () => ({
  env: { UNIPILE_DSN: "dsn", UNIPILE_API_KEY: "key" },
}));
vi.mock("../../lib/redis.js", () => ({ redis: {}, redisSubscriber: {} }));
vi.mock("../../lib/queue.js", () => ({
  QUEUE_RECONCILE_RELATIONS: "reconcile-relations",
  scheduleReconcileRelations: vi.fn(),
}));
vi.mock("../../adapters/unipile.js", () => ({
  UnipileAdapter: class {
    getProfile = getProfile;
  },
}));
vi.mock("../../services/campaign-step1-chat.js", () => ({
  deliverSequenceStep1ViaChat: deliver,
}));

import { reconcilePendingConnections } from "../reconcile-relations.js";

const SEQUENCE = [
  { type: "connection", message: "hi", delayHours: 0 },
  { type: "message", message: "step1", delayHours: 0 },
];

function candidate(id: string, providerLinkedinId: string) {
  return {
    id,
    leadId: `lead-${id}`,
    campaignId: `camp-${id}`,
    linkedinChatId: null,
    lead: { providerLinkedinId, linkedinUrl: null },
    campaign: { orgId: "org1", sequence: SEQUENCE },
  };
}

beforeEach(() => {
  findMany.mockReset();
  findFirst.mockReset();
  leadUpdate.mockReset();
  getProfile.mockReset();
  deliver.mockReset();
  findFirst.mockResolvedValue({ unipileId: "ACC", status: "active" });
  leadUpdate.mockResolvedValue({});
  deliver.mockResolvedValue({ delivered: true, chatId: "chat1" });
});

describe("reconcilePendingConnections", () => {
  it("returns early when there are no candidates", async () => {
    findMany.mockResolvedValue([]);
    const result = await reconcilePendingConnections();
    expect(result).toEqual({ checked: 0, advanced: 0 });
    expect(getProfile).not.toHaveBeenCalled();
  });

  it("advances only candidates that are now first-degree", async () => {
    findMany.mockResolvedValue([candidate("cl1", "P1"), candidate("cl2", "P2")]);
    getProfile.mockImplementation(async (_acc: string, id: string) =>
      id === "P1"
        ? { network_distance: "FIRST_DEGREE", is_relationship: true, provider_id: "P1" }
        : { network_distance: "SECOND_DEGREE", is_relationship: false, provider_id: "P2" },
    );

    const result = await reconcilePendingConnections();

    expect(result).toEqual({ checked: 2, advanced: 1 });
    expect(deliver).toHaveBeenCalledTimes(1);
    expect(deliver.mock.calls[0][0]).toMatchObject({ campaignLeadId: "cl1" });
    // org social account resolved once and cached across candidates
    expect(findFirst).toHaveBeenCalledTimes(1);
  });

  it("skips a candidate whose getProfile call fails, without advancing it", async () => {
    findMany.mockResolvedValue([candidate("cl1", "P1")]);
    getProfile.mockRejectedValueOnce(new Error("unipile 429"));

    const result = await reconcilePendingConnections();

    expect(result).toEqual({ checked: 1, advanced: 0 });
    expect(deliver).not.toHaveBeenCalled();
  });
});
