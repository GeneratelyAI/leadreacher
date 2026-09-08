import Fastify from "fastify";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { applyZodCompilers } from "../../../platform/http/zod-compilers.js";
import { installHttpErrorHandling } from "../../../platform/http/error-handler.js";

const mocks = vi.hoisted(() => ({
  user: vi.fn(), organization: vi.fn(), count: vi.fn(), transaction: vi.fn(),
  status: vi.fn(), recover: vi.fn(),
}));
vi.mock("../../../platform/persistence/prisma.js", () => ({ prisma: {
  user: { findUnique: mocks.user }, organization: { findUnique: mocks.organization },
  socialAccount: { count: mocks.count }, $transaction: mocks.transaction,
} }));
vi.mock("../../../platform/redis/connection.js", () => ({ redis: { del: vi.fn(), set: vi.fn() } }));
vi.mock("../../onboarding/public/discovery-routes.js", () => ({
  anonScrapeClaimKey: (id: string) => `claim:${id}`,
  anonScrapeStatusKey: (id: string) => `anonymous:${id}`,
  orgScrapeStatusKey: (id: string) => `organization:${id}`,
  getScrapeStatus: mocks.status, setScrapeStatus: vi.fn(),
  ANON_SCRAPE_STATUS_TTL_SECONDS: 3600, SCRAPE_STATUS_TTL_SECONDS: 3600,
}));
vi.mock("../../organizations/public/lifecycle.js", () => ({ recoverOrganization: mocks.recover }));
vi.mock("../../../platform/auth/hooks.js", () => ({
  verifySupabaseJwt: async (request: { userId?: string; userEmail?: string }) => {
    request.userId = "signed-user";
  },
  requireMfa: async () => undefined,
}));
import { authRoutes } from "../public/routes.js";

let app: ReturnType<typeof Fastify>;
beforeEach(async () => {
  vi.resetAllMocks();
  mocks.user.mockResolvedValue({ id: "member", orgId: "saved-org", role: "owner", name: " Alice ", org: { socialAccounts: [] } });
  mocks.organization.mockResolvedValue({ subscriptionStatus: "active", onboardedAt: null, disabledAt: null, purgeAt: null });
  mocks.count.mockResolvedValue(2);
  mocks.status.mockResolvedValue({ status: "completed", url: "original.example", market: "Software" });
  app = Fastify();
  applyZodCompilers(app);
  installHttpErrorHandling(app);
  await app.register(authRoutes);
});
afterEach(async () => app.close());

it("recovers the signed-in user's campaign and ignores a conflicting body organization", async () => {
  const response = await app.inject({ method: "POST", url: "/auth/bootstrap", payload: { name: "New name", orgId: "foreign-org" } });
  expect(response.statusCode).toBe(200);
  expect(response.json()).toMatchObject({ orgId: "saved-org", userId: "member", memberName: "Alice", activeChannelCount: 2, scrapeStatus: { url: "original.example", status: "completed" } });
  expect(mocks.user).toHaveBeenCalledWith(expect.objectContaining({ where: { supabaseId: "signed-user" } }));
  expect(mocks.status).toHaveBeenCalledWith("organization:saved-org");
  expect(mocks.count).toHaveBeenCalledWith({ where: { orgId: "saved-org", status: "active" } });
  expect(mocks.transaction).not.toHaveBeenCalled();
});

it("keeps the trimmed nonempty name validation ahead of persistence", async () => {
  const response = await app.inject({ method: "POST", url: "/auth/bootstrap", payload: { name: "  " } });
  expect(response.statusCode).toBe(400);
  expect(mocks.user).not.toHaveBeenCalled();
  expect(mocks.transaction).not.toHaveBeenCalled();
});

it("requires an email claim only when bootstrapping a new user", async () => {
  mocks.user.mockResolvedValue(null);
  const response = await app.inject({ method: "POST", url: "/auth/bootstrap", payload: { name: "Workspace" } });
  expect(response.statusCode).toBe(400);
  expect(response.json()).toMatchObject({ message: "Token must include an email claim to bootstrap a new user" });
  expect(mocks.transaction).not.toHaveBeenCalled();
});
