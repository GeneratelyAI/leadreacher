import Fastify from "fastify";
import crypto from "node:crypto";
import fastifyRawBody from "fastify-raw-body";
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
  invalidateDashboardChrome,
} = vi.hoisted(() => ({
  messageFindFirst: vi.fn(),
  socialAccountFindFirst: vi.fn(),
  campaignLeadFindFirst: vi.fn(),
  leadUpdate: vi.fn(),
  campaignLeadUpdate: vi.fn(),
  remove: vi.fn(),
  campaignSequenceJobId: vi.fn((campaignLeadId: string, step: number) => `${campaignLeadId}:step:${step}`),
  recordInboundMessage: vi.fn(),
  invalidateDashboardChrome: vi.fn(),
}));

vi.mock("../../config/env.js", () => ({
  env: {
    REDIS_URL: "redis://localhost:6379",
    REDIS_PASSWORD: "",
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
vi.mock("../../lib/dashboard-cache.js", () => ({ invalidateDashboardChrome }));
vi.mock("../../services/campaign-step1-chat.js", () => ({
  deliverSequenceStep1ViaChat: vi.fn(),
}));

import { webhookRoutes } from "../webhooks.js";

const payload = {
  id: "event-1",
  created_at: "2026-07-17T12:00:01.000Z",
  account_id: "account-1",
  account_provider: "linkedin",
  account_name: "Sender",
  application_id: "app_123",
  application_production: true,
  type: "message.new",
  payload: {
    id: "message-1",
    sender_id: "prospect-provider",
    chat_id: "chat-1",
    text: "Interested in learning more.",
    timestamp: "2026-07-17T12:00:00.000Z",
    is_sender: false,
  },
};

function signedRequestBody(value: unknown) {
  const body = JSON.stringify(value);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = crypto
    .createHmac("sha256", "webhook-secret")
    .update(`${timestamp}.${body}`)
    .digest("hex");
  return {
    body,
    headers: {
      "content-type": "application/json",
      "unipile-signature": `t=${timestamp},v0=${signature}`,
    },
  };
}

const sequence = [
  { type: "linkedin_invite", message: "Connect?", delayHours: 0 },
  { type: "linkedin_message", message: "First message", delayHours: 0 },
  { type: "linkedin_message", message: "Follow up", delayHours: 24 },
  { type: "linkedin_message", message: "Final follow up", delayHours: 72 },
];

async function buildTestApp() {
  const app = Fastify();
  applyZodCompilers(app);
  await app.register(fastifyRawBody, {
    field: "rawBody",
    global: false,
    encoding: false,
    runFirst: true,
  });
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
  invalidateDashboardChrome.mockReset().mockResolvedValue(undefined);
  app = await buildTestApp();
});

afterEach(async () => {
  await app.close();
});

describe("POST /webhooks/unipile message.new", () => {
  it("does not mark a lead replied or cancel jobs for an outbound event", async () => {
    const request = signedRequestBody({
      ...payload,
      payload: { ...payload.payload, is_sender: true },
    });
    const response = await app.inject({
      method: "POST",
      url: "/webhooks/unipile",
      headers: request.headers,
      payload: request.body,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ received: true });
    expect(socialAccountFindFirst).not.toHaveBeenCalled();
    expect(leadUpdate).not.toHaveBeenCalled();
    expect(campaignLeadUpdate).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
    expect(recordInboundMessage).not.toHaveBeenCalled();
  });

  it("marks inbound replies and removes all queued sequence jobs", async () => {
    const request = signedRequestBody(payload);
    const response = await app.inject({
      method: "POST",
      url: "/webhooks/unipile",
      headers: request.headers,
      payload: request.body,
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
    expect(campaignSequenceJobId).toHaveBeenCalledTimes(4);
    expect(campaignSequenceJobId).toHaveBeenNthCalledWith(1, "campaign-lead-1", 0);
    expect(campaignSequenceJobId).toHaveBeenNthCalledWith(2, "campaign-lead-1", 1);
    expect(campaignSequenceJobId).toHaveBeenNthCalledWith(3, "campaign-lead-1", 2);
    expect(campaignSequenceJobId).toHaveBeenNthCalledWith(4, "campaign-lead-1", 3);
    expect(remove).toHaveBeenCalledWith("campaign-lead-1:step:0");
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
