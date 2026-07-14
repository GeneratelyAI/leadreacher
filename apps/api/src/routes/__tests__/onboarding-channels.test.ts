import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../../lib/errors.js";

const {
  socialAccountFindMany,
  socialAccountCount,
  organizationFindUnique,
  organizationUpdate,
} = vi.hoisted(() => ({
  socialAccountFindMany: vi.fn(),
  socialAccountCount: vi.fn(),
  organizationFindUnique: vi.fn(),
  organizationUpdate: vi.fn(),
}));
const { createHostedAuthLink } = vi.hoisted(() => ({
  createHostedAuthLink: vi.fn(),
}));

vi.mock("../../config/env.js", () => ({
  env: {
    UNIPILE_DSN: "api.example.test:13111",
    UNIPILE_API_KEY: "unipile-key",
    UNIPILE_WEBHOOK_SECRET: "webhook-secret",
    UNIPILE_WEBHOOK_URL: "https://api.example.test/webhooks/unipile",
    APP_URL: "http://localhost:3000",
  },
}));
vi.mock("../../lib/prisma.js", () => ({
  prisma: {
    socialAccount: {
      findMany: socialAccountFindMany,
      count: socialAccountCount,
    },
    organization: {
      findUnique: organizationFindUnique,
      update: organizationUpdate,
    },
  },
}));
vi.mock("../../adapters/unipile.js", () => ({
  UnipileAdapter: class {
    createHostedAuthLink = createHostedAuthLink;
  },
  isAccountHealthy: vi.fn(),
  encodeHostedAuthName: (orgId: string) => `lr:${orgId}:signed`,
}));

import { onboardingRoutes } from "../onboarding.js";
import { socialAccountRoutes } from "../social-accounts.js";

async function buildTestApp() {
  const app = Fastify();
  app.addHook("preHandler", async (request) => {
    request.orgId = "org-1";
  });
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof AppError) {
      return reply
        .status(error.statusCode)
        .send({ code: error.code, message: error.message });
    }
    throw error;
  });
  await app.register(socialAccountRoutes);
  await app.register(onboardingRoutes);
  return app;
}

let app: Awaited<ReturnType<typeof buildTestApp>>;

beforeEach(async () => {
  socialAccountFindMany.mockReset();
  socialAccountCount.mockReset();
  organizationFindUnique.mockReset();
  organizationUpdate.mockReset();
  createHostedAuthLink.mockReset();

  socialAccountFindMany.mockResolvedValue([
    {
      platform: "linkedin",
      accountName: "Ada Lovelace",
      avatarUrl: "https://example.test/avatar.png",
      status: "active",
    },
  ]);
  socialAccountCount.mockResolvedValue(1);
  organizationFindUnique.mockResolvedValue({
    id: "org-1",
    subscriptionStatus: "active",
  });
  organizationUpdate.mockResolvedValue({
    id: "org-1",
    onboardedAt: new Date("2026-07-13T00:00:00.000Z"),
  });
  createHostedAuthLink.mockResolvedValue({
    url: "https://account.unipile.com/hosted-auth-link",
  });
  app = await buildTestApp();
});

afterEach(async () => {
  await app.close();
});

describe("channel connection and onboarding completion", () => {
  it("lists connected channels and creates a hosted-auth link bound to the organization", async () => {
    const list = await app.inject({ method: "GET", url: "/social-accounts" });
    const connect = await app.inject({
      method: "POST",
      url: "/social-accounts/connect",
      payload: {},
    });

    expect(list.statusCode).toBe(200);
    expect(list.json()).toEqual({
      accounts: [
        {
          platform: "linkedin",
          accountName: "Ada Lovelace",
          avatarUrl: "https://example.test/avatar.png",
          status: "active",
        },
      ],
    });
    expect(connect.statusCode).toBe(200);
    expect(connect.json()).toEqual({
      url: "https://account.unipile.com/hosted-auth-link",
    });
    expect(createHostedAuthLink).toHaveBeenCalledWith(
      expect.objectContaining({
        providers: ["LINKEDIN"],
        name: "lr:org-1:signed",
        notifyUrl: "https://api.example.test/webhooks/unipile",
      }),
    );
  });

  it("marks onboarding complete only for an active subscription with a connected channel", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/onboarding/complete",
      payload: {},
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ completed: true });
    expect(organizationUpdate).toHaveBeenCalledWith({
      where: { id: "org-1" },
      data: { onboardedAt: expect.any(Date) },
    });
  });

  it("is idempotent when onboarding was already completed", async () => {
    organizationFindUnique.mockResolvedValue({
      id: "org-1",
      subscriptionStatus: "active",
      onboardedAt: new Date("2026-07-13T00:00:00.000Z"),
    });

    const response = await app.inject({
      method: "POST",
      url: "/onboarding/complete",
      payload: {},
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ completed: true });
    expect(organizationUpdate).not.toHaveBeenCalled();
  });

  it("refuses completion when entitlement is not active", async () => {
    organizationFindUnique.mockResolvedValue({
      id: "org-1",
      subscriptionStatus: "incomplete",
    });

    const response = await app.inject({
      method: "POST",
      url: "/onboarding/complete",
      payload: {},
    });

    expect(response.statusCode).toBe(403);
    expect(organizationUpdate).not.toHaveBeenCalled();
  });

  it("refuses completion when no channel has become active", async () => {
    socialAccountCount.mockResolvedValue(0);

    const response = await app.inject({
      method: "POST",
      url: "/onboarding/complete",
      payload: {},
    });

    expect(response.statusCode).toBe(400);
    expect(organizationUpdate).not.toHaveBeenCalled();
  });
});
