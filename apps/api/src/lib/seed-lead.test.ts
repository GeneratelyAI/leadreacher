import { describe, expect, it } from "vitest";
import { buildSeedLead } from "./seed-lead.js";

describe("buildSeedLead", () => {
  it("sets provider id and import defaults", () => {
    const data = buildSeedLead({
      orgId: "org1",
      firstName: "Test",
      lastName: "Recipient",
      linkedinUrl: "https://linkedin.com/in/test-recipient",
      providerLinkedinId: "PROV-123",
    });
    expect(data).toMatchObject({
      orgId: "org1",
      source: "manual",
      status: "new",
      firstName: "Test",
      lastName: "Recipient",
      linkedinUrl: "https://linkedin.com/in/test-recipient",
      providerLinkedinId: "PROV-123",
      company: "",
      title: "",
      tags: [],
      notes: [],
      enrichmentData: {},
    });
  });

  it("passes through company and title when provided", () => {
    const data = buildSeedLead({
      orgId: "org1",
      firstName: "T",
      lastName: "R",
      linkedinUrl: "u",
      providerLinkedinId: "p",
      company: "Acme",
      title: "VP",
    });
    expect(data.company).toBe("Acme");
    expect(data.title).toBe("VP");
  });
});
