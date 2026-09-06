import { describe, expect, it } from "vitest";
import { createSemanticCampaignSummary } from "../campaign-summary";

const status = {
  status: "completed" as const,
  url: "https://acme.example",
  market: "B2B revenue teams",
  offer: "Automated personalized outreach",
  audience: "Founders, sales leaders, and growth teams",
  value: "More qualified conversations with less manual work",
  strategyStatus: "ready",
  prospectProfile: {
    decisionMakers: ["Founder", "VP of Sales"],
    companyTypes: ["B2B SaaS"],
    industries: ["Technology"],
    locations: ["Canada"],
  },
  error: null,
};

describe("createSemanticCampaignSummary", () => {
  it("groups real discovery data into completed business and targeting sections", () => {
    const campaign = createSemanticCampaignSummary(status);

    expect(campaign.sections).toEqual([
      {
        id: "business",
        label: "Business",
        value: "B2B revenue teams\nAutomated personalized outreach",
      },
      {
        id: "targeting",
        label: "Targeting",
        value: "Founder · VP of Sales\nB2B SaaS\nTechnology\nCanada",
      },
    ]);
    expect(campaign.site).toEqual({
      label: "acme.example",
      iconUrl: "/logo/leadreacher_icon_colored.svg",
    });
  });

  it("adds the completed content selection only after a content flow provides it", () => {
    expect(createSemanticCampaignSummary(status, {
      type: "Personalized video",
      style: "Professional",
    }).sections?.at(-1)).toEqual({
      id: "content",
      label: "Content",
      value: "Personalized video · Professional",
    });
  });
});
