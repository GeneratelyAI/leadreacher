import { describe, expect, it } from "vitest";
import { createConfirmedCampaignSummary } from "../campaign-summary";
import type { WebsiteScrapeStatus } from "@/hooks/useWebsiteScrapeStatus";

const profile = { decisionMakers: ["Founder"], companyTypes: ["SaaS"], industries: ["Software"], locations: ["Canada"] };
const status = { status: "completed", url: "https://acme.example", market: "Software", offer: "Sales planning software", audience: "Revenue teams", value: "Less manual planning", strategyStatus: "Plan outreach", prospectProfile: profile } as WebsiteScrapeStatus;

describe("confirmed campaign sections", () => {
  it("does not complete suggested audiences, sample videos, or unselected channels", () => {
    const pill = createConfirmedCampaignSummary(status, { icpDefinition: { onboarding: { introductionSeen: true, prospectsApproved: false }, prospectProfile: profile }, videoConfig: { tone: "professional" } });
    expect(pill.sections?.map((section) => [section.label, section.state])).toEqual([
      ["Business", "complete"], ["Prospects", "future"], ["Content", "future"], ["Channels", "future"],
    ]);
    expect(pill.sections?.[0].summary).toBe("Sales planning software");
  });
  it("reads saved decisions and never equates channel selection with connection", () => {
    const pill = createConfirmedCampaignSummary(status, {
      icpDefinition: { onboarding: { prospectsApproved: true }, prospectProfile: profile, approvedContent: { type: "Document", documentName: "Case study.pdf" } },
      channels: { selected: ["linkedin", "email"] },
    });
    expect(pill.sections?.every((section) => section.state === "complete")).toBe(true);
    expect(pill.sections?.[1].summary).toContain("Founder");
    expect(pill.sections?.[2].summary).toBe("Document · Case study.pdf");
    expect(JSON.stringify(pill)).not.toMatch(/connected/i);
    expect(pill.site?.label).toBe("acme.example");
  });
});
