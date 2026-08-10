import type { ProductStoryStageId } from "@/lib/product-story";

export type ProductStoryStage = {
  id: ProductStoryStageId;
  label: string;
  eyebrow: string;
  title: string;
  description: string;
  action: string;
  result: string;
};

export const PRODUCT_STORY_STAGES: readonly ProductStoryStage[] = [
  {
    id: "website",
    label: "Website",
    eyebrow: "01 · Understand",
    title: "We learn what makes your business different.",
    description: "LeadReacher reads your website and turns the important details into a usable acquisition brief.",
    action: "Share your website",
    result: "Business brief ready",
  },
  {
    id: "strategy",
    label: "Strategy",
    eyebrow: "02 · Plan",
    title: "We build a focused route to your buyers.",
    description: "Your offer becomes a clear audience, positioning angle, and channel plan before outreach begins.",
    action: "AI builds the strategy",
    result: "Audience and channels defined",
  },
  {
    id: "prospects",
    label: "Prospects",
    eyebrow: "03 · Review",
    title: "You see the real people we plan to contact.",
    description: "Review, approve, or exclude prospects before anyone is enrolled in a campaign.",
    action: "Review your prospects",
    result: "Qualified audience approved",
  },
  {
    id: "outreach",
    label: "Outreach",
    eyebrow: "04 · Reach",
    title: "Every message follows an approved sequence.",
    description: "LeadReacher coordinates personalized follow-ups across the channels your prospects actually use.",
    action: "Outreach starts",
    result: "Conversations begin",
  },
  {
    id: "conversations",
    label: "Conversations",
    eyebrow: "05 · Convert",
    title: "You step in when the prospect is ready.",
    description: "Interested replies arrive in Chat with their campaign, channel, and conversation context intact.",
    action: "Reply to warm prospects",
    result: "Qualified meetings booked",
  },
] as const;
