import { describe, expect, it } from "vitest";
import { createCompactCampaignFields, createFutureCampaignSections, createLiveCampaignSummary } from "../campaign-summary";

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

describe("live campaign summary", () => {
  it("writes complete compact field values and customer segment bubbles", () => {
    const fields = createCompactCampaignFields({
      ...status,
      offer: "Fully managed, AI-powered multichannel lead generation and cold outreach automation",
      audience: "Marketing directors and revenue leaders at mid-market companies",
      value: "Highest conversion rates through end-to-end multichannel integration and precision targeting",
      strategyStatus: "Establish outreach positioning for senior revenue and marketing stakeholders across global markets",
    });

    expect(fields).toEqual([
      { label: "Market", value: "B2B revenue teams" },
      { label: "Offer", value: "AI-powered lead generation with personalized outreach automation." },
      { label: "Customers", values: ["Marketing directors", "Revenue leaders", "Founder", "Sales leaders"] },
      { label: "Value", value: "Higher conversion rates from relevant, well-targeted outreach." },
      { label: "Goal", value: "Position outreach for marketing directors and revenue leaders to start qualified sales conversations." },
    ]);
  });

  it("keeps Signup to the website row and its building status", () => {
    const campaign = createLiveCampaignSummary(status, "signup");

    expect(campaign).toMatchObject({
      status: "learning",
      statusLabel: "Building your campaign",
      fields: [],
      site: { label: "acme.example" },
    });
    expect(campaign.sections).toBeUndefined();
  });

  it("progresses Business, Targeting, and Content without duplicating completed state", () => {
    const discovery = createLiveCampaignSummary(status, "discovery");
    const howItWorks = createLiveCampaignSummary(status, "how-it-works");
    const content = createLiveCampaignSummary(status, "campaign-content");
    const chosen = createLiveCampaignSummary(status, "chosen-content", {
      type: "Personalized video",
      style: "Professional",
    });

    expect(discovery.sections).toBeUndefined();
    expect(discovery.fields.map((field) => field.label)).toEqual([
      "Market", "Offer", "Customers", "Value", "Goal",
    ]);
    expect(howItWorks.sections).toMatchObject([
      { id: "business", state: "complete" },
      { id: "targeting", state: "pending", pendingLabel: "Preparing your audience" },
    ]);
    expect(howItWorks.sections?.[0]?.fields?.map((field) => field.label)).toEqual([
      "Market", "Offer", "Customers", "Value", "Goal",
    ]);
    expect(content.sections).toMatchObject([
      { id: "business", state: "complete" },
      { id: "targeting", state: "complete" },
      { id: "content", state: "pending", pendingLabel: "Choosing content" },
    ]);
    expect(chosen.sections?.at(-1)).toMatchObject({
      id: "content",
      state: "complete",
      value: "Personalized video · Professional",
    });
  });

  it("keeps long targeting values whole and keeps customer values as content-sized chips", () => {
    const longStatus = {
      ...status,
      prospectProfile: {
        ...status.prospectProfile,
        decisionMakers: ["Chief Revenue Operations Officer", "Vice President of International Partnerships"],
      },
    };
    const campaign = createLiveCampaignSummary(longStatus, "campaign-content");
    const targeting = campaign.sections?.find((section) => section.id === "targeting");
    const customers = createLiveCampaignSummary(status, "discovery").fields
      ?.find((field) => field.label === "Customers");

    expect(targeting?.fields?.[0]).toEqual({
      label: "Decision makers",
      value: "Chief Revenue Operations Officer · Vice President of International Partnerships",
    });
    expect(customers?.values).toEqual(["Founders", "Sales leaders", "Growth teams", "Founder"]);
  });

  it("creates compact inactive rows for future campaign steps through the shared sections API", () => {
    expect(createFutureCampaignSections([
      { id: "message", label: "Message" },
      { id: "channels", label: "Channels", statusLabel: "Up next" },
      { id: "launch", label: "Launch" },
    ])).toEqual([
      { id: "message", label: "Message", state: "future", pendingLabel: "Next" },
      { id: "channels", label: "Channels", state: "future", pendingLabel: "Up next" },
      { id: "launch", label: "Launch", state: "future", pendingLabel: "Next" },
    ]);
  });
});
