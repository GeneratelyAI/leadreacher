import Stripe from "stripe";
import { z } from "zod";
import { env } from "../config/env.js";

export const MOCK_STRIPE_WEBHOOK_SIGNATURE = "stripe-mock-signature";

export type StripePriceDisplay = {
  priceId: string;
  unitAmount: number | null;
  currency: string | null;
  interval: string | null;
};

export type SubscriptionCheckoutInput = {
  orgId: string;
  strategyId: string;
  campaignType: string;
  videoEnabled: boolean;
  priceIds: string[];
  customerId: string | null;
};

export type SubscriptionCheckoutSession = {
  id: string;
  url: string;
};

export type BillingPortalSession = {
  url: string;
};

const MockStripeEventSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  data: z.object({ object: z.record(z.string(), z.unknown()) }),
});

export type StripeWebhookEvent = z.infer<typeof MockStripeEventSchema>;

let stripeClient: Stripe | undefined;

function getStripeClient(): Stripe {
  if (!stripeClient) {
    stripeClient = new Stripe(env.STRIPE_SECRET_KEY);
  }

  return stripeClient;
}

export async function getStripePrice(priceId: string): Promise<StripePriceDisplay> {
  if (env.STRIPE_MOCK_MODE) {
    return {
      priceId,
      unitAmount: null,
      currency: null,
      interval: "month",
    };
  }

  const price = await getStripeClient().prices.retrieve(priceId);
  return {
    priceId: price.id,
    unitAmount: price.unit_amount,
    currency: price.currency,
    interval: price.recurring?.interval ?? null,
  };
}

export async function createSubscriptionCheckoutSession(
  input: SubscriptionCheckoutInput,
): Promise<SubscriptionCheckoutSession> {
  if (env.STRIPE_MOCK_MODE) {
    const id = `mock_checkout_${input.orgId}`;
    return {
      id,
      url: `${env.APP_URL}/onboarding?step=checkout&status=success&session_id=${encodeURIComponent(id)}`,
    };
  }

  const metadata = {
    orgId: input.orgId,
    strategyId: input.strategyId,
    campaignType: input.campaignType,
    videoEnabled: String(input.videoEnabled),
  };
  const session = await getStripeClient().checkout.sessions.create({
    mode: "subscription",
    line_items: input.priceIds.map((price) => ({ price, quantity: 1 })),
    ...(input.customerId ? { customer: input.customerId } : {}),
    client_reference_id: input.orgId,
    metadata,
    subscription_data: { metadata },
    success_url: `${env.APP_URL}/onboarding?step=checkout&status=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.APP_URL}/onboarding?step=checkout&status=cancelled`,
  });

  if (!session.url) {
    throw new Error("Stripe did not return a Checkout URL");
  }

  return { id: session.id, url: session.url };
}

export async function createBillingPortalSession(
  customerId: string,
): Promise<BillingPortalSession> {
  if (env.STRIPE_MOCK_MODE) {
    return {
      url: `${env.APP_URL}/home?billing=portal`,
    };
  }

  const session = await getStripeClient().billingPortal.sessions.create({
    customer: customerId,
    return_url: env.APP_URL,
  });

  return { url: session.url };
}

export function verifyStripeWebhookEvent(
  rawBody: Buffer,
  signature: string | undefined,
): StripeWebhookEvent {
  if (env.STRIPE_MOCK_MODE) {
    if (signature !== MOCK_STRIPE_WEBHOOK_SIGNATURE) {
      throw new Error("Invalid Stripe mock webhook signature");
    }

    return MockStripeEventSchema.parse(JSON.parse(rawBody.toString("utf8")));
  }

  if (!signature) {
    throw new Error("Missing Stripe signature");
  }

  const event = getStripeClient().webhooks.constructEvent(
    rawBody,
    signature,
    env.STRIPE_WEBHOOK_SECRET,
  );
  return MockStripeEventSchema.parse(event);
}

export function createMockStripeWebhookEvent(input: StripeWebhookEvent): {
  body: Buffer;
  signature: string;
} {
  return {
    body: Buffer.from(JSON.stringify(MockStripeEventSchema.parse(input))),
    signature: MOCK_STRIPE_WEBHOOK_SIGNATURE,
  };
}
