import { describe, expect, it } from "vitest";
import {
  approvedAudienceFilters,
  createApprovedAudience,
  normalizeAudienceBrief,
  validateProspectAgainstApprovedAudience,
} from "../public/audience-targeting.js";

const evidence = [{ excerpt: "Revenue teams buy the platform.", url: "https://example.com/business" }];
const target = (value: string) => ({ value, confidence: 0.9, evidence });

function brief(classification: string, objective = "business_buyers") {
  return normalizeAudienceBrief({
    classification,
    suggestedObjective: objective,
    audienceSides: [{ kind: "business_buyer", label: "Revenue teams", confidence: 0.9, evidence }],
    suggestions: {
      decisionMakers: [target("VP of Sales")],
      companyTypes: [target("B2B SaaS")],
      industries: [target("Software")],
      locations: [target("Canada")],
    },
  });
}

describe("audience-aware targeting", () => {
  it("keeps evidence-backed B2B buyers eligible", () => {
    const value = brief("b2b");
    const approved = createApprovedAudience({
      brief: value,
      profile: { decisionMakers: ["VP of Sales"], companyTypes: ["B2B SaaS"], industries: ["Software"], locations: ["Canada"], additionalContext: "" },
    });
    expect(value.sourcing.status).toBe("eligible");
    expect(approved.sourcing.status).toBe("eligible");
    expect(approvedAudienceFilters(approved)).toMatchObject({ jobTitles: ["VP of Sales"], industries: ["Software"], locations: ["Canada"] });
  });

  it.each([
    ["b2c", "business_buyers"],
    ["marketplace", "business_buyers"],
    ["mixed", "business_buyers"],
    ["unclear", "clarification_required"],
  ])("blocks automatic sourcing for %s until an explicit safe audience is approved", (classification, objective) => {
    expect(brief(classification, objective).sourcing.status).toBe("blocked");
  });

  it("keeps marketplace and mixed audiences blocked after persisted approval is read", () => {
    for (const classification of ["marketplace", "mixed"] as const) {
      const approved = createApprovedAudience({
        brief: brief(classification),
        objective: "business_buyers",
        profile: { decisionMakers: ["VP of Sales"], companyTypes: [], industries: [], locations: [], additionalContext: "" },
      });
      expect(approved.sourcing.status).toBe("blocked");
    }
  });

  it("requires evidence and confidence instead of inventing buyer roles", () => {
    const result = normalizeAudienceBrief({
      classification: "b2b",
      suggestedObjective: "business_buyers",
      audienceSides: [],
      suggestions: { decisionMakers: [{ value: "Founder", confidence: 0.3, evidence: [] }], companyTypes: [], industries: [], locations: [] },
    });
    expect(result.suggestions.decisionMakers).toEqual([]);
    expect(result.sourcing.status).toBe("blocked");
  });

  it("rejects supply-side and mismatched returned profiles before import", () => {
    const approved = createApprovedAudience({
      brief: brief("b2b"),
      profile: { decisionMakers: ["VP of Sales"], companyTypes: [], industries: ["Software"], locations: ["Canada"], additionalContext: "" },
    });
    const base = { linkedinUrl: "https://linkedin.com/in/a", firstName: "A", lastName: "B", company: "Example", enrichmentData: {} };
    expect(validateProspectAgainstApprovedAudience({ ...base, title: "VP of Sales", industry: "Software", location: "Toronto, Canada" }, approved)).toEqual({ accepted: true });
    expect(validateProspectAgainstApprovedAudience({ ...base, title: "Delivery Driver", industry: "Software", location: "Toronto, Canada" }, approved)).toMatchObject({ accepted: false });
    expect(validateProspectAgainstApprovedAudience({ ...base, title: "VP of Sales", industry: "Logistics", location: "Toronto, Canada" }, approved)).toMatchObject({ accepted: false });
  });
});
