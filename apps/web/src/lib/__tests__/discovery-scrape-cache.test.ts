import { afterEach, describe, expect, it, vi } from "vitest";
import {
  discoveryScrapeSourceKey,
  isDiscoveryScrapeCacheForOrg,
  readActiveScopedWebsiteUrl,
  type DiscoveryScrapeCache,
} from "../discovery-scrape-cache";

const cache: DiscoveryScrapeCache = {
  urlKey: "example.com",
  scope: "org:org-a",
  status: "completed",
  market: "Software",
  offer: "Platform",
  audience: "Teams",
  value: "Automation",
  strategyStatus: "Ready",
  error: null,
};

describe("isDiscoveryScrapeCacheForOrg", () => {
  it("accepts cached scrape data only for its originating organization", () => {
    expect(isDiscoveryScrapeCacheForOrg(cache, "org-a")).toBe(true);
    expect(isDiscoveryScrapeCacheForOrg(cache, "org-b")).toBe(false);
  });

  it("does not hydrate cached data before an organization scope is known", () => {
    expect(isDiscoveryScrapeCacheForOrg(cache, null)).toBe(false);
  });
});

describe("readActiveScopedWebsiteUrl", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps a completed website analysis available after anonymous signup data is promoted", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    };

    vi.stubGlobal("window", { localStorage: storage, sessionStorage: storage });
    storage.setItem("lr_discovery_org_id", "org-a");
    storage.setItem("lr_discovery_scrape", JSON.stringify(cache));

    expect(readActiveScopedWebsiteUrl()).toBe("example.com");
  });
});

describe("discoveryScrapeSourceKey", () => {
  it("requires a current organization scope before accepting a scrape URL", () => {
    expect(discoveryScrapeSourceKey(null, "example.com")).toBeNull();
    expect(discoveryScrapeSourceKey("org-a", null)).toBeNull();
    expect(discoveryScrapeSourceKey("org-a", "https://www.example.com/path")).toBe(
      "org:org-a:example.com",
    );
  });
});
