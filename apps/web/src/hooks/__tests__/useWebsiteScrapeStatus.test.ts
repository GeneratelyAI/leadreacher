import { describe, expect, it } from "vitest";
import {
  shouldStartFreshScrape,
  type WebsiteScrapeStatus,
} from "../useWebsiteScrapeStatus";

function scrapeStatus(
  status: WebsiteScrapeStatus["status"],
  url: string | null,
): WebsiteScrapeStatus {
  return {
    status,
    url,
    market: "",
    offer: "",
    audience: "",
    value: "",
    strategyStatus: "",
    error: null,
  };
}

describe("shouldStartFreshScrape", () => {
  it("starts a fresh scrape when a completed result belongs to a different URL", () => {
    expect(
      shouldStartFreshScrape(
        scrapeStatus("completed", "https://hotocantins.com.br"),
        "instagram.com",
        null,
      ),
    ).toBe(true);
  });

  it("does not restart a completed scrape for the same normalized URL", () => {
    expect(
      shouldStartFreshScrape(
        scrapeStatus("completed", "https://hotocantins.com.br"),
        "hotocantins.com.br",
        null,
      ),
    ).toBe(false);
  });

  it("starts an idle status with a null URL and avoids duplicate starts", () => {
    const idleStatus = scrapeStatus("idle", null);

    expect(shouldStartFreshScrape(idleStatus, "instagram.com", null)).toBe(true);
    expect(
      shouldStartFreshScrape(idleStatus, "instagram.com", "instagram.com"),
    ).toBe(false);
  });
});
