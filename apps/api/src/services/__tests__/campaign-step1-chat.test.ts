import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  startChat,
  getReadyVideo,
  acquireReservation,
  markUnknown,
  queueAdd,
  transaction,
  campaignLeadUpdate,
  messageCreate,
  deliveryAttemptUpdate,
  checkAndIncrementDailySendLimit,
} = vi.hoisted(() => ({
  startChat: vi.fn(),
  getReadyVideo: vi.fn(),
  acquireReservation: vi.fn(),
  markUnknown: vi.fn(),
  queueAdd: vi.fn(),
  transaction: vi.fn(async (operations: Promise<unknown>[]) => Promise.all(operations)),
  campaignLeadUpdate: vi.fn(),
  messageCreate: vi.fn(),
  deliveryAttemptUpdate: vi.fn(),
  checkAndIncrementDailySendLimit: vi.fn(),
}));

vi.mock("../../lib/prisma.js", () => ({
  prisma: {
    $transaction: transaction,
    campaignLead: { update: campaignLeadUpdate },
    message: { create: messageCreate },
    deliveryAttempt: { update: deliveryAttemptUpdate },
  },
}));
vi.mock("../../lib/queue.js", () => ({
  QUEUE_CAMPAIGN_SEQUENCE: "campaign-sequence",
  campaignSequenceJobId: vi.fn(),
  campaignSequenceQueue: { add: queueAdd },
}));
vi.mock("../delivery-attempt.js", () => ({
  acquireDeliveryReservation: acquireReservation,
  markDeliveryReservationUnknown: markUnknown,
}));
vi.mock("../personalized-video.js", () => ({
  getReadyPersonalizedVideoForDelivery: getReadyVideo,
}));
vi.mock("../../lib/rate-limiter.js", () => ({
  checkAndIncrementDailySendLimit,
  millisecondsUntilNextUtcDay: () => 60_000,
  utcDay: () => "2026-07-22",
}));

import { deliverSequenceStep1ViaChat } from "../campaign-step1-chat.js";

beforeEach(() => {
  startChat.mockReset();
  getReadyVideo.mockReset();
  acquireReservation.mockReset();
  markUnknown.mockReset();
  queueAdd.mockReset();
  transaction.mockClear();
  campaignLeadUpdate.mockReset().mockResolvedValue({});
  messageCreate.mockReset().mockResolvedValue({});
  deliveryAttemptUpdate.mockReset().mockResolvedValue({});
  acquireReservation.mockResolvedValue({ acquired: true, attemptId: "attempt-1" });
  startChat.mockResolvedValue({ chat_id: "chat-1" });
  checkAndIncrementDailySendLimit.mockReset().mockResolvedValue({ allowed: true, remaining: 49 });
});

describe("deliverSequenceStep1ViaChat", () => {
  it("attaches a ready lead-specific MP4 to the first chat without exposing its R2 URL in text", async () => {
    getReadyVideo.mockResolvedValue({
      videoUrl: "https://media.example/personalized/lead-1.mp4",
      buffer: Buffer.from("video"),
      filename: "personalized-video-lead-1.mp4",
      contentType: "video/mp4",
    });

    await expect(deliverSequenceStep1ViaChat({
      adapter: { startChat } as never,
      campaignLeadId: "campaign-lead-1",
      orgId: "org-1",
      campaignId: "campaign-1",
      leadId: "lead-1",
      attendeeProviderId: "linkedin-lead-1",
      unipileAccountId: "account-1",
      sequence: [
        { type: "linkedin_invite", message: "Connect?", delayHours: 0 },
        { type: "linkedin_message", message: "Thanks for connecting.", delayHours: 0 },
      ],
      existingChatId: null,
    })).resolves.toEqual({ delivered: true, chatId: "chat-1" });

    expect(startChat).toHaveBeenCalledWith(
      "account-1",
      "linkedin-lead-1",
      "Thanks for connecting.",
      {
        videoMessage: {
          buffer: Buffer.from("video"),
          filename: "personalized-video-lead-1.mp4",
          contentType: "video/mp4",
        },
      },
    );
    expect(messageCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        content: expect.objectContaining({
          type: "text",
          message: "Thanks for connecting.",
          attachments: [expect.objectContaining({
            type: "video",
            videoUrl: "https://media.example/personalized/lead-1.mp4",
          })],
        }),
      }),
    }));
  });

  it("defers the first chat instead of sending when the sender has reached the message cap", async () => {
    checkAndIncrementDailySendLimit.mockResolvedValue({ allowed: false, remaining: 0 });

    await expect(deliverSequenceStep1ViaChat({
      adapter: { startChat } as never,
      campaignLeadId: "campaign-lead-1",
      orgId: "org-1",
      campaignId: "campaign-1",
      leadId: "lead-1",
      attendeeProviderId: "linkedin-lead-1",
      unipileAccountId: "account-1",
      sequence: [
        { type: "linkedin_invite", message: "Connect?", delayHours: 0 },
        { type: "linkedin_message", message: "Thanks for connecting.", delayHours: 0 },
      ],
      existingChatId: null,
    })).resolves.toEqual({ skipped: true, reason: "daily send limit reached for this sender" });

    expect(startChat).not.toHaveBeenCalled();
    expect(queueAdd).toHaveBeenCalledWith(
      "campaign-sequence",
      { campaignLeadId: "campaign-lead-1", orgId: "org-1", step: 0 },
      expect.objectContaining({ delay: 60_000 }),
    );
  });
});
