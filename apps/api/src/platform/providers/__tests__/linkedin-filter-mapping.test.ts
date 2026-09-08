import { describe, expect, it } from "vitest";
import { resolveCompanyHeadcountCodes } from "../linkedin-company-size-codes.js";
import { resolveIndustryIds } from "../linkedin-industry-codes.js";

describe("LinkedIn filter mapping", () => {
  it("maps B2B Technology to LinkedIn technology industry IDs", () => {
    expect(resolveIndustryIds(["B2B Technology"])).toEqual([4, 96]);
  });

  it("maps B2B data and sales enablement to concrete LinkedIn industry IDs", () => {
    expect(resolveIndustryIds(["B2B data and sales enablement"])).toEqual([2458, 6]);
  });

  it("maps Web Data and Analytics to data infrastructure instead of Climate Data and Analytics", () => {
    expect(resolveIndustryIds(["Web Data and Analytics"])).toEqual([2458]);
  });

  it("maps Web Search and Crawling to defensible internet and software industries", () => {
    expect(resolveIndustryIds(["Web Search and Crawling"])).toEqual([6, 4]);
  });

  it("maps Sales and Marketing Technology to concrete LinkedIn industry IDs", () => {
    expect(resolveIndustryIds(["Sales and Marketing Technology"])).toEqual([6, 4, 1862]);
  });

  it("maps free-form company size ranges to LinkedIn headcount codes", () => {
    expect(resolveCompanyHeadcountCodes(["50-200 employees"])).toEqual(["D"]);
    expect(resolveCompanyHeadcountCodes(["10,001+ employees"])).toEqual(["I"]);
  });

  it("keeps every fully-contained LinkedIn headcount band", () => {
    expect(resolveCompanyHeadcountCodes(["1-1000"])).toEqual([
      "A", "B", "C", "D", "E", "F",
    ]);
    expect(resolveCompanyHeadcountCodes(["50-1000"])).toEqual([
      "D", "E", "F",
    ]);
    expect(resolveCompanyHeadcountCodes(["11-1000"])).toEqual([
      "C", "D", "E", "F",
    ]);
    expect(resolveCompanyHeadcountCodes(["1-10000"])).toEqual([
      "A", "B", "C", "D", "E", "F", "G", "H",
    ]);
  });
});
