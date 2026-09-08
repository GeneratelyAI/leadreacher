import { CONTENT_CHOICES, type ContentChoice } from "@leadreacher/shared/campaign";
export { CONTENT_CHOICES, type ContentChoice } from "@leadreacher/shared/campaign";

export function recoverContentChoice(strategy: { campaignType?: string; icpDefinition?: { contentChoice?: unknown } }): ContentChoice {
  const saved = strategy.icpDefinition?.contentChoice;
  if (CONTENT_CHOICES.includes(saved as ContentChoice)) return saved as ContentChoice;
  if (strategy.campaignType === "ai_video_ad") return "ai-video";
  if (strategy.campaignType === "uploaded_video") return "your-video";
  return "personalized-video";
}
