import { describe, expect, it, vi } from "vitest";
import {
  anonScrapeStatusKey,
  orgScrapeStatusKey,
  SCRAPE_STATUS_TTL_SECONDS,
  type DiscoveryScrapeStatus,
} from "../discovery.js";
import { claimCompletedAnonymousScrape } from "../auth.js";

const ANON_ID = "550e8400-e29b-41d4-a716-446655440000";
const ORG_ID = "org-123";

function scrapeStatus(
  status: DiscoveryScrapeStatus["status"],
): DiscoveryScrapeStatus {
  return {
    status,
    url: "https://example.com",
    market: status === "completed" ? "Software" : "",
    offer: "",
    audience: "",
    value: "",
    strategyStatus: "",
    error: null,
    updatedAt: "2026-07-12T00:00:00.000Z",
  };
}

function createStorage(status: DiscoveryScrapeStatus | null) {
  return {
    getStatus: vi.fn(async () => status),
    setStatus: vi.fn(async () => undefined),
    deleteStatus: vi.fn(async () => 1),
    setClaim: vi.fn(async () => undefined),
    deleteClaim: vi.fn(async () => 1),
  };
}

describe("claimCompletedAnonymousScrape", () => {
  it("does nothing when no anonymous scrape id was provided", async () => {
    const storage = createStorage(scrapeStatus("completed"));

    await claimCompletedAnonymousScrape({ orgId: ORG_ID }, storage);

    expect(storage.getStatus).not.toHaveBeenCalled();
    expect(storage.setStatus).not.toHaveBeenCalled();
    expect(storage.deleteStatus).not.toHaveBeenCalled();
    expect(storage.setClaim).not.toHaveBeenCalled();
  });

  it("does nothing when the anonymous scrape has expired or is missing", async () => {
    const storage = createStorage(null);

    await claimCompletedAnonymousScrape(
      { orgId: ORG_ID, anonScrapeId: ANON_ID },
      storage,
    );

    expect(storage.getStatus).toHaveBeenCalledWith(anonScrapeStatusKey(ANON_ID));
    expect(storage.setStatus).not.toHaveBeenCalled();
    expect(storage.deleteStatus).not.toHaveBeenCalled();
    expect(storage.setClaim).not.toHaveBeenCalled();
  });

  it("copies a running scrape and registers forwarding to the organization", async () => {
    const running = scrapeStatus("running");
    const storage = createStorage(running);

    await claimCompletedAnonymousScrape(
      { orgId: ORG_ID, anonScrapeId: ANON_ID },
      storage,
    );

    expect(storage.setStatus).toHaveBeenCalledWith(
      orgScrapeStatusKey(ORG_ID),
      running,
      SCRAPE_STATUS_TTL_SECONDS,
    );
    expect(storage.deleteStatus).not.toHaveBeenCalled();
    expect(storage.setClaim).toHaveBeenCalledWith(ANON_ID, ORG_ID);
  });

  it("copies a completed scrape to the organization key and removes the anonymous key", async () => {
    const completed = scrapeStatus("completed");
    const storage = createStorage(completed);

    await claimCompletedAnonymousScrape(
      { orgId: ORG_ID, anonScrapeId: ANON_ID },
      storage,
    );

    expect(storage.setStatus).toHaveBeenCalledWith(
      orgScrapeStatusKey(ORG_ID),
      completed,
      SCRAPE_STATUS_TTL_SECONDS,
    );
    expect(storage.deleteStatus).toHaveBeenCalledWith(anonScrapeStatusKey(ANON_ID));
    expect(storage.deleteClaim).toHaveBeenCalledWith(ANON_ID);
  });
});
