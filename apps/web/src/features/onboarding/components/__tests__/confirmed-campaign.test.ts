import { describe, expect, it } from "vitest";
import { createConfirmedCampaignSummary } from "../../public/summary";
import type { WebsiteScrapeStatus } from "@/features/onboarding/public/website-status";

const profile = { decisionMakers: ["Founder"], companyTypes: ["SaaS"], industries: ["Software"], locations: ["Canada"] };
const status = { status: "completed", url: "https://acme.example", market: "Software", offer: "Sales planning software", audience: "Revenue teams", value: "Less manual planning", strategyStatus: "Plan outreach", prospectProfile: profile } as WebsiteScrapeStatus;

describe("confirmed campaign sections", () => {
  it("does not complete suggested audiences, sample videos, or unselected channels", () => {
    const pill = createConfirmedCampaignSummary(status, { icpDefinition: { onboarding: { introductionSeen: true, prospectsApproved: false }, prospectProfile: profile }, videoConfig: { tone: "professional" } });
    expect(pill.sections?.map((section) => [section.label, section.state])).toEqual([
      ["Business", "complete"], ["Prospects", "future"], ["Content", "future"], ["Message", "future"], ["Channels", "future"], ["Subscription", "future"],
    ]);
    expect(pill.sections?.[0].summary).toBe("Sales planning software for less manual planning.");
  });
  it("reads saved decisions and never equates channel selection with connection", () => {
    const pill = createConfirmedCampaignSummary(status, {
      icpDefinition: { onboarding: { prospectsApproved: true }, prospectProfile: profile, approvedContent: { type: "Document", documentName: "Case study.pdf" } },
      channels: { selected: ["linkedin", "email"] },
    });
    expect(pill.sections?.slice(0, 3).every((section) => section.state === "complete")).toBe(true);
    expect(pill.sections?.[1].summary).toContain("Founder");
    expect(pill.sections?.[2].summary).toBe("Document: Case study.pdf.");
    expect(pill.sections?.some((section) => section.id === "connections" || section.id === "review" || section.id === "live")).toBe(false);
    expect(pill.site?.label).toBe("acme.example");
  });

  it("keeps the shared pill limited to the six campaign setup sections", () => {
    const pill = createConfirmedCampaignSummary(status, {
      channels: { selected: ["linkedin", "email"] },
      subscriptionStatus: "active",
    });

    expect(pill.sections).toHaveLength(6);
    expect(pill.sections?.some((section) => section.id === "connections" || section.id === "review" || section.id === "live")).toBe(false);
  });
});
