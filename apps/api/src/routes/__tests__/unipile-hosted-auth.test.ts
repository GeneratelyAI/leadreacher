import Fastify from "fastify";
import { applyZodCompilers } from "../../lib/zod-compilers.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { socialAccountUpsert } = vi.hoisted(() => ({
  socialAccountUpsert: vi.fn(),
}));

vi.mock("../../config/env.js", () => ({
  env: {
    UNIPILE_DSN: "api.example.test:13111",
    UNIPILE_API_KEY: "unipile-key",
    UNIPILE_WEBHOOK_SECRET: "hosted-auth-test-secret",
  },
}));
vi.mock("../../lib/prisma.js", () => ({
  prisma: {
    socialAccount: { upsert: socialAccountUpsert },
    message: { findFirst: vi.fn() },
  },
}));
vi.mock("../../lib/queue.js", () => ({
  QUEUE_CAMPAIGN_SEQUENCE: "campaign-sequence",
  campaignSequenceJobId: vi.fn(),
  campaignSequenceQueue: { remove: vi.fn() },
}));
vi.mock("../../services/campaign-step1-chat.js", () => ({
  deliverSequenceStep1ViaChat: vi.fn(),
}));

import {
  decodeHostedAuthName,
  encodeHostedAuthName,
  UnipileAdapter,
} from "../../adapters/unipile.js";
import { webhookRoutes } from "../webhooks.js";

async function buildTestApp() {
  const app = Fastify();
  applyZodCompilers(app);
  await app.register(webhookRoutes);
  return app;
}

let app: Awaited<ReturnType<typeof buildTestApp>>;

beforeEach(async () => {
  socialAccountUpsert.mockReset();
  vi.spyOn(UnipileAdapter.prototype, "getAccountStatus").mockResolvedValue({
    id: "unipile-account-1",
    type: "LINKEDIN",
    name: "Ada Lovelace",
    sources: [{ id: "source-1", status: "OK" }],
  });
  app = await buildTestApp();
});

afterEach(async () => {
  vi.restoreAllMocks();
  await app.close();
});

describe("Unipile hosted-auth account callback", () => {
  it("round-trips an org-bound signed hosted-auth name", () => {
    const name = encodeHostedAuthName("org-1");

    expect(decodeHostedAuthName(name)).toBe("org-1");
    expect(decodeHostedAuthName(`${name}tampered`)).toBeNull();
  });

  it("associates a created hosted-auth account with the encoded organization", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/webhooks/unipile",
      payload: {
        status: "CREATION_SUCCESS",
        account_id: "unipile-account-1",
        name: encodeHostedAuthName("org-1"),
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ received: true, handled: true });
    expect(socialAccountUpsert).toHaveBeenCalledWith({
      where: {
        orgId_platform_platformUserId: {
          orgId: "org-1",
          platform: "linkedin",
          platformUserId: "unipile-account-1",
        },
      },
      create: {
        orgId: "org-1",
        platform: "linkedin",
        platformUserId: "unipile-account-1",
        unipileId: "unipile-account-1",
        accountName: "Ada Lovelace",
        status: "active",
        metadata: { providerType: "linkedin" },
      },
      update: {
        unipileId: "unipile-account-1",
        accountName: "Ada Lovelace",
        status: "active",
        metadata: { providerType: "linkedin" },
      },
    });
  });
});
