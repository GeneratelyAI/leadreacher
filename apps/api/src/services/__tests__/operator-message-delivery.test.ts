import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UnipileAdapter } from "../../adapters/unipile.js";

const {
  messageCreate,
  messageFindFirst,
  messageUpdate,
  messageUpdateMany,
  manualDeliveryAttemptCreate,
  manualDeliveryAttemptUpdate,
  auditLogCreate,
  transaction,
} = vi.hoisted(() => ({
  messageCreate: vi.fn(),
  messageFindFirst: vi.fn(),
  messageUpdate: vi.fn(),
  messageUpdateMany: vi.fn(),
  manualDeliveryAttemptCreate: vi.fn(),
  manualDeliveryAttemptUpdate: vi.fn(),
  auditLogCreate: vi.fn(),
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
  },
}));

import { deliverOperatorMessage } from "../operator-message-delivery.js";

const input = {
  orgId: "org-1",
  campaignId: "campaign-1",
  campaignLeadId: "campaign-lead-1",
  leadId: "lead-1",
  chatId: "chat-1",
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
});

describe("deliverOperatorMessage", () => {
  it("uses one message and one provider send for two concurrent calls with the same key", async () => {
    let created = false;
    messageCreate.mockImplementation(async () => {
      if (created) throw { code: "P2002" };
      created = true;
      return { id: "operator-message-1" };
    });
    messageFindFirst.mockResolvedValue({ id: "operator-message-1" });
    const sendMessageToChat = vi.fn().mockResolvedValue({ message_id: "provider-message-1" });
    const adapter = { sendMessageToChat } as unknown as UnipileAdapter;

    const [first, second] = await Promise.all([
      deliverOperatorMessage(adapter, input),
      deliverOperatorMessage(adapter, input),
    ]);

    expect(first).toEqual({ messageId: "operator-message-1" });
    expect(second).toEqual({ messageId: "operator-message-1" });
    expect(messageCreate).toHaveBeenCalledTimes(2);
    expect(manualDeliveryAttemptCreate).toHaveBeenCalledTimes(1);
    expect(sendMessageToChat).toHaveBeenCalledTimes(1);
    expect(messageCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ idempotencyKey: input.idempotencyKey }),
    }));
  });
});
