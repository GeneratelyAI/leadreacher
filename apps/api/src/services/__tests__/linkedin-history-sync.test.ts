import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UnipileAdapter } from "../../adapters/unipile.js";

const { messageFindMany, messageCreateMany, messageUpdateMany, leadUpdate, campaignLeadUpdate, transaction } = vi.hoisted(() => ({
  messageFindMany: vi.fn(),
  messageCreateMany: vi.fn(),
  messageUpdateMany: vi.fn(),
  leadUpdate: vi.fn(),
  campaignLeadUpdate: vi.fn(),
  transaction: vi.fn(async (operations: Promise<unknown>[]) => Promise.all(operations)),
}));

vi.mock("../../lib/prisma.js", () => ({
  prisma: {
    message: { findMany: messageFindMany, createMany: messageCreateMany, updateMany: messageUpdateMany },
    lead: { update: leadUpdate },
    campaignLead: { update: campaignLeadUpdate },
    $transaction: transaction,
  },
}));

import { syncLinkedInHistory } from "../linkedin-history-sync.js";

beforeEach(() => {
  messageFindMany.mockReset().mockResolvedValue([]);
  messageCreateMany.mockReset().mockResolvedValue({ count: 2 });
  messageUpdateMany.mockReset().mockResolvedValue({ count: 1 });
  leadUpdate.mockReset().mockResolvedValue({});
  campaignLeadUpdate.mockReset().mockResolvedValue({});
  transaction.mockClear();
});

describe("syncLinkedInHistory", () => {
  it("imports prior provider history and marks inbound replies", async () => {
    const listChatMessages = vi.fn().mockResolvedValue({
      data: [
        {
          id: "old-outbound",
          chat_id: "chat-1",
          timestamp: "2026-08-05T10:00:00.000Z",
          is_sender: true,
          text: "Earlier message",
        },
        {
          id: "new-inbound",
          chat_id: "chat-1",
          timestamp: "2026-09-02T10:00:00.000Z",
          is_sender: false,
          text: "Interested",
        },
      ],
    });

    await expect(syncLinkedInHistory(
      { listChatMessages } as unknown as UnipileAdapter,
      {
        orgId: "org-1",
        campaignId: "campaign-1",
        campaignLeadId: "campaign-lead-1",
        leadId: "lead-1",
        campaignLeadCreatedAt: new Date("2026-09-01T00:00:00.000Z"),
        accountId: "account-1",
        chatId: "chat-1",
        stepIndex: 1,
      },
    )).resolves.toEqual({ imported: 2, hasInbound: true });

    expect(messageCreateMany).toHaveBeenCalledWith(expect.objectContaining({
      skipDuplicates: true,
      data: expect.arrayContaining([
        expect.objectContaining({
          id: "provider:old-outbound",
          direction: "outbound",
          content: expect.objectContaining({ providerHistory: true }),
        }),
        expect.objectContaining({
          id: "inbound:new-inbound",
          direction: "inbound",
          content: expect.objectContaining({ providerHistory: false }),
        }),
      ]),
    }));
    expect(campaignLeadUpdate).toHaveBeenCalledWith({
      where: { id: "campaign-lead-1" },
      data: { status: "replied" },
    });
  });

  it("does not duplicate a locally recorded outbound send", async () => {
    messageFindMany.mockResolvedValue([{ content: { message: "Hello" }, sentAt: new Date("2026-09-02T10:00:00.000Z"), createdAt: new Date("2026-09-02T10:00:00.000Z") }]);
    const listChatMessages = vi.fn().mockResolvedValue({ data: [{
      id: "provider-outbound",
      chat_id: "chat-1",
      timestamp: "2026-09-02T10:00:30.000Z",
      is_sender: true,
      text: "Hello",
    }] });

    await syncLinkedInHistory(
      { listChatMessages } as unknown as UnipileAdapter,
      {
        orgId: "org-1",
        campaignId: "campaign-1",
        campaignLeadId: "campaign-lead-1",
        leadId: "lead-1",
        campaignLeadCreatedAt: new Date("2026-09-01T00:00:00.000Z"),
        accountId: "account-1",
        chatId: "chat-1",
        stepIndex: 1,
      },
    );

    expect(messageCreateMany).not.toHaveBeenCalled();
  });

  it("preserves video attachments from provider history", async () => {
    const listChatMessages = vi.fn().mockResolvedValue({ data: [{
      id: "video-message",
      chat_id: "chat-1",
      timestamp: "2026-08-11T10:00:00.000Z",
      is_sender: true,
      text: "Watch this",
      attachments: [{ id: "video-1", type: "video", mimetype: "video/mp4" }],
    }] });

    await syncLinkedInHistory(
      { listChatMessages } as unknown as UnipileAdapter,
      {
        orgId: "org-1",
        campaignId: "campaign-1",
        campaignLeadId: "campaign-lead-1",
        leadId: "lead-1",
        campaignLeadCreatedAt: new Date("2026-09-01T00:00:00.000Z"),
        accountId: "account-1",
        chatId: "chat-1",
        stepIndex: 1,
      },
    );

    expect(messageCreateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: [expect.objectContaining({
        content: expect.objectContaining({
          attachments: [{
            type: "video",
            providerMessageId: "video-message",
            providerAttachmentId: "video-1",
          }],
        }),
      })],
    }));
    expect(messageUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "provider:video-message", orgId: "org-1" },
    }));
  });
});
