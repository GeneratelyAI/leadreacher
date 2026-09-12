import { describe, expect, it, vi } from "vitest";

const { env } = vi.hoisted(() => ({
  env: {
    STRIPE_MOCK_MODE: true,
    STRIPE_PRICE_PERSONALIZED_OUTREACH: "price_personalized",
    STRIPE_PRICE_AI_VIDEO_AD: "price_ai_video",
    STRIPE_PRICE_UPLOADED_VIDEO: "price_uploaded_video",
    STRIPE_PRICE_VIDEO_ADDON: "price_video_addon",
    STRIPE_PRICE_ADDITIONAL_CHANNEL: "price_additional_channel",
  },
}));

vi.mock("../../../platform/config/env.js", () => ({ env }));

import { buildPricingCatalog } from "../public/pricing.js";

describe("buildPricingCatalog", () => {
  it.each([
    ["email", "linkedin"],
    ["linkedin", "email"],
    ["email"],
    ["email", "linkedin", "email"],
  ])("always includes only LinkedIn for selection %j", (...selectedChannels) => {
    const catalog = buildPricingCatalog({
      campaignType: "personalized_outreach",
      videoConfig: { enabled: false, mode: null, source: null, tone: null, uploadedVideoUrl: null },
      selectedChannels,
    });
    expect(catalog.includedChannels).toEqual(selectedChannels.includes("linkedin") ? ["linkedin"] : []);
    expect(catalog.lineItems.filter((item) => item.key === "additional_channel").map((item) => item.channel)).toEqual(["email"]);
  });

  it("maps a campaign type and enabled video decision to Stripe price ids", () => {
    expect(
      buildPricingCatalog({
        campaignType: "personalized_outreach",
        videoConfig: {
          enabled: true,
          mode: "personalized",
          source: "generated",
          tone: "professional",
          uploadedVideoUrl: null,
        },
        selectedChannels: ["linkedin", "email", "whatsapp"],
      }),
    ).toEqual({
      includedChannels: ["linkedin"],
      lineItems: [
        {
          key: "personalized_outreach",
          priceId: "price_personalized",
          label: "Personalized outreach",
        },
        {
          key: "additional_channel",
          priceId: "price_additional_channel",
          label: "Email channel",
          channel: "email",
        },
        {
          key: "additional_channel",
          priceId: "price_additional_channel",
          label: "Whatsapp channel",
          channel: "whatsapp",
        },
        {
          key: "video_addon",
          priceId: "price_video_addon",
          label: "Personalized video",
        },
      ],
    });
  });

  it("does not add personalized video when video is disabled", () => {
    expect(
      buildPricingCatalog({
        campaignType: "uploaded_video",
        videoConfig: {
          enabled: false,
          mode: null,
          source: null,
          tone: null,
          uploadedVideoUrl: null,
        },
        selectedChannels: ["linkedin"],
      }),
    ).toEqual({
      includedChannels: ["linkedin"],
      lineItems: [
        {
          key: "uploaded_video",
          priceId: "price_uploaded_video",
          label: "Uploaded video outreach",
        },
      ],
    });
  });

  it("rejects an incomplete real Stripe price configuration", () => {
    env.STRIPE_MOCK_MODE = false;
    env.STRIPE_PRICE_AI_VIDEO_AD = "";

    expect(() =>
      buildPricingCatalog({
        campaignType: "ai_video_ad",
        videoConfig: {
          enabled: false,
          mode: null,
          source: null,
          tone: null,
          uploadedVideoUrl: null,
        },
        selectedChannels: ["linkedin"],
      }),
    ).toThrow("STRIPE_PRICE_AI_VIDEO_AD");

    env.STRIPE_MOCK_MODE = true;
    env.STRIPE_PRICE_AI_VIDEO_AD = "price_ai_video";
  });
});
