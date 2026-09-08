/** Persisted values. Changing these requires a storage compatibility plan. */
export const CAMPAIGN_TYPES = [
  "personalized_outreach",
  "ai_video_ad",
  "uploaded_video",
] as const;

export type CampaignType = (typeof CAMPAIGN_TYPES)[number];

/** A document and a user video deliberately share uploaded_video in storage. */
export const CONTENT_CHOICES = [
  "personalized-video",
  "ai-video",
  "your-video",
  "document",
] as const;

export type ContentChoice = (typeof CONTENT_CHOICES)[number];
