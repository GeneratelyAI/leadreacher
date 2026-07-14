import { describe, expect, it } from "vitest";
import type { ScrapedProfile } from "../../adapters/apify.js";
import { topBuyerPersonas } from "../strategy.js";

function profile(title: string): ScrapedProfile {
  return {
    linkedinUrl: "https://www.linkedin.com/in/test-profile",
    firstName: "Test",
    lastName: "Profile",
    title,
    company: "Test Company",
    enrichmentData: {},
  };
}

describe("Strategy buyer personas", () => {
  it("groups clean structured titles instead of captured LinkedIn bio headlines", () => {
    const personas = topBuyerPersonas([
      profile("Founder & Principal Consultant"),
      profile("Founder & CEO"),
      profile("Founder & CEO"),
      profile("Founder and CEO"),
    ]);

    expect(personas).toEqual([
      { title: "Founder & CEO", count: 2 },
      { title: "Founder & Principal Consultant", count: 1 },
      { title: "Founder and CEO", count: 1 },
    ]);
  });
});
