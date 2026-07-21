import { describe, expect, it, vi } from "vitest";

const { env } = vi.hoisted(() => ({
  env: {
    STRIPE_MOCK_MODE: true,
    STRIPE_PRICE_PERSONALIZED_OUTREACH: "price_personalized",
    STRIPE_PRICE_AI_VIDEO_AD: "price_ai_video",
    STRIPE_PRICE_UPLOADED_VIDEO: "price_uploaded_video",
    STRIPE_PRICE_VIDEO_ADDON: "price_video_addon",
  },
}));

vi.mock("../../../config/env.js", () => ({ env }));

import { buildPricingCatalog } from "../pricing.js";

describe("buildPricingCatalog", () => {
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
      }),
    ).toEqual({
      lineItems: [
        {
          key: "personalized_outreach",
          priceId: "price_personalized",
          label: "Personalized outreach",
        },
        {
          key: "video_addon",
          priceId: "price_video_addon",
          label: "Video personalization",
        },
      ],
    });
  });

  it("adds a video add-on even when a stale caller sends disabled video", () => {
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
      }),
    ).toEqual({
      lineItems: [
        {
          key: "uploaded_video",
          priceId: "price_uploaded_video",
          label: "Uploaded video outreach",
        },
        {
          key: "video_addon",
          priceId: "price_video_addon",
          label: "Video personalization",
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
      }),
    ).toThrow("STRIPE_PRICE_AI_VIDEO_AD");

    env.STRIPE_MOCK_MODE = true;
    env.STRIPE_PRICE_AI_VIDEO_AD = "price_ai_video";
  });
});
