import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyZodCompilers } from "../../lib/zod-compilers.js";

const { getStripePrice } = vi.hoisted(() => ({ getStripePrice: vi.fn() }));

vi.mock("../../config/env.js", () => ({
  env: {
    STRIPE_MOCK_MODE: true,
    STRIPE_PRICE_PERSONALIZED_OUTREACH: "",
    STRIPE_PRICE_AI_VIDEO_AD: "",
    STRIPE_PRICE_UPLOADED_VIDEO: "",
    STRIPE_PRICE_VIDEO_ADDON: "",
  },
}));
vi.mock("../../lib/stripe.js", () => ({ getStripePrice }));

import { publicPricingRoutes } from "../public-pricing.js";

describe("public pricing", () => {
  beforeEach(() => {
    getStripePrice.mockReset();
    getStripePrice.mockImplementation(async (priceId: string) => ({
      priceId,
      unitAmount: priceId.includes("video_addon") ? 500 : 1_000,
      currency: "usd",
      interval: "month",
    }));
  });

  it("returns Stripe-derived totals without authentication", async () => {
    const app = Fastify();
    applyZodCompilers(app);
    await app.register(publicPricingRoutes);

    const response = await app.inject({ method: "GET", url: "/public/pricing" });

    expect(response.statusCode).toBe(200);
    expect(response.json().plans).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          campaignType: "personalized_outreach",
          unitAmount: 1_500,
          currency: "usd",
        }),
      ]),
    );
    expect(getStripePrice).toHaveBeenCalledTimes(6);
    await app.close();
  });
});
