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
    label: "Strategy",
    eyebrow: "01 · Understand",
    title: "We learn what makes your business different.",
    description: "LeadReacher reads your website and turns the important details into a usable acquisition brief.",
    action: "Built for your business",
    result: "Business brief ready",
  },
  {
    id: "strategy",
    label: "Prospects",
    eyebrow: "02 · Plan",
    title: "We build a focused route to your buyers.",
    description: "Your offer becomes a clear audience, positioning angle, and channel plan before outreach begins.",
    action: "Find your best buyers",
    result: "Audience and channels defined",
  },
  {
    id: "prospects",
    label: "Content",
    eyebrow: "03 · Review",
    title: "You see the real people we plan to contact.",
    description: "Review, approve, or exclude prospects before anyone is enrolled in a campaign.",
    action: "Made to convert",
    result: "Qualified audience approved",
  },
  {
    id: "outreach",
    label: "Outreach",
    eyebrow: "04 · Reach",
    title: "Every message follows an approved sequence.",
    description: "LeadReacher coordinates personalized follow-ups across the channels your prospects actually use.",
    action: "Delivered automatically",
    result: "Conversations begin",
  },
  {
    id: "conversations",
    label: "Conversations",
    eyebrow: "05 · Convert",
    title: "You step in when the prospect is ready.",
    description: "Interested replies arrive in Chat with their campaign, channel, and conversation context intact.",
    action: "Reply and close",
    result: "Qualified meetings booked",
  },
] as const;
