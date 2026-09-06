import { describe, expect, it } from "vitest";
import { appendProspectDetail, classifyProspectDetail, splitProspectDetails, type ProspectDetails } from "../prospect-details";

describe("prospect details", () => {
  it.each([
    ["Brazil", "locations"], ["in Canada", "locations"], ["based in Canada", "locations"],
    ["UK", "locations"], ["Europe", "locations"], ["Latin America", "locations"],
    ["VP of Sales", "decisionMakers"], ["Sourcing Director", "decisionMakers"],
    ["B2B SaaS", "companyTypes"], ["Marketing agency", "companyTypes"],
    ["Financial Services", "industries"], ["Technology", "industries"],
    ["Growing teams", null], ["Agency founder", null],
  ])("classifies %s without guessing", (value, category) => {
    expect(classifyProspectDetail(value).category).toBe(category);
  });
  it("normalizes geographic phrases and abbreviations", () => {
    expect(classifyProspectDetail("in Canada").value).toBe("Canada");
    expect(classifyProspectDetail("UK").value).toBe("United Kingdom");
  });
  it("splits lists and removes case-insensitive duplicates", () => {
    expect(splitProspectDetails(" Brazil,Canada; brazil\nCEO\r\nTechnology; ")).toEqual(["Brazil", "Canada", "CEO", "Technology"]);
  });
  it("deduplicates existing values across all categories without mutation", () => {
    const profile: ProspectDetails = { decisionMakers: [], companyTypes: [], industries: [], locations: ["Brazil"] };
    expect(appendProspectDetail(profile, "locations", " BRAZIL ")).toBe(profile);
    expect(appendProspectDetail(profile, "industries", "brazil")).toBe(profile);
    expect(appendProspectDetail(profile, "locations", "Canada").locations).toEqual(["Brazil", "Canada"]);
    expect(profile.locations).toEqual(["Brazil"]);
  });
});
