import { prisma } from "../lib/prisma.js";
import { videoGenerationQueue } from "../lib/queue.js";
import { subscriptionIsEntitled, synchronizeBillingSuspension } from "./entitlements.js";
import { enqueueOrganizationEmail } from "./product-email-outbox.js";

type JsonRecord = Record<string, unknown>;

const BILLING_ACCESS_INTERRUPTED_STATUSES = new Set([
  "past_due",
  "unpaid",
  "incomplete",
  "incomplete_expired",
]);

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

function readSubscriptionPriceId(subscription: JsonRecord): string | null {
  const items = asRecord(subscription.items);
  const data = items.data;
  if (!Array.isArray(data) || data.length === 0) return null;
  return readString(asRecord(asRecord(data[0]).price), "id");
}

function readCurrentPeriodEnd(subscription: JsonRecord): Date | null {
  const value = subscription.current_period_end;
  return typeof value === "number" && Number.isFinite(value)
    ? new Date(value * 1000)
    : null;
}

async function resolveOrganizationForStripeObject(
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
  if (!customerId) return null;
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
  if (!strategy || videoConfig.enabled !== true || videoConfig.source !== "generated") return;

  const pipeline =
    strategy.campaignType === "personalized_outreach" && videoConfig.mode === "personalized"
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
      { orgId, campaignId: campaign.id, pipeline, jobType: "template-orchestrate" },
      { jobId: `personalized-template:${campaign.id}:1` },
    );
    return;
  }

  const lead = await prisma.lead.findFirst({
    where: { orgId },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!campaign || !lead) return;
  await videoGenerationQueue.add(
    "onboarding-video-generation",
    { orgId, campaignId: campaign.id, leadId: lead.id, pipeline, jobType: "orchestrate" },
    { jobId: `onboarding-video:${orgId}:${strategy.id}:${campaign.id}:${lead.id}` },
  );
}

export async function synchronizeStripeCheckoutSession(value: unknown): Promise<string | null> {
  const object = asRecord(value);
  const organization = await resolveOrganizationForStripeObject(object);
  if (!organization) return null;

  const metadata = readMetadata(object);
  const customerId = readString(object, "customer");
  const subscriptionId = readString(object, "subscription");
  const planPriceId = readString(metadata, "planPriceId");
  await prisma.organization.update({
    where: { id: organization.id },
    data: {
      ...(customerId ? { stripeCustomerId: customerId } : {}),
      ...(subscriptionId ? { stripeSubscriptionId: subscriptionId } : {}),
      ...(planPriceId ? { planPriceId } : {}),
    },
  });
  return organization.id;
}

export async function synchronizeStripeSubscription(value: unknown): Promise<{
  orgId: string;
  subscriptionStatus: string;
} | null> {
  const object = asRecord(value);
  const organization = await resolveOrganizationForStripeObject(object);
  if (!organization) return null;

  const metadata = readMetadata(object);
  const status = readString(object, "status") ?? "unknown";
  const currentPeriodEnd = readCurrentPeriodEnd(object);
  const isActive = subscriptionIsEntitled({ subscriptionStatus: status, currentPeriodEnd });
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
      ...(currentPeriodEnd ? { currentPeriodEnd } : {}),
      plan: isActive ? (campaignType ?? "starter") : "starter",
    },
  });

  if (isActive && organization.subscriptionStatus !== "active") {
    await enqueueActivationVideoIfEligible(organization.id);
  }
  await synchronizeBillingSuspension(organization.id);
  if (!isActive && BILLING_ACCESS_INTERRUPTED_STATUSES.has(status)) {
    await enqueueOrganizationEmail({
      orgId: organization.id,
      idempotencyKey: `billing-access:${subscriptionId ?? organization.id}:${status}:${currentPeriodEnd?.toISOString() ?? "none"}`,
      template: "billing_access_interrupted",
      subject: "LeadReacher outreach paused because of billing",
      text: `Your subscription is ${status}. Active campaigns have been paused before any further sends. Update billing in LeadReacher to restore access.`,
    });
  }
  return { orgId: organization.id, subscriptionStatus: status };
}

/** Reconcile an expanded Stripe Checkout Session after its redirect completes. */
export async function reconcileCompletedStripeCheckout(value: unknown): Promise<{
  orgId: string | null;
  subscriptionStatus: string | null;
}> {
  const session = asRecord(value);
  const orgId = await synchronizeStripeCheckoutSession(session);
  const subscription = asRecord(session.subscription);
  if (!readString(subscription, "id")) {
    return { orgId, subscriptionStatus: null };
  }
  const result = await synchronizeStripeSubscription(subscription);
  return {
    orgId: result?.orgId ?? orgId,
    subscriptionStatus: result?.subscriptionStatus ?? null,
  };
}
