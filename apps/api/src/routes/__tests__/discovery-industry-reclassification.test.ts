import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveIndustryIds } from "../../adapters/linkedin-industry-codes.js";

const { callGroq } = vi.hoisted(() => ({ callGroq: vi.fn() }));

vi.mock("../../lib/groq.js", () => ({ callGroq }));

import {
  buildIndustryReclassificationShortlist,
  repairUnresolvedDiscoveryMarket,
  type DiscoveryScrapeFields,
} from "../discovery.js";

const INVENTED_MARKET: DiscoveryScrapeFields = {
  market: "Digital Asset Management & Web Scale Crawling",
  offer: "Developer API for web data extraction and crawling",
  audience: "Engineering and data teams",
  value: "Reliable web data infrastructure",
  strategyStatus: "Building an outreach strategy.",
};

beforeEach(() => {
  callGroq.mockReset();
});

describe("repairUnresolvedDiscoveryMarket", () => {
  it("accepts only an exact verified industry label from the local shortlist", async () => {
    expect(resolveIndustryIds([INVENTED_MARKET.market])).toEqual([]);

    const shortlist = buildIndustryReclassificationShortlist(INVENTED_MARKET);
    expect(shortlist.length).toBeGreaterThan(0);
    const selectedCandidate = shortlist[0];
    expect(selectedCandidate).toBeDefined();
    if (!selectedCandidate) {
      throw new Error("Expected a deterministic LinkedIn industry shortlist");
    }

    callGroq.mockResolvedValue(selectedCandidate.label);
    const repaired = await repairUnresolvedDiscoveryMarket(INVENTED_MARKET);

    expect(repaired.market).toBe(selectedCandidate.label);
    expect(resolveIndustryIds([repaired.market]).length).toBeGreaterThan(0);
    expect(callGroq).toHaveBeenCalledWith(
      expect.any(String),
      [
        expect.objectContaining({
          content: expect.stringContaining(`- ${selectedCandidate.label}`),
        }),
      ],
      120,
    );
  });

  it("rejects a hallucinated industry label that was not offered in the shortlist", async () => {
    const shortlist = buildIndustryReclassificationShortlist(INVENTED_MARKET);
    const hallucinatedLabel = "Imaginary Crawling Conglomerates";
    expect(shortlist.some((candidate) => candidate.label === hallucinatedLabel)).toBe(
      false,
    );

    callGroq.mockResolvedValue(hallucinatedLabel);
    const repaired = await repairUnresolvedDiscoveryMarket(INVENTED_MARKET);

    expect(repaired).toEqual(INVENTED_MARKET);
    expect(resolveIndustryIds([repaired.market])).toEqual([]);
  });

  it("does not call Groq when the initial market already resolves", async () => {
    const market: DiscoveryScrapeFields = {
      ...INVENTED_MARKET,
      market: "Software Development",
    };

    await expect(repairUnresolvedDiscoveryMarket(market)).resolves.toEqual(market);
    expect(callGroq).not.toHaveBeenCalled();
  });
});
