import { describe, expect, it } from "vitest";
import {
  createCompactCampaignFields,
  createConfirmedCampaignSummary,
  createFutureCampaignSections,
  createLiveCampaignSummary,
  presentCampaignSectionSummary,
} from "../../public/summary";

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

  it("preserves selected channel order as values for the shared campaign pill", () => {
    const campaign = createConfirmedCampaignSummary(status, {
      channels: { selected: ["linkedin", "whatsapp", "instagram", "facebook", "email"] },
    });

    expect(campaign.sections?.find((section) => section.id === "channels")).toMatchObject({
      state: "complete",
      fields: [{ label: "Selected channels", values: ["linkedin", "whatsapp", "instagram", "facebook", "Gmail"] }],
    });
  });

  it("writes concise brief sentences from varied saved analysis without company-specific copy", () => {
    const campaign = createConfirmedCampaignSummary({
      ...status,
      offer: "A workflow platform that coordinates customer support operations",
      value: "Faster, more consistent customer responses",
      prospectProfile: {
        decisionMakers: ["Head of Customer Experience"],
        companyTypes: ["Mid-market"],
        industries: ["Retail"],
        locations: ["United Kingdom"],
      },
    }, {
      icpDefinition: {
        onboarding: { prospectsApproved: true },
        prospectProfile: {
          decisionMakers: ["Head of Customer Experience"],
          companyTypes: ["Mid-market"],
          industries: ["Retail"],
          locations: ["United Kingdom"],
        },
        approvedContent: { type: "Personalized video", style: "professional" },
      },
      videoConfig: { tone: "professional", source: "generated" },
      messagingAngles: {
        outreachMessage: "A short approved message.",
        outreachMessageApprovedAt: "2026-09-13T00:00:00.000Z",
        cta: { label: "Book a conversation", url: "https://example.test/demo" },
      },
      subscriptionStatus: "active",
    });

    const summaries = Object.fromEntries(campaign.sections!.map((section) => [section.id, section.summary]));
    expect(summaries.business).toBe("A workflow platform that coordinates customer support operations for faster, more consistent customer responses.");
    expect(summaries.targeting).toBe("Reaches Head of Customer Experience at Mid-market companies in Retail across United Kingdom.");
    expect(summaries.content).toBe("Personalized video in a professional style.");
    expect(summaries.message).toBe("Invites prospects to book a conversation.");
    expect(summaries.subscription).toBe("Subscription is active.");
    expect(JSON.stringify(campaign)).not.toMatch(/clay/i);
  });

  it("uses an honest fallback when saved website analysis is incomplete", () => {
    const campaign = createConfirmedCampaignSummary({
      ...status,
      status: "completed",
      market: "",
      offer: "",
      audience: "",
      value: "",
      strategyStatus: "",
      prospectProfile: { decisionMakers: [], companyTypes: [], industries: [], locations: [] },
    }, null);

    expect(campaign.sections?.find((section) => section.id === "business")).toMatchObject({
      state: "future",
      pendingLabel: "Campaign details are being prepared",
    });
    expect(campaign.sections?.find((section) => section.id === "subscription")).toMatchObject({
      pendingLabel: "Choose a subscription to continue",
    });
  });

  it("normalizes transient content selections without changing their saved identity", () => {
    expect(presentCampaignSectionSummary({
      id: "content",
      summary: "Personalized video · Casual",
      value: "Personalized video · Casual",
    })).toBe("Personalized video in a casual style.");
    expect(presentCampaignSectionSummary({
      id: "content",
      summary: "Personalized video in a casual style.",
      value: "Personalized video · Casual",
    })).toBe("Personalized video in a casual style.");
    expect(presentCampaignSectionSummary({
      id: "content",
      summary: "Document · Case study.pdf",
      value: "Document · Case study.pdf",
    })).toBe("Document: Case study.pdf.");
  });
});
