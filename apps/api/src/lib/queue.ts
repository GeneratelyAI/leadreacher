import { Queue } from "bullmq";
import { redis } from "./redis.js";

export const QUEUE_CAMPAIGN_SEQUENCE = "campaign-sequence";
export const QUEUE_VIDEO_GENERATION = "video-generation";
export const QUEUE_RECONCILE_MAINTENANCE = "reconcile-maintenance";
export const QUEUE_ANALYTICS_INSIGHTS = "analytics-insights";
export const QUEUE_ONBOARDING_PROSPECT_DISCOVERY = "onboarding-prospect-discovery";

// A single maintenance queue avoids four idle BullMQ workers continuously
// long-polling Redis. Individual task cadences are handled by the worker.
export const RECONCILE_MAINTENANCE_INTERVAL_MS = 2 * 60 * 1000;
const RECONCILE_MAINTENANCE_SCHEDULER_ID = "reconcile-maintenance-scheduler";
const ANALYTICS_INSIGHTS_SCHEDULER_ID = "analytics-insights-scheduler";
export const ANALYTICS_INSIGHTS_INTERVAL_MS = 60 * 60 * 1000;

const LEGACY_RECONCILIATION_SCHEDULERS = [
  { queueName: "reconcile-relations", schedulerId: "reconcile-relations-scheduler" },
  {
    queueName: "reconcile-delivery-attempts",
    schedulerId: "reconcile-delivery-attempts-scheduler",
  },
  {
    queueName: "reconcile-campaign-enrollments",
    schedulerId: "reconcile-campaign-enrollments-scheduler",
  },
  {
    queueName: "reconcile-veo-operations",
    schedulerId: "reconcile-veo-operations-scheduler",
  },
] as const;

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
  videoProvider?: "veo" | "omni";
};

export type AnalyticsInsightsJob = {
  orgId?: string;
};

export type OnboardingProspectDiscoveryJob = {
  orgId: string;
  campaignId: string;
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

export const reconcileMaintenanceQueue = new Queue(QUEUE_RECONCILE_MAINTENANCE, {
  connection: redis,
});

export const analyticsInsightsQueue = new Queue(QUEUE_ANALYTICS_INSIGHTS, {
  connection: redis,
});

export const onboardingProspectDiscoveryQueue = new Queue<OnboardingProspectDiscoveryJob>(
  QUEUE_ONBOARDING_PROSPECT_DISCOVERY,
  {
    connection: redis,
    defaultJobOptions: {
      attempts: 1,
    },
  },
);

/**
 * Idempotently register the single repeatable maintenance job. Safe to call
 * on every startup because upsert replaces the existing schedule.
 */
export async function scheduleReconciliationMaintenance(): Promise<void> {
  await reconcileMaintenanceQueue.upsertJobScheduler(
    RECONCILE_MAINTENANCE_SCHEDULER_ID,
    { every: RECONCILE_MAINTENANCE_INTERVAL_MS },
    { name: QUEUE_RECONCILE_MAINTENANCE },
  );

  // Clean up schedules created before maintenance work was consolidated. They
  // otherwise leave delayed jobs behind after a rolling deployment.
  await Promise.all(
    LEGACY_RECONCILIATION_SCHEDULERS.map(async ({ queueName, schedulerId }) => {
      const queue = new Queue(queueName, { connection: redis });
      try {
        await queue.removeJobScheduler(schedulerId);
      } finally {
        await queue.close();
      }
    }),
  );
}

export async function scheduleAnalyticsInsightsAggregation(): Promise<void> {
  await analyticsInsightsQueue.upsertJobScheduler(
    ANALYTICS_INSIGHTS_SCHEDULER_ID,
    { every: ANALYTICS_INSIGHTS_INTERVAL_MS },
    { name: QUEUE_ANALYTICS_INSIGHTS, data: {} },
  );
}

export async function closeQueues(): Promise<void> {
  await Promise.all([
    campaignSequenceQueue.close(),
    videoGenerationQueue.close(),
    reconcileMaintenanceQueue.close(),
    analyticsInsightsQueue.close(),
    onboardingProspectDiscoveryQueue.close(),
  ]);
}
