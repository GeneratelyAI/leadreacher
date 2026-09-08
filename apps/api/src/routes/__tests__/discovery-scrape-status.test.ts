import { describe, expect, it } from "vitest";
import {
  AnonScrapeIdSchema,
  boundGroqWebsiteContext,
  recoverScrapeStatusFromOnboardingData,
  recoverScrapeStatusFromStrategy,
  resolveScrapeTerminalStatus,
} from "../discovery.js";

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

describe("recoverScrapeStatusFromStrategy", () => {
  it("restores the durable website and saved prospect profile after the scrape cache expires", () => {
    expect(recoverScrapeStatusFromStrategy({
      icpDefinition: {
        idealCustomer: "Revenue leaders at B2B software companies",
        prospectProfile: {
          decisionMakers: ["VP of Sales"],
          companyTypes: ["B2B SaaS"],
          industries: ["Technology"],
          locations: ["Canada"],
        },
        discovery: {
          websiteUrl: "https://example.com",
          market: "B2B revenue teams",
          offer: "Personalized outreach automation",
          audience: "Revenue leaders",
          value: "More qualified conversations",
          strategyStatus: "Prepare the first outreach sequence.",
        },
      },
      positioning: {},
      updatedAt: new Date("2026-09-07T12:00:00.000Z"),
    })).toMatchObject({
      status: "completed",
      url: "https://example.com",
      market: "B2B revenue teams",
      prospectProfile: { decisionMakers: ["VP of Sales"] },
    });
  });

  it("does not invent a recoverable campaign when a legacy strategy has no website", () => {
    expect(recoverScrapeStatusFromStrategy({
      icpDefinition: { idealCustomer: "Revenue leaders" },
      positioning: { industry: "Software" },
      updatedAt: new Date("2026-09-07T12:00:00.000Z"),
    })).toBeNull();
  });
});

describe("recoverScrapeStatusFromOnboardingData", () => {
  it("restores an analyzed website before Discovery has created a strategy", () => {
    expect(recoverScrapeStatusFromOnboardingData({
      discovery: {
        status: "completed",
        url: "https://example.com",
        market: "B2B software",
        offer: "Automated outreach",
        audience: "Revenue leaders",
        value: "More qualified conversations",
        strategyStatus: "Build the first sequence.",
        prospectProfile: {
          decisionMakers: ["VP of Sales"],
          companyTypes: ["B2B SaaS"],
          industries: ["Technology"],
          locations: ["Canada"],
        },
      },
    }, new Date("2026-09-07T12:00:00.000Z"))).toMatchObject({
      status: "completed",
      url: "https://example.com",
      prospectProfile: { companyTypes: ["B2B SaaS"] },
    });
  });
});

describe("boundGroqWebsiteContext", () => {
  it("keeps short website content intact", () => {
    expect(boundGroqWebsiteContext("  concise website copy  ")).toBe("concise website copy");
  });

  it("preserves the beginning and end while bounding large scrapes", () => {
    const markdown = `START-${"a".repeat(20_000)}-END`;
    const bounded = boundGroqWebsiteContext(markdown);

    expect(bounded.length).toBeLessThan(16_100);
    expect(bounded).toContain("START-");
    expect(bounded).toContain("-END");
    expect(bounded).toContain("[content abbreviated]");
  });
});
