import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  findMany,
  updateMany,
  auditCreate,
  transaction,
  messageFindFirst,
  messageCreate,
  campaignLeadFindUnique,
  campaignLeadUpdate,
  getChat,
  getMessage,
  queueGetJob,
  queueAdd,
} = vi.hoisted(
  () => ({
    findMany: vi.fn(),
    updateMany: vi.fn(),
    auditCreate: vi.fn(),
    transaction: vi.fn(),
    messageFindFirst: vi.fn(),
    messageCreate: vi.fn(),
    campaignLeadFindUnique: vi.fn(),
    campaignLeadUpdate: vi.fn(),
    getChat: vi.fn(),
    getMessage: vi.fn(),
    queueGetJob: vi.fn(),
    queueAdd: vi.fn(),
  }),
);

vi.mock("../../lib/prisma.js", () => ({
  prisma: {
    deliveryAttempt: { findMany, updateMany },
    auditLog: { create: auditCreate },
    $transaction: transaction,
  },
}));
vi.mock("../../config/env.js", () => ({
  env: { UNIPILE_DSN: "dsn", UNIPILE_API_KEY: "key" },
}));
vi.mock("../../lib/queue.js", () => ({
  QUEUE_CAMPAIGN_SEQUENCE: "campaign-sequence",
  campaignSequenceJobId: (campaignLeadId: string, step: number) =>
    `${campaignLeadId}-step-${step}`,
  campaignSequenceQueue: {
    getJob: queueGetJob,
    add: queueAdd,
  },
}));
vi.mock("../../adapters/unipile.js", () => ({
  UnipileAdapter: class {
    getChat = getChat;
    getMessage = getMessage;
  },
}));

import {
  isConfirmedUnipileChat,
  isConfirmedUnipileMessage,
  reconcileDeliveryAttempts,
} from "../reconcile-delivery-attempts.js";

function unknownAttempt(stepIndex: number, providerRef: string) {
  return {
    id: `attempt-${stepIndex}`,
    campaignLeadId: "campaign-lead-1",
    stepIndex,
    state: "unknown",
    providerRef,
    updatedAt: new Date("2026-07-12T10:00:00.000Z"),
    campaignLead: {
      campaignId: "campaign-1",
      leadId: "lead-1",
      currentStep: stepIndex,
      linkedinChatId: null,
      campaign: {
        orgId: "org-1",
        sequence: [
          { type: "linkedin_invite", message: "Invite", delayHours: 0 },
          { type: "linkedin_message", message: "Hello", delayHours: 0 },
          { type: "linkedin_message", message: "Follow up", delayHours: 24 },
        ],
      },
    },
  };
}

beforeEach(() => {
  findMany.mockReset();
  updateMany.mockReset();
  auditCreate.mockReset();
  transaction.mockReset();
  messageFindFirst.mockReset();
  messageCreate.mockReset();
  campaignLeadFindUnique.mockReset();
  campaignLeadUpdate.mockReset();
  getChat.mockReset();
  getMessage.mockReset();
  queueGetJob.mockReset();
  queueAdd.mockReset();
  updateMany.mockResolvedValue({ count: 1 });
  auditCreate.mockResolvedValue({});
  messageFindFirst.mockResolvedValue(null);
  messageCreate.mockResolvedValue({});
  campaignLeadFindUnique.mockResolvedValue({
    currentStep: 1,
    linkedinChatId: null,
  });
  campaignLeadUpdate.mockResolvedValue({});
  queueGetJob.mockResolvedValue(null);
  queueAdd.mockResolvedValue({});
  transaction.mockImplementation(async (callback) =>
    callback({
      deliveryAttempt: { updateMany },
      message: { findFirst: messageFindFirst, create: messageCreate },
      campaignLead: {
        findUnique: campaignLeadFindUnique,
        update: campaignLeadUpdate,
      },
    }),
  );
});

describe("Unipile delivery confirmation", () => {
  it("requires an exact chat ID match", () => {
    expect(isConfirmedUnipileChat({ id: "chat-1" }, "chat-1")).toBe(true);
    expect(isConfirmedUnipileChat({ id: "other-chat" }, "chat-1")).toBe(false);
  });

  it("requires an exact message ID match", () => {
    expect(isConfirmedUnipileMessage({ id: "message-1" }, "message-1")).toBe(
      true,
    );
    expect(
      isConfirmedUnipileMessage({ message_id: "message-1" }, "message-1"),
    ).toBe(true);
    expect(isConfirmedUnipileMessage({ id: "other-message" }, "message-1")).toBe(
      false,
    );
  });
});

describe("reconcileDeliveryAttempts", () => {
  it("marks an unknown step-one attempt sent only after Unipile returns its chat", async () => {
    findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([unknownAttempt(1, "chat-1")]);
    getChat.mockResolvedValue({ id: "chat-1" });

    await expect(reconcileDeliveryAttempts()).resolves.toEqual({
      markedUnknown: 0,
      confirmedSent: 1,
    });

    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "attempt-1", state: "unknown" },
        data: expect.objectContaining({ state: "recovering" }),
      }),
    );
    expect(messageCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          campaignId: "campaign-1",
          leadId: "lead-1",
          stepIndex: 1,
          externalId: "chat-1",
        }),
      }),
    );
    expect(campaignLeadUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "campaign-lead-1" },
        data: expect.objectContaining({
          currentStep: 2,
          linkedinChatId: "chat-1",
        }),
      }),
    );
    expect(queueAdd).toHaveBeenCalledWith(
      "campaign-sequence",
      { campaignLeadId: "campaign-lead-1", orgId: "org-1", step: 2 },
      expect.objectContaining({ jobId: "campaign-lead-1-step-2" }),
    );
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "attempt-1", state: "recovering" },
        data: expect.objectContaining({ state: "sent" }),
      }),
    );
    expect(auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "campaign.delivery.recovered" }),
      }),
    );
  });

  it("leaves an inconclusive lookup unknown", async () => {
    findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([unknownAttempt(2, "message-1")]);
    getMessage.mockResolvedValue({ id: "message-not-found" });

    await expect(reconcileDeliveryAttempts()).resolves.toEqual({
      markedUnknown: 0,
      confirmedSent: 0,
    });

    expect(updateMany).not.toHaveBeenCalled();
    expect(auditCreate).not.toHaveBeenCalled();
  });

  it("does not claim an invitation is sent without a provider confirmation endpoint", async () => {
    findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([unknownAttempt(0, "recipient-provider-id")]);

    await expect(reconcileDeliveryAttempts()).resolves.toEqual({
      markedUnknown: 0,
      confirmedSent: 0,
    });

    expect(getChat).not.toHaveBeenCalled();
    expect(getMessage).not.toHaveBeenCalled();
    expect(updateMany).not.toHaveBeenCalled();
  });
});
