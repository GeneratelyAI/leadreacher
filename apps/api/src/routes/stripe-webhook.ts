import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { ValidationError } from "../lib/errors.js";
import { errorResponses, stripeSecurity } from "../lib/openapi.js";
import { prisma } from "../lib/prisma.js";
import { verifyStripeWebhookEvent, type StripeWebhookEvent } from "../lib/stripe.js";
import {
  synchronizeStripeCheckoutSession,
  synchronizeStripeSubscription,
} from "../services/stripe-subscription-sync.js";

function isUniqueViolation(error: unknown): boolean {
  return (
    error !== null &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

async function reserveWebhookEvent(event: StripeWebhookEvent): Promise<boolean> {
  try {
    await prisma.stripeWebhookEvent.create({
      data: { eventId: event.id, type: event.type },
    });
    return true;
  } catch (error) {
    if (isUniqueViolation(error)) return false;
    throw error;
  }
}

export async function processStripeWebhookEvent(
  event: StripeWebhookEvent,
): Promise<{ duplicate: boolean }> {
  const reserved = await reserveWebhookEvent(event);
  if (!reserved) return { duplicate: true };

  try {
    if (event.type === "checkout.session.completed") {
      await synchronizeStripeCheckoutSession(event.data.object);
    } else if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      await synchronizeStripeSubscription(event.data.object);
    }
    return { duplicate: false };
  } catch (error) {
    await prisma.stripeWebhookEvent.delete({ where: { eventId: event.id } });
    throw error;
  }
}

export async function stripeWebhookRoutes(app: FastifyInstance): Promise<void> {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.post(
    "/webhooks/stripe",
    {
      config: { rawBody: true },
      schema: {
        tags: ["Webhooks"],
        summary: "Stripe billing webhook",
        description:
          "Receives Stripe events. Authenticate with stripe-signature. Do not try from Scalar.",
        security: [...stripeSecurity],
      },
    },
    async (request, reply) => {
      if (!request.rawBody) throw new ValidationError("Missing raw webhook body");

      const rawBody = Buffer.isBuffer(request.rawBody)
        ? request.rawBody
        : Buffer.from(request.rawBody);
      const header = request.headers["stripe-signature"];
      const signature = typeof header === "string" ? header : header?.[0];
      let event: StripeWebhookEvent;
      try {
        event = verifyStripeWebhookEvent(rawBody, signature);
      } catch {
        throw new ValidationError("Invalid Stripe signature");
      }

      const result = await processStripeWebhookEvent(event);
      return reply.send(
        result.duplicate ? { received: true, duplicate: true } : { received: true },
      );
    },
  );
}
