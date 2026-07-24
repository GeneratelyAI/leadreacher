import Fastify from "fastify";
import { applyZodCompilers } from "../../lib/zod-compilers.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  messageFindFirst,
  socialAccountFindFirst,
  campaignLeadFindFirst,
  leadUpdate,
  campaignLeadUpdate,
  remove,
  campaignSequenceJobId,
  recordInboundMessage,
} = vi.hoisted(() => ({
  messageFindFirst: vi.fn(),
  socialAccountFindFirst: vi.fn(),
  campaignLeadFindFirst: vi.fn(),
  leadUpdate: vi.fn(),
  campaignLeadUpdate: vi.fn(),
  remove: vi.fn(),
  campaignSequenceJobId: vi.fn((campaignLeadId: string, step: number) => `${campaignLeadId}:step:${step}`),
  recordInboundMessage: vi.fn(),
}));

vi.mock("../../config/env.js", () => ({
  env: {
    UNIPILE_DSN: "dsn",
    UNIPILE_API_KEY: "key",
    UNIPILE_WEBHOOK_SECRET: "webhook-secret",
  },
}));
vi.mock("../../lib/prisma.js", () => ({
  prisma: {
    message: { findFirst: messageFindFirst },
    socialAccount: { findFirst: socialAccountFindFirst },
    campaignLead: { findFirst: campaignLeadFindFirst, update: campaignLeadUpdate },
    lead: { update: leadUpdate },
  },
}));
vi.mock("../../lib/queue.js", () => ({
  QUEUE_CAMPAIGN_SEQUENCE: "campaign-sequence",
  campaignSequenceJobId,
  campaignSequenceQueue: { remove },
}));
vi.mock("../../lib/inbound-message.js", () => ({ recordInboundMessage }));
vi.mock("../../services/campaign-step1-chat.js", () => ({
  deliverSequenceStep1ViaChat: vi.fn(),
}));

import { webhookRoutes } from "../webhooks.js";

const payload = {
  event: "message_received",
  account_id: "account-1",
  account_type: "LINKEDIN",
  message_id: "message-1",
  chat_id: "chat-1",
  message: "Please stop contacting me.",
  account_info: { user_id: "account-owner" },
  sender: {
    attendee_id: "attendee-1",
    attendee_name: "Prospect",
    attendee_provider_id: "prospect-provider",
  },
  timestamp: "2026-07-17T12:00:00.000Z",
};

const sequence = [
  { type: "linkedin_invite", message: "Connect?", delayHours: 0 },
  { type: "linkedin_message", message: "First message", delayHours: 0 },
  { type: "linkedin_message", message: "Follow up", delayHours: 24 },
  { type: "linkedin_message", message: "Final follow up", delayHours: 72 },
];

async function buildTestApp() {
  const app = Fastify();
  applyZodCompilers(app);
  await app.register(webhookRoutes);
  return app;
}

let app: Awaited<ReturnType<typeof buildTestApp>>;

beforeEach(async () => {
  messageFindFirst.mockReset().mockResolvedValue(null);
  socialAccountFindFirst.mockReset().mockResolvedValue({ orgId: "org-1" });
  campaignLeadFindFirst.mockReset().mockResolvedValue({
    id: "campaign-lead-1",
    campaignId: "campaign-1",
    leadId: "lead-1",
    currentStep: 2,
    campaign: { sequence },
  });
  leadUpdate.mockReset().mockResolvedValue({});
  campaignLeadUpdate.mockReset().mockResolvedValue({});
  remove.mockReset().mockResolvedValue(undefined);
  campaignSequenceJobId.mockClear();
  recordInboundMessage.mockReset().mockResolvedValue({});
  app = await buildTestApp();
});

afterEach(async () => {
  await app.close();
});

describe("POST /webhooks/unipile message_received", () => {
  it("does not mark a lead replied or cancel jobs for an outbound event", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/webhooks/unipile",
      headers: { "unipile-auth": "webhook-secret" },
      payload: {
        ...payload,
        sender: { ...payload.sender, attendee_provider_id: "account-owner" },
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ received: true });
    expect(socialAccountFindFirst).not.toHaveBeenCalled();
    expect(leadUpdate).not.toHaveBeenCalled();
    expect(campaignLeadUpdate).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
    expect(recordInboundMessage).not.toHaveBeenCalled();
  });

  it("marks inbound replies and removes only queued step-two-and-later jobs", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/webhooks/unipile",
      headers: { "unipile-auth": "webhook-secret" },
      payload,
    });

    expect(response.statusCode).toBe(200);
    expect(leadUpdate).toHaveBeenCalledWith({
      where: { id: "lead-1" },
      data: { status: "replied" },
    });
    expect(campaignLeadUpdate).toHaveBeenCalledWith({
      where: { id: "campaign-lead-1" },
      data: { status: "replied" },
    });
    expect(campaignSequenceJobId).toHaveBeenCalledTimes(2);
    expect(campaignSequenceJobId).toHaveBeenNthCalledWith(1, "campaign-lead-1", 2);
    expect(campaignSequenceJobId).toHaveBeenNthCalledWith(2, "campaign-lead-1", 3);
    expect(remove).toHaveBeenCalledWith("campaign-lead-1:step:2");
    expect(remove).toHaveBeenCalledWith("campaign-lead-1:step:3");
    expect(recordInboundMessage).toHaveBeenCalledWith(expect.objectContaining({
      campaignId: "campaign-1",
      leadId: "lead-1",
      orgId: "org-1",
      externalId: "message-1",
      stepIndex: 2,
    }));
  });
});
