import { describe, expect, it } from "vitest";
import { buildSetupReview } from "../setup-review";

const linkedIn = {
  platform: "linkedin",
  accountName: "Alex at Acme",
  status: "active",
};

describe("saved final setup review", () => {
  it("uses saved audience, explicit content, approved style and purchased active channels", () => {
    const items = buildSetupReview(
      {
        campaignType: "personalized_outreach",
        icpDefinition: {
          prospectProfile: { decisionMakers: ["Founder", "VP of Sales"] },
          contentChoice: "personalized-video",
          approvedContent: {
            type: "Personalized video",
            style: "professional",
          },
        },
        channels: { selected: ["linkedin"] },
      },
      [
        linkedIn,
        { platform: "email", accountName: "a@acme.example", status: "active" },
      ],
    );
    expect(items.map((item) => item.value)).toEqual([
      "Founder · VP of Sales",
      "Personalized video",
      "Professional",
      "LinkedIn",
    ]);
    expect(items.map((item) => item.step)).toEqual([
      "discovery",
      "campaign-content",
      "personalized-video-style",
      "channels",
    ]);
  });

  it("does not infer Document from the shared uploaded_video campaign type", () => {
    const uploaded = buildSetupReview({ campaignType: "uploaded_video" }, []);
    expect(uploaded.find((item) => item.key === "content")?.value).toBe(
      "Your video",
    );
    expect(uploaded.some((item) => item.key === "style")).toBe(false);
    const document = buildSetupReview(
      {
        campaignType: "uploaded_video",
        icpDefinition: { contentChoice: "document" },
      },
      [],
    );
    expect(document.find((item) => item.key === "content")?.value).toBe(
      "Document",
    );
  });

  it("uses the real saved audience summary when one exists", () => {
    const items = buildSetupReview(
      {
        icpDefinition: {
          discoverySummary: { audience: "Founders and sales teams" },
          prospectProfile: {
            decisionMakers: ["Founder", "VP of Sales", "Head of Growth"],
          },
        },
      },
      [],
    );
    expect(items.find((item) => item.key === "audience")?.value).toBe(
      "Founders and sales teams",
    );
  });

  it("keeps failed and pending accounts out of confirmed connections", () => {
    const items = buildSetupReview(
      { channels: { selected: ["linkedin", "email"] } },
      [
        { ...linkedIn, status: "reconnecting" },
        { platform: "email", accountName: null, status: "error" },
      ],
    );
    expect(items.find((item) => item.key === "channels")?.value).toBe(
      "No purchased channel connected yet",
    );
  });

  it("does not invent campaign decisions when the saved record has no details", () => {
    const items = buildSetupReview({}, []);
    expect(items.find((item) => item.key === "content")?.value).toBe(
      "No content selected yet",
    );
    expect(items.find((item) => item.key === "audience")?.value).toBe(
      "No audience saved yet",
    );
    expect(items.every((item) => !item.value.includes("draft"))).toBe(true);
  });

  it("keeps long saved audience values complete and routes AI style editing correctly", () => {
    const role =
      "International enterprise operations and business development directors";
    const items = buildSetupReview(
      {
        campaignType: "ai_video_ad",
        videoConfig: { tone: "casual" },
        icpDefinition: { prospectProfile: { decisionMakers: [role] } },
      },
      [],
    );
    expect(items.find((item) => item.key === "audience")?.value).toBe(role);
    expect(items.find((item) => item.key === "style")?.step).toBe(
      "ai-video-style",
    );
  });
});
