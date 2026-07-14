import { describe, expect, it } from "vitest";
import { AnonScrapeIdSchema, resolveScrapeTerminalStatus } from "../discovery.js";

describe("resolveScrapeTerminalStatus", () => {
  it("returns failed when all fields are empty", () => {
    expect(
      resolveScrapeTerminalStatus({
        market: "",
        offer: "",
        audience: "",
        value: "",
        strategyStatus: "",
      }),
    ).toBe("failed");
  });

  it("returns failed when only strategyStatus is present", () => {
    expect(
      resolveScrapeTerminalStatus({
        market: "",
        offer: "",
        audience: "",
        value: "",
        strategyStatus: "Building an outreach strategy.",
      }),
    ).toBe("failed");
  });

  it("returns completed when market is present", () => {
    expect(
      resolveScrapeTerminalStatus({
        market: "Data infrastructure",
        offer: "",
        audience: "",
        value: "",
        strategyStatus: "",
      }),
    ).toBe("completed");
  });

  it("returns completed when every scrape field is present", () => {
    expect(
      resolveScrapeTerminalStatus({
        market: "Data infrastructure",
        offer: "Web data platform",
        audience: "Engineering leaders",
        value: "Reliable public web data",
        strategyStatus: "Building an outreach strategy.",
      }),
    ).toBe("completed");
  });
});

describe("AnonScrapeIdSchema", () => {
  it("rejects non-UUID anonymous scrape ids", () => {
    expect(AnonScrapeIdSchema.safeParse("not-a-uuid").success).toBe(false);
  });
});
