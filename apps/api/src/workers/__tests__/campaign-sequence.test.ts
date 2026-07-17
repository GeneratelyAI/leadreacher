import { beforeEach, describe, expect, it, vi } from "vitest";

type CampaignSequenceJobData = {
  campaignLeadId: string;
  orgId: string;
  step: number;
};

type WorkerProcessor = (job: { data: CampaignSequenceJobData }) => Promise<unknown>;

const {
  workerProcessor,
  campaignLeadFindUnique,
  socialAccountFindFirst,
  leadUpdate,
  campaignLeadUpdate,
  messageCreate,
  deliveryAttemptUpdate,
  transaction,
  getProfile,
  sendConnectionInvite,
  deliverSequenceStep1ViaChat,
  ensurePersonalizedVideoReady,
  acquireDeliveryReservation,
  markDeliveryReservationUnknown,
} = vi.hoisted(() => ({
  workerProcessor: { current: null as WorkerProcessor | null },
  campaignLeadFindUnique: vi.fn(),
  socialAccountFindFirst: vi.fn(),
  leadUpdate: vi.fn(),
  campaignLeadUpdate: vi.fn(),
  messageCreate: vi.fn(),
  deliveryAttemptUpdate: vi.fn(),
  transaction: vi.fn(async (operations: Promise<unknown>[]) => Promise.all(operations)),
  getProfile: vi.fn(),
  sendConnectionInvite: vi.fn(),
  deliverSequenceStep1ViaChat: vi.fn(),
  ensurePersonalizedVideoReady: vi.fn(),
  acquireDeliveryReservation: vi.fn(),
  markDeliveryReservationUnknown: vi.fn(),
}));

vi.mock("bullmq", () => ({
  DelayedError: class DelayedError extends Error {},
  Worker: class {
    constructor(_queue: string, processor: WorkerProcessor) {
      workerProcessor.current = processor;
    }

    on() {
      return this;
    }
  },
}));
vi.mock("../../config/env.js", () => ({
  env: { UNIPILE_DSN: "dsn", UNIPILE_API_KEY: "key" },
}));
vi.mock("../../lib/redis.js", () => ({ redisSubscriber: {} }));
vi.mock("../../lib/queue.js", () => ({
  QUEUE_CAMPAIGN_SEQUENCE: "campaign-sequence",
  campaignSequenceJobId: vi.fn(),
  campaignSequenceQueue: { add: vi.fn() },
}));
vi.mock("../../lib/prisma.js", () => ({
  prisma: {
    campaignLead: { findUnique: campaignLeadFindUnique, update: campaignLeadUpdate },
    socialAccount: { findFirst: socialAccountFindFirst },
    lead: { update: leadUpdate },
    message: { create: messageCreate },
    deliveryAttempt: { update: deliveryAttemptUpdate },
    $transaction: transaction,
  },
}));
vi.mock("../../adapters/unipile.js", () => ({
  UnipileAdapter: class {
    getProfile = getProfile;
    sendConnectionInvite = sendConnectionInvite;
  },
}));
vi.mock("../../services/campaign-step1-chat.js", () => ({
  deliverSequenceStep1ViaChat,
}));
vi.mock("../../services/personalized-video.js", () => ({
  ensurePersonalizedVideoReady,
}));
vi.mock("../../services/delivery-attempt.js", () => ({
  acquireDeliveryReservation,
  markDeliveryReservationUnknown,
}));

import { startCampaignSequenceWorker } from "../campaign-sequence.js";

const sequence = [
  { type: "linkedin_invite", message: "Connect?", delayHours: 0 },
  { type: "linkedin_message", message: "Thanks for connecting.", delayHours: 0 },
];

function campaignLead() {
  return {
    id: "campaign-lead-1",
    status: "active",
    campaignId: "campaign-1",
    leadId: "lead-1",
    linkedinChatId: null,
    lead: {
      providerLinkedinId: "lead-provider-1",
      linkedinUrl: "https://www.linkedin.com/in/lead-one",
    },
    campaign: { sequence },
  };
}

async function processStepZero(): Promise<unknown> {
  startCampaignSequenceWorker();
  if (!workerProcessor.current) {
    throw new Error("Campaign sequence worker processor was not registered");
  }
  return workerProcessor.current({
    data: { campaignLeadId: "campaign-lead-1", orgId: "org-1", step: 0 },
  });
}

beforeEach(() => {
  campaignLeadFindUnique.mockReset().mockResolvedValue(campaignLead());
  socialAccountFindFirst.mockReset().mockResolvedValue({ unipileId: "account-1" });
  leadUpdate.mockReset().mockResolvedValue({});
  campaignLeadUpdate.mockReset().mockResolvedValue({});
  messageCreate.mockReset().mockResolvedValue({});
  deliveryAttemptUpdate.mockReset().mockResolvedValue({});
  transaction.mockClear();
  getProfile.mockReset();
  sendConnectionInvite.mockReset().mockResolvedValue({});
  deliverSequenceStep1ViaChat.mockReset().mockResolvedValue({ delivered: true, chatId: "chat-1" });
  ensurePersonalizedVideoReady.mockReset().mockResolvedValue({ state: "ready" });
  acquireDeliveryReservation.mockReset().mockResolvedValue({ acquired: true, attemptId: "attempt-1" });
  markDeliveryReservationUnknown.mockReset();
  workerProcessor.current = null;
});

describe("campaign sequence step zero", () => {
  it("skips the invite and starts the chat for an already-connected lead", async () => {
    getProfile.mockResolvedValue({
      network_distance: "FIRST_DEGREE",
      is_relationship: true,
      provider_id: "profile-provider-1",
    });

    await expect(processStepZero()).resolves.toMatchObject({
      path: "already-connected",
      sent: true,
    });

    expect(sendConnectionInvite).not.toHaveBeenCalled();
    expect(deliverSequenceStep1ViaChat).toHaveBeenCalledWith(expect.objectContaining({
      campaignLeadId: "campaign-lead-1",
      attendeeProviderId: "lead-provider-1",
      unipileAccountId: "account-1",
      sequence,
    }));
  });

  it("sends an invite for a lead that is not already connected", async () => {
    getProfile.mockResolvedValue({
      network_distance: "SECOND_DEGREE",
      is_relationship: false,
      provider_id: "profile-provider-1",
    });

    await expect(processStepZero()).resolves.toMatchObject({
      path: "invite-sent",
      sent: true,
    });

    expect(deliverSequenceStep1ViaChat).not.toHaveBeenCalled();
    expect(sendConnectionInvite).toHaveBeenCalledWith(
      "account-1",
      "lead-provider-1",
      "Connect?",
    );
  });
});
