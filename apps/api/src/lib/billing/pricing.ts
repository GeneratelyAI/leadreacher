import { z } from "zod";
import { env } from "../../config/env.js";

const CampaignTypeSchema = z.enum([
  "personalized_outreach",
  "ai_video_ad",
  "uploaded_video",
]);

export const VideoConfigSchema = z
  .object({
    enabled: z.boolean(),
    mode: z.enum(["personalized", "standardized"]).nullable(),
    source: z.enum(["generated", "uploaded"]).nullable(),
    tone: z.enum(["professional", "casual", "aggressive"]).nullable().default(null),
    uploadedVideoUrl: z.string().url().nullable().default(null),
  })
  .superRefine((value, ctx) => {
    if (value.enabled && value.source === null) {
      ctx.addIssue({
        code: "custom",
        message: "Enabled video requires a source",
      });
    }

    if (value.enabled && value.source === "generated" && value.mode === null) {
      ctx.addIssue({
        code: "custom",
        message: "Generated video requires a mode",
      });
    }

    if (
      !value.enabled &&
      (value.mode !== null ||
        value.source !== null ||
        value.tone !== null ||
        value.uploadedVideoUrl !== null)
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Disabled video must not include mode, source, tone, or an uploaded video",
      });
    }

    if (value.source !== "uploaded" && value.uploadedVideoUrl !== null) {
      ctx.addIssue({
        code: "custom",
        message: "uploadedVideoUrl is only valid when source is uploaded",
      });
    }
  });

export type VideoConfig = z.infer<typeof VideoConfigSchema>;
export type CampaignType = z.infer<typeof CampaignTypeSchema>;

export type PricingCatalogInput = {
  campaignType: CampaignType;
  videoConfig: VideoConfig;
};

export type CatalogLineItem = {
  key:
    | "personalized_outreach"
    | "ai_video_ad"
    | "uploaded_video"
    | "video_addon";
  priceId: string;
  label: string;
};

export const CAMPAIGN_PRICE_CONFIG: Record<
  CampaignType,
  { key: CatalogLineItem["key"]; envKey: keyof typeof env; label: string }
> = {
  personalized_outreach: {
    key: "personalized_outreach",
    envKey: "STRIPE_PRICE_PERSONALIZED_OUTREACH",
    label: "Personalized outreach",
  },
  ai_video_ad: {
    key: "ai_video_ad",
    envKey: "STRIPE_PRICE_AI_VIDEO_AD",
    label: "AI campaign video",
  },
  uploaded_video: {
    key: "uploaded_video",
    envKey: "STRIPE_PRICE_UPLOADED_VIDEO",
    label: "Uploaded video outreach",
  },
};

export const CAMPAIGN_TYPES = CampaignTypeSchema.options;

function resolvePriceId(
  key: CatalogLineItem["key"],
  envKey: keyof typeof env,
): string {
  const configuredPriceId = env[envKey];
  if (typeof configuredPriceId !== "string" || configuredPriceId.length === 0) {
    if (env.STRIPE_MOCK_MODE) {
      return `mock_price_${key}`;
    }

    throw new Error(`${String(envKey)} must be configured when Stripe is live`);
  }

  return configuredPriceId;
}

/**
 * Selects Stripe Price IDs only. Monetary amounts remain Stripe's source of
 * truth and are retrieved by the billing adapter before being returned.
 */
export function buildPricingCatalog(input: PricingCatalogInput): {
  lineItems: CatalogLineItem[];
} {
  const campaign = CAMPAIGN_PRICE_CONFIG[input.campaignType];
  const lineItems: CatalogLineItem[] = [
    {
      key: campaign.key,
      priceId: resolvePriceId(campaign.key, campaign.envKey),
      label: campaign.label,
    },
  ];

  lineItems.push({
    key: "video_addon",
    priceId: resolvePriceId("video_addon", "STRIPE_PRICE_VIDEO_ADDON"),
    label: "Video personalization",
  });

  return { lineItems };
}

export function parseVideoConfig(value: unknown): VideoConfig {
  return VideoConfigSchema.parse(value);
}
