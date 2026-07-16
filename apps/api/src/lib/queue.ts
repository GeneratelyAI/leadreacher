import { Queue } from "bullmq";
import { redis } from "./redis.js";

export const QUEUE_CAMPAIGN_SEQUENCE = "campaign-sequence";
export const QUEUE_VIDEO_GENERATION = "video-generation";
export const QUEUE_RECONCILE_VEO_OPERATIONS = "reconcile-veo-operations";
export const QUEUE_RECONCILE_RELATIONS = "reconcile-relations";
export const QUEUE_RECONCILE_DELIVERY_ATTEMPTS = "reconcile-delivery-attempts";
export const QUEUE_RECONCILE_CAMPAIGN_ENROLLMENTS = "reconcile-campaign-enrollments";

// Fallback poll cadence for the new_relation webhook (which can lag/no-show).
export const RECONCILE_RELATIONS_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
const RECONCILE_SCHEDULER_ID = "reconcile-relations-scheduler";
const DELIVERY_ATTEMPT_RECONCILE_SCHEDULER_ID =
  "reconcile-delivery-attempts-scheduler";
const CAMPAIGN_ENROLLMENT_RECONCILE_SCHEDULER_ID =
  "reconcile-campaign-enrollments-scheduler";
const VEO_OPERATION_RECONCILE_SCHEDULER_ID =
  "reconcile-veo-operations-scheduler";

export type CampaignSequenceJob = {
  campaignLeadId: string;
  orgId: string;
  step: number;
};

export type VideoGenerationJob = {
  orgId: string;
  campaignId: string;
  leadId?: string;
  prompt?: string;
  pipeline?: "standard" | "personalized";
  jobType?:
    | "orchestrate"
    | "veo"
    | "template-orchestrate"
    | "template-veo"
    | "personalized-compose";
  videoAssetId?: string;
  templateId?: string;
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

export const reconcileVeoOperationsQueue = new Queue(
  QUEUE_RECONCILE_VEO_OPERATIONS,
  { connection: redis },
);

export const reconcileRelationsQueue = new Queue(QUEUE_RECONCILE_RELATIONS, {
  connection: redis,
});

export const reconcileDeliveryAttemptsQueue = new Queue(
  QUEUE_RECONCILE_DELIVERY_ATTEMPTS,
  { connection: redis },
);

export const reconcileCampaignEnrollmentsQueue = new Queue(
  QUEUE_RECONCILE_CAMPAIGN_ENROLLMENTS,
  { connection: redis },
);

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

export async function scheduleDeliveryAttemptReconciliation(): Promise<void> {
  await reconcileDeliveryAttemptsQueue.upsertJobScheduler(
    DELIVERY_ATTEMPT_RECONCILE_SCHEDULER_ID,
    { every: 5 * 60 * 1000 },
    { name: QUEUE_RECONCILE_DELIVERY_ATTEMPTS },
  );
}

export async function scheduleVeoOperationReconciliation(): Promise<void> {
  await reconcileVeoOperationsQueue.upsertJobScheduler(
    VEO_OPERATION_RECONCILE_SCHEDULER_ID,
    { every: 5 * 60 * 1000 },
    { name: QUEUE_RECONCILE_VEO_OPERATIONS },
  );
}

export async function scheduleCampaignEnrollmentReconciliation(): Promise<void> {
  await reconcileCampaignEnrollmentsQueue.upsertJobScheduler(
    CAMPAIGN_ENROLLMENT_RECONCILE_SCHEDULER_ID,
    { every: 2 * 60 * 1000 },
    { name: QUEUE_RECONCILE_CAMPAIGN_ENROLLMENTS },
  );
}

export async function closeQueues(): Promise<void> {
  await Promise.all([
    campaignSequenceQueue.close(),
    videoGenerationQueue.close(),
    reconcileVeoOperationsQueue.close(),
    reconcileRelationsQueue.close(),
    reconcileDeliveryAttemptsQueue.close(),
    reconcileCampaignEnrollmentsQueue.close(),
  ]);
}
