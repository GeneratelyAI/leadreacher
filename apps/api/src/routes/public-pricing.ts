import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import {
  buildPricingCatalog,
  CAMPAIGN_TYPES,
  type CampaignType,
} from "../lib/billing/pricing.js";
import { getStripePrice } from "../lib/stripe.js";

const PublicPriceSchema = z.object({
  campaignType: z.enum(CAMPAIGN_TYPES),
  label: z.string(),
  unitAmount: z.number().nullable(),
  currency: z.string().nullable(),
  interval: z.string().nullable(),
});

export async function publicPricingRoutes(app: FastifyInstance): Promise<void> {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.get(
    "/public/pricing",
    {
      schema: {
        tags: ["Billing"],
        summary: "List public Stripe-backed campaign prices",
        response: { 200: z.object({ plans: z.array(PublicPriceSchema) }) },
      },
    },
    async (_request, reply) => {
      const plans = await Promise.all(
        CAMPAIGN_TYPES.map(async (campaignType: CampaignType) => {
          const catalog = buildPricingCatalog({
            campaignType,
            videoConfig: {
              enabled: false,
              mode: null,
              source: null,
              tone: null,
              uploadedVideoUrl: null,
            },
          });
          const lineItems = await Promise.all(
            catalog.lineItems.map(async (item) => ({
              item,
              price: await getStripePrice(item.priceId),
            })),
          );
          const amounts = lineItems.map(({ price }) => price.unitAmount);
          const currency = lineItems.find(({ price }) => price.currency)?.price.currency ?? null;
          const interval = lineItems.find(({ price }) => price.interval)?.price.interval ?? null;
          return {
            campaignType,
            label: lineItems[0].item.label,
            unitAmount: amounts.every((amount) => amount !== null)
              ? amounts.reduce<number>((total, amount) => total + (amount ?? 0), 0)
              : null,
            currency,
            interval,
          };
        }),
      );

      return reply.send({ plans });
    },
  );
}
