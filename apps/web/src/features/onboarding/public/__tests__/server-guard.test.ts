import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  redirect: vi.fn((destination: string) => {
    throw new Error(`REDIRECT:${destination}`);
  }),
  getUser: vi.fn(),
  getSession: vi.fn(),
  bootstrapOrganizationServer: vi.fn(),
  getStrategyServer: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/platform/auth/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mocks.getUser, getSession: mocks.getSession },
  })),
}));
vi.mock("@/lib/api/server", () => ({
  bootstrapOrganizationServer: mocks.bootstrapOrganizationServer,
  getStrategyServer: mocks.getStrategyServer,
}));

import { guardOnboardingRoute } from "../server-guard";

const completeStrategy = {
  campaignType: "personalized_outreach",
  videoConfig: { enabled: true, mode: "personalized", source: "generated", tone: "professional" },
  icpDefinition: { onboarding: { introductionSeen: true, prospectsApproved: true }, contentChoice: "personalized-video" },
  messagingAngles: { outreachMessage: "Hello", outreachMessageApprovedAt: "2026-09-11T00:00:00.000Z" },
  channels: { selected: ["linkedin"] },
};

function workspace(overrides: Record<string, unknown> = {}) {
  return {
    orgId: "org-1",
    disabledAt: null,
    legalAccepted: true,
    onboardedAt: null,
    subscriptionStatus: null,
    ...overrides,
  };
}

describe("guardOnboardingRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: { email: "owner@example.com" } } });
    mocks.getSession.mockResolvedValue({ data: { session: { access_token: "token" } } });
    mocks.bootstrapOrganizationServer.mockResolvedValue(workspace());
    mocks.getStrategyServer.mockResolvedValue(completeStrategy);
  });

  it("requires authentication before loading workspace state", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    await expect(guardOnboardingRoute("cta")).rejects.toThrow("REDIRECT:/login");
    expect(mocks.bootstrapOrganizationServer).not.toHaveBeenCalled();
  });

  it("requires an authenticated session before calling protected APIs", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null } });
    await expect(guardOnboardingRoute("cta")).rejects.toThrow("REDIRECT:/login");
    expect(mocks.bootstrapOrganizationServer).not.toHaveBeenCalled();
  });

  it.each([
    [workspace({ disabledAt: "2026-09-01T00:00:00.000Z" }), "/recover-organization"],
    [workspace({ legalAccepted: false }), "/legal-consent"],
    [workspace({ onboardedAt: "2026-09-01T00:00:00.000Z" }), "/dashboard"],
  ])("redirects workspace prerequisite failures", async (savedWorkspace, destination) => {
    mocks.bootstrapOrganizationServer.mockResolvedValue(savedWorkspace);
    await expect(guardOnboardingRoute("cta")).rejects.toThrow(`REDIRECT:${destination}`);
  });

  it("redirects the onboarding root and future routes to persisted progress", async () => {
    mocks.getStrategyServer.mockResolvedValue({
      ...completeStrategy,
      messagingAngles: {},
      channels: { selected: [] },
    });
    await expect(guardOnboardingRoute()).rejects.toThrow("REDIRECT:/onboarding/cta");
    await expect(guardOnboardingRoute("checkout")).rejects.toThrow("REDIRECT:/onboarding/cta");
  });

  it("rejects a content route that does not match the saved choice", async () => {
    await expect(guardOnboardingRoute("document")).rejects.toThrow("REDIRECT:/onboarding/campaign-content");
  });

  it("allows a route at or before the earliest incomplete step", async () => {
    await expect(guardOnboardingRoute("checkout")).resolves.toEqual({
      accessToken: "token",
      orgId: "org-1",
      subscriptionStatus: null,
    });
    await expect(guardOnboardingRoute("discovery")).resolves.toEqual(expect.objectContaining({ orgId: "org-1" }));
  });
});
