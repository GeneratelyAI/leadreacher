export const CONTENT_CHOICES = ["personalized-video", "ai-video", "your-video", "document"] as const;
export type ContentChoice = typeof CONTENT_CHOICES[number];

export function recoverContentChoice(strategy: { campaignType?: string; icpDefinition?: { contentChoice?: unknown } }): ContentChoice {
  const saved = strategy.icpDefinition?.contentChoice;
  if (CONTENT_CHOICES.includes(saved as ContentChoice)) return saved as ContentChoice;
  if (strategy.campaignType === "ai_video_ad") return "ai-video";
  if (strategy.campaignType === "uploaded_video") return "your-video";
  return "personalized-video";
}
