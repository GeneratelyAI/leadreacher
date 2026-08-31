export type OnboardingMode = "production" | "demo" | "preview";

export const PRODUCTION_CAMPAIGN_TYPES = [
  "personalized_outreach",
  "ai_video_ad",
  "uploaded_video",
] as const;

export type ProductionCampaignType = (typeof PRODUCTION_CAMPAIGN_TYPES)[number];
export type DemoCampaignType = ProductionCampaignType | "build_from_file_demo";

export function isProductionCampaignType(value: string): value is ProductionCampaignType {
  return PRODUCTION_CAMPAIGN_TYPES.includes(value as ProductionCampaignType);
}
