import { describe, expect, it } from "vitest";
import { leadLinkedinIdentifier } from "../linkedin-identifier.js";

describe("leadLinkedinIdentifier", () => {
  it("prefers providerLinkedinId when present", () => {
    expect(
      leadLinkedinIdentifier({
        providerLinkedinId: "PROV",
        linkedinUrl: "https://linkedin.com/in/jane",
      }),
    ).toBe("PROV");
  });

  it("extracts the slug from a linkedin URL", () => {
    expect(
      leadLinkedinIdentifier({
        providerLinkedinId: null,
        linkedinUrl: "https://www.linkedin.com/in/jane-doe/?foo=1",
      }),
    ).toBe("jane-doe");
  });

  it("returns null when neither is usable", () => {
    expect(
      leadLinkedinIdentifier({ providerLinkedinId: null, linkedinUrl: null }),
    ).toBeNull();
    expect(
      leadLinkedinIdentifier({
        providerLinkedinId: null,
        linkedinUrl: "https://example.com/profile",
      }),
    ).toBeNull();
  });
});
