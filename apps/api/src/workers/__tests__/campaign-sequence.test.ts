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
  leadUpdate,
  campaignLeadUpdate,
  messageCreate,
  deliveryAttemptUpdate,
  transaction,
  getProfile,
  sendConnectionInvite,
  sendMessageToChat,
  deliverSequenceStep1ViaChat,
  ensureCampaignVideoReady,
  acquireDeliveryReservation,
  markDeliveryReservationUnknown,
  checkAndIncrementDailySendLimit,
  campaignSequenceQueueAdd,
} = vi.hoisted(() => ({
  workerProcessor: { current: null as WorkerProcessor | null },
  campaignLeadFindUnique: vi.fn(),
  leadUpdate: vi.fn(),
  campaignLeadUpdate: vi.fn(),
  messageCreate: vi.fn(),
  deliveryAttemptUpdate: vi.fn(),
  transaction: vi.fn(async (operations: Promise<unknown>[]) => Promise.all(operations)),
  getProfile: vi.fn(),
  sendConnectionInvite: vi.fn(),
  sendMessageToChat: vi.fn(),
  deliverSequenceStep1ViaChat: vi.fn(),
  ensureCampaignVideoReady: vi.fn(),
  acquireDeliveryReservation: vi.fn(),
  markDeliveryReservationUnknown: vi.fn(),
  checkAndIncrementDailySendLimit: vi.fn(),
  campaignSequenceQueueAdd: vi.fn(),
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
  getBullMqIdleDrainDelaySeconds: () => 60,
}));
vi.mock("../../lib/redis.js", () => ({ redisSubscriber: {} }));
vi.mock("../../lib/queue.js", () => ({
  QUEUE_CAMPAIGN_SEQUENCE: "campaign-sequence",
  campaignSequenceJobId: vi.fn(),
  campaignSequenceQueue: { add: campaignSequenceQueueAdd },
}));
vi.mock("../../lib/prisma.js", () => ({
  prisma: {
    campaignLead: { findUnique: campaignLeadFindUnique, update: campaignLeadUpdate },
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
    sendMessageToChat = sendMessageToChat;
  },
}));
vi.mock("../../lib/rate-limiter.js", () => ({
  checkAndIncrementDailySendLimit,
  millisecondsUntilNextUtcDay: () => 60_000,
  utcDay: () => "2026-07-22",
}));
vi.mock("../../services/campaign-step1-chat.js", () => ({
  deliverSequenceStep1ViaChat,
}));
vi.mock("../../services/entitlements.js", () => ({
  getOrganizationEntitlement: vi.fn(async () => ({
    entitled: true,
    currentPeriodEnd: null,
    status: "active",
  })),
}));
vi.mock("../../services/campaign-video.js", () => ({
  ensureCampaignVideoReady,
}));
vi.mock("../../services/delivery-attempt.js", () => ({
  acquireDeliveryReservation,
  markDeliveryReservationUnknown,
}));
vi.mock("../../services/campaign-channel-accounts.js", () => ({
  getCampaignSenderForChannel: vi.fn(async () => ({
    id: "account-1",
    platform: "linkedin",
    status: "active",
    unipileId: "account-1",
  })),
}));

import { startCampaignSequenceWorker } from "../campaign-sequence.js";

const sequence = [
  { type: "linkedin_invite", message: "Connect?", delayHours: 0 },
  { type: "linkedin_message", message: "Thanks for connecting.", delayHours: 0 },
];

function campaignLead(step = 0) {
  return {
    id: "campaign-lead-1",
    status: "active",
    campaignId: "campaign-1",
    leadId: "lead-1",
    linkedinChatId: step > 0 ? "chat-1" : null,
    providerChatId: step > 0 ? "chat-1" : null,
    lead: {
      providerLinkedinId: "lead-provider-1",
      linkedinUrl: "https://www.linkedin.com/in/lead-one",
    },
    campaign: {
      status: "active",
      sequence,
      senderAccount: {
        id: "social-account-1",
        platform: "linkedin",
        status: "active",
        unipileId: "account-1",
      },
    },
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

async function processStep(step: number): Promise<unknown> {
  startCampaignSequenceWorker();
  if (!workerProcessor.current) {
    throw new Error("Campaign sequence worker processor was not registered");
  }
  return workerProcessor.current({
    data: { campaignLeadId: "campaign-lead-1", orgId: "org-1", step },
  });
}

beforeEach(() => {
  campaignLeadFindUnique.mockReset().mockResolvedValue(campaignLead());
  leadUpdate.mockReset().mockResolvedValue({});
  campaignLeadUpdate.mockReset().mockResolvedValue({});
  messageCreate.mockReset().mockResolvedValue({});
  deliveryAttemptUpdate.mockReset().mockResolvedValue({});
  transaction.mockClear();
  getProfile.mockReset();
  sendConnectionInvite.mockReset().mockResolvedValue({});
  sendMessageToChat.mockReset().mockResolvedValue({ message_id: "message-1" });
  deliverSequenceStep1ViaChat.mockReset().mockResolvedValue({ delivered: true, chatId: "chat-1" });
  ensureCampaignVideoReady.mockReset().mockResolvedValue({ state: "ready" });
  acquireDeliveryReservation.mockReset().mockResolvedValue({ acquired: true, attemptId: "attempt-1" });
  markDeliveryReservationUnknown.mockReset();
  checkAndIncrementDailySendLimit.mockReset().mockResolvedValue({ allowed: true, remaining: 19 });
  campaignSequenceQueueAdd.mockReset();
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
    expect(campaignLeadUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        linkedinRelationship: "connected",
        relationshipSenderId: "account-1",
      }),
    }));
  });

  it("treats Unipile's relationship flag as connected even without FIRST_DEGREE", async () => {
    getProfile.mockResolvedValue({
      network_distance: "SECOND_DEGREE",
      is_relationship: true,
      provider_id: "profile-provider-1",
    });

    await expect(processStepZero()).resolves.toMatchObject({
      path: "already-connected",
      sent: true,
    });
    expect(sendConnectionInvite).not.toHaveBeenCalled();
    expect(deliverSequenceStep1ViaChat).toHaveBeenCalledOnce();
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
    expect(campaignLeadUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        linkedinRelationship: "invite_required",
        relationshipSenderId: "account-1",
      }),
    }));
  });

  it("skips and reschedules delivery when the sender has reached the daily cap", async () => {
    getProfile.mockResolvedValue({
      network_distance: "SECOND_DEGREE",
      is_relationship: false,
      provider_id: "profile-provider-1",
    });
    checkAndIncrementDailySendLimit.mockResolvedValue({ allowed: false, remaining: 0 });

    await expect(processStepZero()).resolves.toEqual({
      skipped: true,
      reason: "daily send limit reached for this sender",
    });

    expect(sendConnectionInvite).not.toHaveBeenCalled();
    expect(acquireDeliveryReservation).not.toHaveBeenCalled();
    expect(campaignSequenceQueueAdd).toHaveBeenCalledWith(
      "campaign-sequence",
      { campaignLeadId: "campaign-lead-1", orgId: "org-1", step: 0 },
      expect.objectContaining({ delay: 60_000 }),
    );
  });

  it("sends a follow-up when the message limit permits it", async () => {
    campaignLeadFindUnique.mockResolvedValue(campaignLead(1));

    await expect(processStep(1)).resolves.toMatchObject({ sent: true, step: 1 });

    expect(checkAndIncrementDailySendLimit).toHaveBeenCalledWith("account-1", "message");
    expect(sendMessageToChat).toHaveBeenCalledWith("chat-1", "Thanks for connecting.");
  });
});
