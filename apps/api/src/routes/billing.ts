import type { Strategy } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { ForbiddenError, ValidationError } from "../lib/errors.js";
import {
  buildPricingCatalog,
  parseVideoConfig,
  type CampaignType,
  type CatalogLineItem,
} from "../lib/billing/pricing.js";
import {
  ErrorResponseSchema,
  authenticatedRoute,
  errorResponses,
} from "../lib/openapi.js";
import { prisma } from "../lib/prisma.js";
import { requireOrgId } from "../lib/request-org.js";
import { requireOrganizationOwner } from "../lib/organization-access.js";
import { requireMfa } from "../plugins/auth.js";
import {
  createBillingPortalSession,
  createSubscriptionCheckoutSession,
  getStripePrice,
  retrieveSubscriptionCheckoutSession,
  type StripePriceDisplay,
} from "../lib/stripe.js";
import { reconcileCompletedStripeCheckout } from "../services/stripe-subscription-sync.js";

type BillingLineItem = CatalogLineItem & StripePriceDisplay;

const CheckoutSessionBodySchema = z.object({
  embedded: z.boolean().optional().default(false),
});

function pricingInputForStrategy(strategy: Pick<Strategy, "campaignType" | "videoConfig">): {
  campaignType: CampaignType;
  videoConfig: ReturnType<typeof parseVideoConfig>;
} {
  const parsedCampaignType = z
    .enum(["personalized_outreach", "ai_video_ad", "uploaded_video"])
    .safeParse(strategy.campaignType);
  if (!parsedCampaignType.success) {
    throw new ValidationError("Select a campaign type before viewing billing");
  }

  const videoConfig = parseVideoConfig(
    strategy.videoConfig ?? { enabled: false, mode: null, source: null },
  );
  return { campaignType: parsedCampaignType.data, videoConfig };
}

async function buildLineItems(strategy: Pick<Strategy, "campaignType" | "videoConfig">): Promise<{
  campaignType: CampaignType;
  videoEnabled: boolean;
  lineItems: BillingLineItem[];
}> {
  const pricingInput = pricingInputForStrategy(strategy);
  const catalog = buildPricingCatalog(pricingInput);
  const lineItems = await Promise.all(
    catalog.lineItems.map(async (item) => ({
      ...item,
      ...(await getStripePrice(item.priceId)),
    })),
  );

  return {
    campaignType: pricingInput.campaignType,
    videoEnabled: pricingInput.videoConfig.enabled,
    lineItems,
  };
}

async function getLatestStrategy(orgId: string): Promise<Strategy> {
  const strategy = await prisma.strategy.findFirst({
    where: { orgId },
    orderBy: { updatedAt: "desc" },
  });
  if (!strategy) {
    throw new ValidationError("Complete Strategy before checkout");
  }

  return strategy;
}

const UrlResponseSchema = z.object({ url: z.string().nullable() });
const CheckoutSessionReconcileSchema = z.object({
  sessionId: z.string().min(1).max(255),
});

export async function billingRoutes(app: FastifyInstance): Promise<void> {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.get(
    "/billing/pricing",
    {
      schema: {
        ...authenticatedRoute("Billing", "List Stripe line items for current strategy"),
      },
    },
    async (request, reply) => {
      const orgId = requireOrgId(request);
      const strategy = await getLatestStrategy(orgId);
      const { lineItems } = await buildLineItems(strategy);
      return reply.send({ lineItems });
    },
  );

  r.post(
    "/billing/checkout-session",
    {
      schema: {
        ...authenticatedRoute("Billing", "Create Stripe checkout session"),
        body: CheckoutSessionBodySchema,
      },
    },
    async (request, reply) => {
      const { orgId } = await requireOrganizationOwner(request);
      const strategy = await getLatestStrategy(orgId);
      const { campaignType, videoEnabled, lineItems } = await buildLineItems(strategy);
      const organization = await prisma.organization.findUnique({
        where: { id: orgId },
        select: { stripeCustomerId: true },
      });
      if (!organization) {
        throw new ValidationError("Organization not found");
      }

      const session = await createSubscriptionCheckoutSession({
        orgId,
        strategyId: strategy.id,
        campaignType,
        videoEnabled,
        priceIds: lineItems.map((lineItem) => lineItem.priceId),
        customerId: organization.stripeCustomerId,
        ...(request.body.embedded ? { embedded: true } : {}),
      });

      return request.body.embedded
        ? reply.send({
            url: session.url,
            clientSecret: session.clientSecret,
            mockMode: session.mockMode ?? false,
          })
        : reply.send({ url: session.url });
    },
  );

  r.post(
    "/billing/portal-session",
    {
      preHandler: [requireMfa],
      schema: {
        ...authenticatedRoute("Billing", "Create Stripe customer portal session"),
      },
    },
    async (request, reply) => {
      const { orgId } = await requireOrganizationOwner(request);
      const organization = await prisma.organization.findUnique({
        where: { id: orgId },
        select: { stripeCustomerId: true },
      });
      if (!organization?.stripeCustomerId) {
        throw new ValidationError("No Stripe customer found for organization");
      }

      const session = await createBillingPortalSession(organization.stripeCustomerId);
      return reply.send({ url: session.url });
    },
  );

  r.post(
    "/billing/checkout-session/reconcile",
    {
      schema: {
        ...authenticatedRoute("Billing", "Reconcile a completed Stripe Checkout session"),
        body: CheckoutSessionReconcileSchema,
      },
    },
    async (request, reply) => {
      const { orgId } = await requireOrganizationOwner(request);
      const session = await retrieveSubscriptionCheckoutSession(request.body.sessionId);
      const sessionOrgId = session.metadata?.orgId ?? session.client_reference_id;
      if (sessionOrgId !== orgId) {
        throw new ForbiddenError("This checkout session does not belong to your organization");
      }

      if (session.status !== "complete") {
        const organization = await prisma.organization.findUnique({
          where: { id: orgId },
          select: { subscriptionStatus: true },
        });
        return reply.send({
          checkoutStatus: session.status ?? "open",
          subscriptionStatus: organization?.subscriptionStatus ?? null,
        });
      }

      const result = await reconcileCompletedStripeCheckout(session);
      return reply.send({
        checkoutStatus: "complete",
        subscriptionStatus: result.subscriptionStatus,
      });
    },
  );
}
