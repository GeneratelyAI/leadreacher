import { describe, expect, it } from "vitest";
import type { CompanySearchResult } from "../../adapters/apify.js";
import { COMPANY_SEARCH_UNAVAILABLE_REASON } from "../strategy-filters.js";
import { resolveCompanySearchOutcome } from "../strategy.js";

describe("resolveCompanySearchOutcome", () => {
  it("passes through a fulfilled company search", () => {
    const outcome: CompanySearchResult = {
      companies: [],
      totalFound: 25,
      skipped: false,
    };

    expect(
      resolveCompanySearchOutcome({ status: "fulfilled", value: outcome }),
    ).toBe(outcome);
  });

  it("marks a rejected company search unavailable without discarding profiles", () => {
    expect(
      resolveCompanySearchOutcome({
        status: "rejected",
        reason: new Error("company actor timed out"),
      }),
    ).toEqual({
      companies: [],
      totalFound: 0,
      skipped: true,
      reason: COMPANY_SEARCH_UNAVAILABLE_REASON,
    });
  });
});
