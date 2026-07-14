import { describe, expect, it } from "vitest";
import {
  buildCompanySearchPlan,
  buildStrategyFilters,
  COMPANY_SEARCH_UNAVAILABLE_REASON,
  parseCompanySizesFromText,
  parseLocationsFromText,
} from "../strategy-filters.js";
import { resolveCompanyHeadcountCodes } from "../../adapters/linkedin-company-size-codes.js";

describe("Strategy filter construction", () => {
  it("does not use product offer language as profile search keywords", () => {
    const filters = buildStrategyFilters({
      market: "Sales and Marketing Technology",
      audience: "CROs, VP Sales, and Head of Sales at B2B companies",
      offer: "Data Enrichment and Account Targeting Platform",
    });

    expect(filters).toMatchObject({
      industries: ["Sales and Marketing Technology"],
      jobTitles: ["CRO", "VP Sales", "Head of Sales"],
      locations: [],
    });
    expect(filters.keywords).toBeUndefined();
  });

  it("extracts mid-sized to large enterprise headcount bands from Discovery audience text", () => {
    const companySizes = parseCompanySizesFromText(
      "Marketing and Sales teams at mid-sized to large enterprises",
    );

    expect(companySizes).toEqual(["enterprise", "mid-market"]);
    expect(resolveCompanyHeadcountCodes(companySizes)).toEqual([
      "G",
      "H",
      "I",
      "D",
      "E",
      "F",
    ]);
  });

  it("recognizes numeric employee-count-plus phrasing", () => {
    const sizes = parseCompanySizesFromText(
      "Global accounts with 10,001+ employees",
    );

    expect(resolveCompanyHeadcountCodes(sizes)).toEqual(["I"]);
  });

  it.each([
    ["small business", ["small"]],
    ["SMB", ["smb"]],
    ["small to medium businesses", ["smb"]],
    ["mid-market companies", ["mid-market"]],
    ["mid-sized companies", ["mid-market"]],
    ["enterprise teams", ["enterprise"]],
    ["large enterprise buyers", ["enterprise"]],
    ["startup founders", ["startup"]],
  ])("recognizes the company-size phrase %s", (text, expected) => {
    expect(parseCompanySizesFromText(text)).toEqual(expected);
  });

  it("extracts explicit geographic signals to canonical LinkedIn location text", () => {
    expect(
      parseLocationsFromText(
        "US-based teams serving the European market and North America",
      ),
    ).toEqual(["United States", "North America", "Europe"]);
  });

  it("recognizes bare UK without a trailing qualifier", () => {
    expect(
      parseLocationsFromText(
        "IT managers at small and medium businesses in the UK",
      ),
    ).toEqual(["United Kingdom"]);
  });

  it("includes explicit competitive-advantage geography in Strategy filters", () => {
    const filters = buildStrategyFilters({
      market: "AI Automation",
      audience: "Marketing and Sales teams at mid-sized to large enterprises",
      offer: "Robotic Process Automation tools",
      competitiveAdvantage: "A US-based platform for the European market",
    });

    expect(filters.companySizes).toEqual(["enterprise", "mid-market"]);
    expect(filters.locations).toEqual(["United States", "Europe"]);
  });

  it("leaves demographics empty when Discovery text has no size or geography signal", () => {
    const filters = buildStrategyFilters({
      market: "Web Scraping and AI",
      audience: "DevOps teams, data analysts, and AI developers",
      offer: "SaaS-based web crawling and scraping platform",
      competitiveAdvantage: "We are a developer first company",
    });

    expect(filters.companySizes).toEqual([]);
    expect(filters.locations).toEqual([]);
  });

  it("uses a market query only for company search when no industry ID resolves", () => {
    const plan = buildCompanySearchPlan({
      filters: {
        jobTitles: ["Founder"],
        industries: ["Regulatory Workflow Orchestration"],
        companySizes: [],
        locations: [],
      },
      market: "Regulatory Workflow Orchestration",
      resolvedIndustryIds: [],
      resolvedCompanyHeadcount: [],
    });

    expect(plan).toEqual({
      canSearch: true,
      filters: {
        jobTitles: ["Founder"],
        industries: ["Regulatory Workflow Orchestration"],
        companySizes: [],
        locations: [],
        keywords: ["Regulatory Workflow Orchestration"],
      },
    });
  });

  it("marks company data unavailable without blocking decision-maker analysis when no criterion exists", () => {
    const plan = buildCompanySearchPlan({
      filters: {
        jobTitles: ["Founder"],
        industries: [],
        companySizes: [],
        locations: [],
      },
      market: "",
      resolvedIndustryIds: [],
      resolvedCompanyHeadcount: [],
    });

    expect(plan).toEqual({
      canSearch: false,
      filters: {
        jobTitles: ["Founder"],
        industries: [],
        companySizes: [],
        locations: [],
        keywords: undefined,
      },
      reason: COMPANY_SEARCH_UNAVAILABLE_REASON,
    });
  });
});
