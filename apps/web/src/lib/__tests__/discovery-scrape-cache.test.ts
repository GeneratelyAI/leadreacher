import { describe, expect, it } from "vitest";
import {
  discoveryScrapeSourceKey,
  isDiscoveryScrapeCacheForOrg,
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

describe("discoveryScrapeSourceKey", () => {
  it("requires a current organization scope before accepting a scrape URL", () => {
    expect(discoveryScrapeSourceKey(null, "example.com")).toBeNull();
    expect(discoveryScrapeSourceKey("org-a", null)).toBeNull();
    expect(discoveryScrapeSourceKey("org-a", "https://www.example.com/path")).toBe(
      "org:org-a:example.com",
    );
  });
});
