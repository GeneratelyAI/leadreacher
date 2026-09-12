import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  apiFetch,
  bootstrapCurrentOrganization,
  clearAccessTokenCache,
} from "@/lib/api";
import { readActiveScopedWebsiteUrl, setDiscoveryOrgScope, writeDiscoveryScrapeCache } from "@/features/onboarding/public/discovery-cache";
import { mobileReferenceHref, mobileReferenceState } from "../mobile-reference";
import {
  mobileReferenceWebsiteUrl,
  previewApiFetch,
  seedMobileReference,
  usesOnboardingFixtures,
} from "../../public/preview-api";

const { getBrowserSession } = vi.hoisted(() => ({
  getBrowserSession: vi.fn(),
}));
vi.mock("@/platform/auth/client", () => ({ getBrowserSession }));

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
}

type MemoryStorage = ReturnType<typeof memoryStorage>;
type FixtureStrategy = {
  id: string;
  orgId: string;
  campaignType: string;
  icpDefinition: {
    contentChoice?: string;
    prospectProfile?: { decisionMakers: string[] };
  };
  videoConfig: { tone: string };
};

function browserAt(
  path: string,
  sessionStorage = memoryStorage(),
  localStorage = memoryStorage(),
) {
  const url = new URL(path, "https://leadreacher.example");
  vi.stubGlobal("window", {
    location: { pathname: url.pathname, search: url.search },
    sessionStorage,
    localStorage,
    setTimeout,
    dispatchEvent: vi.fn(),
  });
  return { sessionStorage, localStorage };
}

describe("onboarding preview isolation", () => {
  beforeEach(() => {
    clearAccessTokenCache();
    getBrowserSession.mockReset();
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.example.test");
  });

  afterEach(() => {
    clearAccessTokenCache();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("enables fixtures only on explicit preview or demo paths", async () => {
    for (const path of [
      "/onboarding?screen=05",
      "/signup?screen=01",
      "/login",
      "/dashboard",
    ]) {
      browserAt(path);
      expect(usesOnboardingFixtures()).toBe(false);
      await expect(previewApiFetch("/auth/bootstrap")).rejects.toThrow(
        "unavailable outside preview routes",
      );
    }
    for (const path of ["/onboarding-preview?screen=05", "/onboarding-preview/cta", "/demo/onboarding"]) {
      browserAt(path);
      expect(usesOnboardingFixtures()).toBe(true);
    }
  });

  it("reads the seeded reference website on isolated preview routes", () => {
    const { sessionStorage } = browserAt("/onboarding-preview?screen=09");
    seedMobileReference("09");
    expect(mobileReferenceWebsiteUrl()).toBe("https://acme.example");
    const saved = JSON.parse(
      sessionStorage.getItem("lr_mobile_reference_scrape")!,
    );
    sessionStorage.setItem(
      "lr_mobile_reference_scrape",
      JSON.stringify({
        ...saved,
        url: "https://saved-preview.example/path",
      }),
    );
    expect(mobileReferenceWebsiteUrl()).toBe(
      "https://saved-preview.example/path",
    );

    for (const path of [
      "/onboarding?screen=09",
      "/signup",
      "/login",
      "/demo/onboarding",
    ]) {
      browserAt(path, sessionStorage);
      expect(mobileReferenceWebsiteUrl()).toBeUndefined();
    }
    browserAt("/onboarding-preview/campaign-content/personalized-video", sessionStorage);
    expect(mobileReferenceWebsiteUrl()).toBe("https://saved-preview.example/path");
    vi.stubGlobal("window", undefined);
    expect(mobileReferenceWebsiteUrl()).toBeUndefined();
  });

  it("does not mutate organization scope or consult authentication when reading the reference website", () => {
    const { sessionStorage, localStorage } = browserAt(
      "/onboarding-preview?screen=10",
    );
    seedMobileReference("10");
    sessionStorage.setItem("lr_discovery_org_id", "org-a");
    const sessionWrite = vi.spyOn(sessionStorage, "setItem");
    const localWrite = vi.spyOn(localStorage, "setItem");
    getBrowserSession.mockResolvedValue({ access_token: "org-a-test-token" });

    expect(mobileReferenceWebsiteUrl()).toBe("https://acme.example");
    expect(sessionStorage.getItem("lr_discovery_org_id")).toBe("org-a");
    expect(sessionWrite).not.toHaveBeenCalled();
    expect(localWrite).not.toHaveBeenCalled();
    expect(getBrowserSession).not.toHaveBeenCalled();

    browserAt("/onboarding/discovery", sessionStorage, localStorage);
    expect(mobileReferenceWebsiteUrl()).toBeUndefined();
    expect(sessionStorage.getItem("lr_discovery_org_id")).toBe("org-a");
    expect(sessionWrite).not.toHaveBeenCalled();
  });

  it("does not fall back to preview campaign data when real authentication is missing", async () => {
    const { sessionStorage } = browserAt("/onboarding-preview?screen=05");
    seedMobileReference("05");
    browserAt("/onboarding/discovery", sessionStorage);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    getBrowserSession.mockResolvedValue(null);

    await expect(apiFetch("/auth/bootstrap")).rejects.toMatchObject({
      status: 401,
      code: "UNAUTHORIZED",
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(
      sessionStorage.getItem("lr_fixture_strategy:/onboarding-preview"),
    ).not.toBeNull();
  });

  it("keeps authenticated organization bootstrap authoritative after switching organizations", async () => {
    const { sessionStorage } = browserAt("/onboarding-preview?screen=05");
    seedMobileReference("05");
    browserAt("/onboarding/discovery", sessionStorage);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    for (const orgId of ["org-a", "org-b"]) {
      clearAccessTokenCache();
      getBrowserSession.mockResolvedValue({
        access_token: `${orgId}-test-token`,
        user: { email: `${orgId}@example.test` },
      });
      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            orgId,
            scrapeStatus: { url: `https://${orgId}.example.test` },
          }),
        ),
      );
      await expect(bootstrapCurrentOrganization()).resolves.toMatchObject({
        orgId,
        scrapeStatus: { url: `https://${orgId}.example.test` },
      });
      const [url, options] = fetchMock.mock.lastCall!;
      expect(url).toBe("https://api.example.test/auth/bootstrap");
      expect((options.headers as Headers).get("Authorization")).toBe(
        `Bearer ${orgId}-test-token`,
      );
    }
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("seeds only fixture-owned records without rewriting saved organization campaign data", () => {
    const sessionStorage = memoryStorage();
    const localStorage = memoryStorage();
    sessionStorage.setItem("lr_discovery_org_id", "org-a");
    sessionStorage.setItem(
      "lr_prospect_review:org-a:https://org-a.example",
      "saved-audience",
    );
    localStorage.setItem(
      "lr_discovery_scrape",
      JSON.stringify({
        urlKey: "org-a.example",
        url: "https://org-a.example",
        scope: "org:org-a",
        status: "completed",
      }),
    );
    browserAt("/onboarding-preview?screen=05", sessionStorage, localStorage);
    seedMobileReference("05");
    expect(readActiveScopedWebsiteUrl()).toBeNull();
    setDiscoveryOrgScope("onboarding-preview-org");
    writeDiscoveryScrapeCache({ url: "https://acme.example", status: "completed", market: "Preview", offer: "", audience: "", value: "", strategyStatus: "ready", error: null }, "org:onboarding-preview-org");
    expect(readActiveScopedWebsiteUrl()).toBe("https://acme.example");
    expect(sessionStorage.getItem("lr_discovery_org_id")).toBe("org-a");
    expect(
      sessionStorage.getItem("lr_prospect_review:org-a:https://org-a.example"),
    ).toBe("saved-audience");

    const originalFixture = sessionStorage.getItem(
      "lr_fixture_strategy:/onboarding-preview",
    );
    browserAt("/onboarding?screen=06", sessionStorage, localStorage);
    expect(readActiveScopedWebsiteUrl()).toBe("https://org-a.example");
    seedMobileReference("06");
    expect(
      sessionStorage.getItem("lr_fixture_strategy:/onboarding-preview"),
    ).toBe(originalFixture);
    expect(sessionStorage.getItem("lr_mobile_reference_screen")).toBe("05");
  });

  it("keeps discovery cache records scoped on named preview routes", () => {
    const { sessionStorage, localStorage } = browserAt("/onboarding-preview/cta");
    setDiscoveryOrgScope("onboarding-preview-org");
    writeDiscoveryScrapeCache({
      url: "https://acme.example",
      status: "completed",
      market: "Preview",
      offer: "",
      audience: "",
      value: "",
      strategyStatus: "ready",
      error: null,
    }, "org:onboarding-preview-org");

    expect(sessionStorage.getItem("lr_discovery_org_id:/onboarding-preview")).toBe("onboarding-preview-org");
    expect(localStorage.getItem("lr_discovery_scrape:/onboarding-preview")).not.toBeNull();

    browserAt("/onboarding/discovery", sessionStorage, localStorage);
    expect(readActiveScopedWebsiteUrl()).toBeNull();
  });

  it("retains approved content and audience on step navigation, refresh, and Back to the same numbered fixture", async () => {
    const storage: MemoryStorage = memoryStorage();
    browserAt("/onboarding-preview?screen=08", storage);
    seedMobileReference("08");
    await previewApiFetch(
      "/strategy/onboarding-preview-strategy/campaign-type",
      {
        method: "PATCH",
        body: JSON.stringify({
          campaignType: "uploaded_video",
          contentChoice: "document",
        }),
      },
    );
    await previewApiFetch("/discovery/complete", {
      method: "POST",
      body: JSON.stringify({
        prospectProfile: { decisionMakers: ["Operations Manager"] },
      }),
    });

    for (const path of [
      "/onboarding-preview/campaign-content/document",
      "/onboarding-preview/campaign-content/document",
      "/onboarding-preview?screen=08",
    ]) {
      // Replacing the window models a reload with the browser's same session storage.
      browserAt(path, storage);
      if (path.includes("screen=08")) seedMobileReference("08");
      const strategy = await previewApiFetch<FixtureStrategy>(
        "/strategy/onboarding-preview-strategy",
      );
      expect(strategy.campaignType).toBe("uploaded_video");
      expect(strategy.icpDefinition.contentChoice).toBe("document");
      expect(strategy.icpDefinition.prospectProfile?.decisionMakers).toEqual([
        "Operations Manager",
      ]);
      expect(strategy.orgId).toBe("onboarding-preview-org");
    }
  });

  it("keeps ordinary preview fixtures and prices unchanged without a numbered reference", async () => {
    browserAt("/onboarding-preview/campaign-content/personalized-video");
    const strategy = await previewApiFetch<FixtureStrategy>(
      "/strategy/onboarding-preview-strategy",
    );
    expect(strategy.campaignType).toBe("personalized_outreach");
    expect(strategy.videoConfig.tone).toBe("professional");
    expect(strategy.icpDefinition.contentChoice).toBeUndefined();
    const pricing = await previewApiFetch<{
      lineItems: { unitAmount: number }[];
    }>("/billing/pricing");
    expect(pricing.lineItems[0].unitAmount).toBe(19999);
    expect(mobileReferenceState(null)).toBeUndefined();
    expect(mobileReferenceHref("09")).toBe("/onboarding-preview?screen=09");
  });

  it("keeps Messenger connection fixtures mapped to the selected Facebook channel", async () => {
    browserAt("/onboarding-preview/connect-channels");
    await previewApiFetch("/social-accounts/connect", {
      method: "POST",
      body: JSON.stringify({ provider: "MESSENGER" }),
    });
    const result = await previewApiFetch<{ accounts: Array<{ platform: string; providerType: string }> }>(
      "/social-accounts",
    );

    expect(result.accounts).toContainEqual(expect.objectContaining({
      platform: "facebook",
      providerType: "messenger",
    }));
  });
});
