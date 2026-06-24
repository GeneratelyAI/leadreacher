import { Queue } from "bullmq";
import { redis } from "./redis.js";

export const QUEUE_CAMPAIGN_SEQUENCE = "campaign-sequence";
export const QUEUE_VIDEO_GENERATION = "video-generation";
export const QUEUE_RECONCILE_RELATIONS = "reconcile-relations";

// Fallback poll cadence for the new_relation webhook (which can lag/no-show).
export const RECONCILE_RELATIONS_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
const RECONCILE_SCHEDULER_ID = "reconcile-relations-scheduler";

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
  jobType?: "orchestrate" | "veo";
  videoAssetId?: string;
  seedImageUrl?: string;
  videoPrompt?: string;
  tone?: string;
  avatar?: string;
  setting?: string;
  referenceUrls?: string[];
};

export const campaignSequenceQueue = new Queue(QUEUE_CAMPAIGN_SEQUENCE, {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
  },
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

export const reconcileRelationsQueue = new Queue(QUEUE_RECONCILE_RELATIONS, {
  connection: redis,
});

/**
 * Idempotently register the repeatable relation-reconciliation job. Safe to
 * call on every startup — upsert replaces any existing schedule.
 */
export async function scheduleReconcileRelations(): Promise<void> {
  await reconcileRelationsQueue.upsertJobScheduler(
    RECONCILE_SCHEDULER_ID,
    { every: RECONCILE_RELATIONS_INTERVAL_MS },
    { name: QUEUE_RECONCILE_RELATIONS },
  );
}

export async function closeQueues(): Promise<void> {
  await Promise.all([
    campaignSequenceQueue.close(),
    videoGenerationQueue.close(),
    reconcileRelationsQueue.close(),
  ]);
}
