import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UnipileAdapter } from "../../adapters/unipile.js";
import { UnipileRequestError } from "../../adapters/unipile.js";

const {
  messageCreate,
  messageFindFirst,
  messageUpdate,
  messageUpdateMany,
  manualDeliveryAttemptCreate,
  manualDeliveryAttemptUpdate,
  auditLogCreate,
  campaignLeadFindUnique,
  campaignLeadUpdate,
  transaction,
} = vi.hoisted(() => ({
  messageCreate: vi.fn(),
  messageFindFirst: vi.fn(),
  messageUpdate: vi.fn(),
  messageUpdateMany: vi.fn(),
  manualDeliveryAttemptCreate: vi.fn(),
  manualDeliveryAttemptUpdate: vi.fn(),
  auditLogCreate: vi.fn(),
  campaignLeadFindUnique: vi.fn(),
  campaignLeadUpdate: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("../../lib/prisma.js", () => ({
  prisma: {
    $transaction: transaction,
    message: {
      findFirst: messageFindFirst,
      update: messageUpdate,
      updateMany: messageUpdateMany,
    },
    manualDeliveryAttempt: { update: manualDeliveryAttemptUpdate },
    auditLog: { create: auditLogCreate },
    campaignLead: { findUnique: campaignLeadFindUnique, update: campaignLeadUpdate },
  },
}));

import {
  classifyOperatorDeliveryFailure,
  deliverOperatorMessage,
  resolveExistingOperatorDelivery,
  startOperatorLinkedInConversation,
} from "../operator-message-delivery.js";

const input = {
  orgId: "org-1",
  campaignId: "campaign-1",
  campaignLeadId: "campaign-lead-1",
    leadId: "lead-1",
    channel: "linkedin",
    chatId: "chat-1",
    senderAccountId: "account-1",
  message: "Thanks for your note. Would next week work?",
  idempotencyKey: "8fe2f68c-c707-44c5-95b3-d8fe08de7517",
};

beforeEach(() => {
  const tx = {
    message: { create: messageCreate },
    manualDeliveryAttempt: { create: manualDeliveryAttemptCreate },
  };
  transaction.mockReset().mockImplementation(async (operation) => {
    if (typeof operation === "function") return operation(tx);
    return Promise.all(operation);
  });
  messageCreate.mockReset();
  messageFindFirst.mockReset();
  messageUpdate.mockReset().mockResolvedValue({});
  messageUpdateMany.mockReset().mockResolvedValue({ count: 1 });
  manualDeliveryAttemptCreate.mockReset().mockResolvedValue({});
  manualDeliveryAttemptUpdate.mockReset().mockResolvedValue({});
  auditLogCreate.mockReset().mockResolvedValue({});
  campaignLeadFindUnique.mockReset().mockResolvedValue({ providerChatId: "chat-1", linkedinChatId: "chat-1" });
  campaignLeadUpdate.mockReset().mockResolvedValue({});
});

describe("startOperatorLinkedInConversation", () => {
  it("creates the provider chat and persists it on the campaign membership", async () => {
    messageCreate.mockResolvedValue({ id: "operator-message-1" });
    const startLinkedInChat = vi.fn().mockResolvedValue({ chat_id: "chat-1" });
    const adapter = { startLinkedInChat } as unknown as UnipileAdapter;

    const result = await startOperatorLinkedInConversation(adapter, {
      orgId: "org-1",
      campaignId: "campaign-1",
      campaignLeadId: "campaign-lead-1",
      leadId: "lead-1",
      senderAccountId: "account-1",
      recipientProviderId: "provider-lead-1",
      message: "Hi Clara, would you be open to a quick conversation?",
      idempotencyKey: "8fe2f68c-c707-44c5-95b3-d8fe08de7517",
    });

    expect(result).toEqual({ messageId: "operator-message-1", chatId: "chat-1" });
    expect(startLinkedInChat).toHaveBeenCalledWith(
      "account-1",
      "provider-lead-1",
      "Hi Clara, would you be open to a quick conversation?",
    );
    expect(campaignLeadUpdate).toHaveBeenCalledWith({
      where: { id: "campaign-lead-1" },
      data: { linkedinChatId: "chat-1", providerChatId: "chat-1" },
    });
  });

  it("marks a definitive provider rejection as failed so it can be retried safely", async () => {
    messageCreate.mockResolvedValue({ id: "operator-message-1" });
    const startLinkedInChat = vi.fn().mockRejectedValue(
      new UnipileRequestError(400, "Unsupported inbox", "req-test"),
    );
    const adapter = { startLinkedInChat } as unknown as UnipileAdapter;

    await expect(startOperatorLinkedInConversation(adapter, {
      orgId: "org-1",
      campaignId: "campaign-1",
      campaignLeadId: "campaign-lead-1",
      leadId: "lead-1",
      senderAccountId: "account-1",
      recipientProviderId: "provider-lead-1",
      message: "Hello",
      idempotencyKey: "8fe2f68c-c707-44c5-95b3-d8fe08de7517",
    })).rejects.toThrow("Unsupported inbox");

    expect(manualDeliveryAttemptUpdate).toHaveBeenCalledWith({
      where: { messageId: "operator-message-1" },
      data: { state: "failed" },
    });
    expect(auditLogCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        action: "message.operator_start_failed",
        metadata: expect.objectContaining({
          upstreamStatus: 400,
          providerRequestId: "req-test",
        }),
      }),
    }));
  });
});

describe("deliverOperatorMessage", () => {
  it("persists a retryable rate-limit failure without losing its provider diagnostic", async () => {
    messageCreate.mockResolvedValue({ id: "operator-message-1" });
    const sendMessageToChat = vi.fn().mockRejectedValue(
      new UnipileRequestError(429, "Rate limited", "req-rate-limit"),
    );
    const adapter = { sendMessageToChat } as unknown as UnipileAdapter;

    await expect(deliverOperatorMessage(adapter, input)).rejects.toThrow("Rate limited");
    expect(manualDeliveryAttemptUpdate).toHaveBeenCalledWith({
      where: { messageId: "operator-message-1" },
      data: { state: "failed" },
    });
    expect(auditLogCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        action: "message.operator_send_failed",
        metadata: expect.objectContaining({
          failureCategory: "rate_limited",
          retryable: true,
          upstreamStatus: 429,
          providerRequestId: "req-rate-limit",
        }),
      }),
    }));
  });

  it("uses one message and one provider send for two concurrent calls with the same key", async () => {
    let created = false;
    messageCreate.mockImplementation(async () => {
      if (created) throw { code: "P2002" };
      created = true;
      return { id: "operator-message-1" };
    });
    messageFindFirst.mockResolvedValue({
      id: "operator-message-1",
      status: "queued",
      manualDeliveryAttempt: { state: "reserved" },
    });
    const sendMessageToChat = vi.fn().mockResolvedValue({ message_id: "provider-message-1" });
    const adapter = { sendMessageToChat } as unknown as UnipileAdapter;

    const [first, second] = await Promise.allSettled([
      deliverOperatorMessage(adapter, input),
      deliverOperatorMessage(adapter, input),
    ]);

    expect([first, second].filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect([first, second].filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(messageCreate).toHaveBeenCalledTimes(2);
    expect(manualDeliveryAttemptCreate).toHaveBeenCalledTimes(1);
    expect(sendMessageToChat).toHaveBeenCalledTimes(1);
    expect(messageCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ idempotencyKey: input.idempotencyKey }),
    }));
  });

  it("only treats a provider-confirmed delivery as a successful duplicate", () => {
    expect(resolveExistingOperatorDelivery({
      id: "operator-message-1",
      status: "sent",
      manualDeliveryAttempt: { state: "sent" },
    })).toEqual({ messageId: "operator-message-1" });
    expect(() => resolveExistingOperatorDelivery({
      id: "operator-message-2",
      status: "skipped",
      manualDeliveryAttempt: { state: "unknown" },
    })).toThrow("Delivery could not be confirmed");
  });
});

describe("classifyOperatorDeliveryFailure", () => {
  it("keeps uncertain server failures blocked from blind retries", () => {
    expect(classifyOperatorDeliveryFailure(
      new UnipileRequestError(503, "Unavailable"),
    )).toEqual(expect.objectContaining({
      state: "unknown",
      category: "provider_unavailable",
      retryable: true,
    }));
  });
});
