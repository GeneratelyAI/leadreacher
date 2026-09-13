import { describe, expect, it } from "vitest";
import {
  mobileCampaignSections,
  shortSavedCustomerSegments,
} from "../mobile-campaign-summary";
import type { PillData } from "../../public/pill";

describe("mobile saved campaign presentation", () => {
  it("keeps an unapproved style draft unapproved in the mobile summary", () => {
    const campaign: PillData = {
      fields: [],
      sections: [{ id: "content", label: "Content", state: "draft", value: "Personalized video · Casual" }],
    };
    const sections = mobileCampaignSections(campaign);
    expect(sections.map(({ id, state }) => ({ id, state }))).toEqual([
      { id: "content", state: "draft" },
      { id: "style", state: "draft" },
    ]);
    expect(campaign.sections).toHaveLength(1);
    expect(campaign.sections?.[0].value).toBe("Personalized video · Casual");
  });

  it("does not invent business details for a new campaign", () => {
    expect(mobileCampaignSections({ fields: [], status: "learning" })).toEqual(
      [],
    );
  });

  it("presents flat Discovery data as Business without changing saved fields", () => {
    const campaign: PillData = {
      fields: [{ label: "Market", value: "B2B revenue teams" }],
      statusLabel: "Business understood",
    };
    const result = mobileCampaignSections(campaign);
    expect(result).toEqual([
      {
        id: "business",
        label: "Business",
        summary: "Business understood",
        fields: campaign.fields,
      },
    ]);
    expect(result[0].fields).toBe(campaign.fields);
    expect(campaign.sections).toBeUndefined();
  });

  it("summarizes saved targeting counts while retaining every underlying detail", () => {
    const fields = [
      {
        label: "Decision makers",
        value:
          "Operations Manager · Digital marketing managers · Revenue Leader",
      },
      { label: "Locations", value: "Canada · United States" },
      { label: "Industries", value: "Professional services" },
    ];
    const campaign: PillData = {
      fields: [],
      sections: [
        { id: "targeting", label: "Targeting", fields, state: "complete" },
      ],
    };
    expect(mobileCampaignSections(campaign)).toEqual([
      {
        id: "targeting",
        label: "Audience",
        summary: "3 roles, 2 locations",
        fields,
        state: "complete",
      },
    ]);
    expect(campaign.sections?.[0].label).toBe("Targeting");
    expect(mobileCampaignSections(campaign)[0].fields).toBe(fields);
    expect(
      mobileCampaignSections({
        fields: [],
        sections: [
          {
            id: "targeting",
            label: "Targeting",
            fields: [
              { label: "Decision makers", value: "Founder" },
              { label: "Locations", value: "Canada" },
            ],
          },
        ],
      })[0].summary,
    ).toBe("1 role, 1 location");
  });

  it("separates an approved style without inventing a style for uploaded content", () => {
    const sections = [
      {
        id: "content",
        label: "Content",
        state: "complete" as const,
        value: "Personalized video · Professional",
      },
      {
        id: "channels",
        label: "Channels",
        state: "future" as const,
        pendingLabel: "Next",
      },
    ];
    expect(mobileCampaignSections({ fields: [], sections })).toEqual([
      {
        ...sections[0],
        summary: "Personalized video",
        value: "Personalized video",
      },
      {
        id: "style",
        label: "Style",
        summary: "Professional",
        value: "Professional",
        state: "complete",
      },
      sections[1],
    ]);
    for (const value of [
      "Document",
      "Your video",
      "AI video · Pending",
      "Personalized video · Professional · Extra saved detail",
    ]) {
      const original = { id: "content", label: "Content", value };
      expect(
        mobileCampaignSections({ fields: [], sections: [original] }),
      ).toEqual([original]);
    }
    expect(sections[0].value).toBe("Personalized video · Professional");
  });
});

describe("short saved customer segments", () => {
  it("uses only complete one- or two-word saved audience segments", () => {
    expect(
      shortSavedCustomerSegments("Founders, Sales leaders, and Growth teams"),
    ).toEqual(["Founders", "Sales leaders", "Growth teams"]);
    expect(
      shortSavedCustomerSegments("  Brand directors AND Founders  "),
    ).toEqual(["Brand directors", "Founders"]);
  });

  it("never truncates prose or turns an empty value into a fabricated chip", () => {
    expect(shortSavedCustomerSegments("")).toBeNull();
    expect(shortSavedCustomerSegments(" , and ")).toBeNull();
    expect(
      shortSavedCustomerSegments("Founders, Vice President of Partnerships"),
    ).toBeNull();
    expect(
      shortSavedCustomerSegments(
        "Revenue teams seeking more qualified conversations",
      ),
    ).toBeNull();
  });
});
