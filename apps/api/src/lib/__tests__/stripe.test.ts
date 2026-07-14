import { describe, expect, it, vi } from "vitest";

vi.mock("../../config/env.js", () => ({
  env: {
    STRIPE_MOCK_MODE: true,
    APP_URL: "http://localhost:3000",
  },
}));

import {
  createMockStripeWebhookEvent,
  MOCK_STRIPE_WEBHOOK_SIGNATURE,
  verifyStripeWebhookEvent,
} from "../stripe.js";

describe("Stripe mock mode", () => {
  it("creates a locally verifiable webhook event without Stripe credentials", () => {
    const event = {
      id: "evt_mock_subscription",
      type: "customer.subscription.created",
      data: {
        object: {
          id: "sub_mock",
          customer: "cus_mock",
          status: "active",
        },
      },
    };

    const { body, signature } = createMockStripeWebhookEvent(event);

    expect(signature).toBe(MOCK_STRIPE_WEBHOOK_SIGNATURE);
    expect(verifyStripeWebhookEvent(body, signature)).toEqual(event);
  });

  it("rejects an unsigned mock event", () => {
    const { body } = createMockStripeWebhookEvent({
      id: "evt_mock_invalid",
      type: "checkout.session.completed",
      data: { object: {} },
    });

    expect(() => verifyStripeWebhookEvent(body, "invalid")).toThrow(
      "Invalid Stripe mock webhook signature",
    );
  });
});
