import { CAMPAIGN_TYPES as PRODUCTION_CAMPAIGN_TYPES } from "@leadreacher/shared/campaign";
export { CAMPAIGN_TYPES as PRODUCTION_CAMPAIGN_TYPES } from "@leadreacher/shared/campaign";

export type OnboardingMode = "production" | "demo" | "preview";
export type { CampaignType as ProductionCampaignType } from "@leadreacher/shared/campaign";
import type { CampaignType as ProductionCampaignType } from "@leadreacher/shared/campaign";
export type DemoCampaignType = ProductionCampaignType | "build_from_file_demo";

export function isProductionCampaignType(value: string): value is ProductionCampaignType {
  return PRODUCTION_CAMPAIGN_TYPES.includes(value as ProductionCampaignType);
}
