import { Queue } from "bullmq";
import { redis } from "./redis.js";

export const QUEUE_CAMPAIGN_SEQUENCE = "campaign-sequence";
export const QUEUE_VIDEO_GENERATION = "video-generation";

export type CampaignSequenceJob = {
  campaignLeadId: string;
  orgId: string;
  step: number;
};

export type VideoGenerationJob = {
  orgId: string;
  campaignId: string;
  leadId: string;
  prompt: string;
};

export const campaignSequenceQueue = new Queue(QUEUE_CAMPAIGN_SEQUENCE, {
  connection: redis,
});

export function campaignSequenceJobId(
  campaignLeadId: string,
  step: number,
): string {
  return `${campaignLeadId}-step-${step}`;
}

export const videoGenerationQueue = new Queue(QUEUE_VIDEO_GENERATION, {
  connection: redis,
});
