import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { ValidationError } from "../lib/errors.js";
import {
  errorResponses,
  stripeSecurity,
} from "../lib/openapi.js";
import { prisma } from "../lib/prisma.js";
import { videoGenerationQueue } from "../lib/queue.js";
import { verifyStripeWebhookEvent, type StripeWebhookEvent } from "../lib/stripe.js";
import { subscriptionIsEntitled, synchronizeBillingSuspension } from "../services/entitlements.js";
import { enqueueOrganizationEmail } from "../services/product-email-outbox.js";

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function readString(record: JsonRecord, key: string): string | null {
  const value = record[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function readMetadata(record: JsonRecord): JsonRecord {
  return asRecord(record.metadata);
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error !== null &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

function readSubscriptionPriceId(subscription: JsonRecord): string | null {
  const items = asRecord(subscription.items);
  const data = items.data;
  if (!Array.isArray(data) || data.length === 0) {
    return null;
  }

  return readString(asRecord(asRecord(data[0]).price), "id");
}

function readCurrentPeriodEnd(subscription: JsonRecord): Date | null {
  const value = subscription.current_period_end;
  return typeof value === "number" && Number.isFinite(value)
    ? new Date(value * 1000)
    : null;
}

async function resolveOrganizationForEvent(
  object: JsonRecord,
): Promise<{ id: string; subscriptionStatus: string | null } | null> {
  const metadata = readMetadata(object);
  const orgId = readString(metadata, "orgId") ?? readString(object, "client_reference_id");
  if (orgId) {
    return prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true, subscriptionStatus: true },
    });
  }

  const customerId = readString(object, "customer");
  if (!customerId) {
    return null;
  }

  return prisma.organization.findUnique({
    where: { stripeCustomerId: customerId },
    select: { id: true, subscriptionStatus: true },
  });
}

async function enqueueActivationVideoIfEligible(orgId: string): Promise<void> {
  const strategy = await prisma.strategy.findFirst({
    where: { orgId },
    orderBy: { updatedAt: "desc" },
    select: { id: true, campaignType: true, videoConfig: true },
  });
  const videoConfig = asRecord(strategy?.videoConfig);
  if (
    !strategy ||
    videoConfig.enabled !== true ||
    videoConfig.source !== "generated"
  ) {
    return;
  }

  const pipeline =
    strategy.campaignType === "personalized_outreach" &&
    videoConfig.mode === "personalized"
      ? "personalized"
      : "standard";

  const campaign = await prisma.campaign.findFirst({
    where: { orgId, strategyId: strategy.id },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });
  if (pipeline === "personalized") {
    if (!campaign) return;
    await videoGenerationQueue.add(
      "personalized-template-orchestrate",
      {
        orgId,
        campaignId: campaign.id,
        pipeline,
        jobType: "template-orchestrate",
      },
      {
        jobId: `personalized-template:${campaign.id}:1`,
      },
    );
    return;
  }

  const lead = await prisma.lead.findFirst({
    where: { orgId },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!campaign || !lead) {
    return;
  }

  await videoGenerationQueue.add(
    "onboarding-video-generation",
    {
      orgId,
      campaignId: campaign.id,
      leadId: lead.id,
      pipeline,
      jobType: "orchestrate",
    },
    {
      jobId: `onboarding-video:${orgId}:${strategy.id}:${campaign.id}:${lead.id}`,
    },
  );
}

async function processCheckoutSessionCompleted(
  object: JsonRecord,
): Promise<void> {
  const organization = await resolveOrganizationForEvent(object);
  if (!organization) {
    return;
  }

  const metadata = readMetadata(object);
  const customerId = readString(object, "customer");
  const subscriptionId = readString(object, "subscription");
  await prisma.organization.update({
    where: { id: organization.id },
    data: {
      ...(customerId ? { stripeCustomerId: customerId } : {}),
      ...(subscriptionId ? { stripeSubscriptionId: subscriptionId } : {}),
      ...(readString(metadata, "planPriceId")
        ? { planPriceId: readString(metadata, "planPriceId") }
        : {}),
    },
  });
}

async function processSubscriptionLifecycle(object: JsonRecord): Promise<void> {
  const organization = await resolveOrganizationForEvent(object);
  if (!organization) {
    return;
  }

  const metadata = readMetadata(object);
  const status = readString(object, "status") ?? "unknown";
  const currentPeriodEnd = readCurrentPeriodEnd(object);
  const isActive = subscriptionIsEntitled({
    subscriptionStatus: status,
    currentPeriodEnd,
  });
  const customerId = readString(object, "customer");
  const subscriptionId = readString(object, "id");
  const planPriceId = readSubscriptionPriceId(object);
  const campaignType = readString(metadata, "campaignType");

  await prisma.organization.update({
    where: { id: organization.id },
    data: {
      ...(customerId ? { stripeCustomerId: customerId } : {}),
      ...(subscriptionId ? { stripeSubscriptionId: subscriptionId } : {}),
      subscriptionStatus: status,
      ...(planPriceId ? { planPriceId } : {}),
      ...(currentPeriodEnd
        ? { currentPeriodEnd }
        : {}),
      plan: isActive ? (campaignType ?? "starter") : "starter",
    },
  });

  if (isActive && organization.subscriptionStatus !== "active") {
    await enqueueActivationVideoIfEligible(organization.id);
  }
  await synchronizeBillingSuspension(organization.id);
  if (!isActive && ["past_due", "unpaid", "incomplete", "incomplete_expired"].includes(status)) {
    await enqueueOrganizationEmail({
      orgId: organization.id,
      idempotencyKey: `billing-access:${subscriptionId ?? organization.id}:${status}:${currentPeriodEnd?.toISOString() ?? "none"}`,
      template: "billing_access_interrupted",
      subject: "LeadReacher outreach paused because of billing",
      text: `Your subscription is ${status}. Active campaigns have been paused before any further sends. Update billing in LeadReacher to restore access.`,
    });
  }
}

async function reserveWebhookEvent(event: StripeWebhookEvent): Promise<boolean> {
  try {
    await prisma.stripeWebhookEvent.create({
      data: { eventId: event.id, type: event.type },
    });
    return true;
  } catch (error) {
    if (isUniqueViolation(error)) {
      return false;
    }
    throw error;
  }
}

export async function processStripeWebhookEvent(
  event: StripeWebhookEvent,
): Promise<{ duplicate: boolean }> {
  const reserved = await reserveWebhookEvent(event);
  if (!reserved) {
    return { duplicate: true };
  }

  try {
    const object = asRecord(event.data.object);
    if (event.type === "checkout.session.completed") {
      await processCheckoutSessionCompleted(object);
    } else if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      await processSubscriptionLifecycle(object);
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
      if (!request.rawBody) {
        throw new ValidationError("Missing raw webhook body");
      }

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
        result.duplicate
          ? { received: true, duplicate: true }
          : { received: true },
      );
    },
  );
}
