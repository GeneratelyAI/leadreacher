import { Job, Worker } from "bullmq";
import { getBullMqIdleDrainDelaySeconds } from "../platform/config/env.js";
import {
  QUEUE_RECONCILE_MAINTENANCE,
  RECONCILE_MAINTENANCE_INTERVAL_MS,
  scheduleReconciliationMaintenance,
} from "../lib/queue.js";
import { redisSubscriber } from "../platform/redis/connection.js";
import { reconcileCampaignStepZeroJobs } from "../features/campaigns/public/reconcile-campaign-enrollments-worker.js";
import { reconcileDeliveryAttempts } from "../features/messages/public/reconcile-delivery-attempts-worker.js";
import { reconcilePendingConnections } from "../features/channels/public/reconcile-relations-worker.js";
import { reconcileSocialAccountStatuses } from "../features/channels/public/reconcile-social-accounts-worker.js";
import {
  reconcileUnknownTemplateVeoOperations,
  reconcileUnknownVeoOperations,
} from "../features/content/public/video-generation-worker.js";
import { processProductEmailOutbox } from "../features/messages/public/product-email-outbox.js";
import { processOrganizationExports } from "../features/organizations/public/export.js";
import { purgeExpiredOrganizations } from "../features/organizations/public/lifecycle.js";

const DELIVERY_ATTEMPT_INTERVAL_MS = 5 * 60 * 1000;
const RELATION_INTERVAL_MS = 10 * 60 * 1000;
const SOCIAL_ACCOUNT_INTERVAL_MS = 60 * 60 * 1000;
const VEO_OPERATION_INTERVAL_MS = 5 * 60 * 1000;

export type ReconciliationMaintenanceOptions = {
  reconcileEnabled: boolean;
  videoEnabled: boolean;
  lifecycleEnabled?: boolean;
};

/**
 * A tick is due when its interval boundary was crossed since the preceding
 * scheduler tick. This survives process restarts without Redis bookkeeping.
 */
export function isMaintenanceTaskDue(
  scheduledAt: number,
  intervalMs: number,
): boolean {
  const previousTick = scheduledAt - RECONCILE_MAINTENANCE_INTERVAL_MS;
  return (
    Math.floor(scheduledAt / intervalMs) >
    Math.floor(previousTick / intervalMs)
  );
}

export async function runReconciliationMaintenance(
  options: ReconciliationMaintenanceOptions,
  scheduledAt = Date.now(),
): Promise<Record<string, unknown>> {
  const work: Array<Promise<unknown>> = [];
  const names: string[] = [];

  if (options.reconcileEnabled) {
    work.push(reconcileCampaignStepZeroJobs());
    names.push("campaign-enrollments");

    if (isMaintenanceTaskDue(scheduledAt, DELIVERY_ATTEMPT_INTERVAL_MS)) {
      work.push(reconcileDeliveryAttempts());
      names.push("delivery-attempts");
    }

    if (isMaintenanceTaskDue(scheduledAt, RELATION_INTERVAL_MS)) {
      work.push(reconcilePendingConnections());
      names.push("relations");
    }

    if (isMaintenanceTaskDue(scheduledAt, SOCIAL_ACCOUNT_INTERVAL_MS)) {
      work.push(reconcileSocialAccountStatuses());
      names.push("social-accounts");
    }
  }

  if (
    options.videoEnabled &&
    isMaintenanceTaskDue(scheduledAt, VEO_OPERATION_INTERVAL_MS)
  ) {
    work.push(
      Promise.all([
        reconcileUnknownVeoOperations(),
        reconcileUnknownTemplateVeoOperations(),
      ]),
    );
    names.push("veo-operations");
  }

  if (options.lifecycleEnabled) {
    work.push(processProductEmailOutbox());
    names.push("product-email-outbox");
    work.push(processOrganizationExports());
    names.push("organization-exports");
    work.push(purgeExpiredOrganizations());
    names.push("organization-purge");
  }

  const results = await Promise.all(work);
  return Object.fromEntries(names.map((name, index) => [name, results[index]]));
}

export function startReconciliationMaintenanceWorker(
  options: ReconciliationMaintenanceOptions,
): Worker {
  const worker = new Worker(
    QUEUE_RECONCILE_MAINTENANCE,
    (job: Job) => runReconciliationMaintenance(options, job.timestamp),
    {
      connection: redisSubscriber,
      drainDelay: getBullMqIdleDrainDelaySeconds(),
    },
  );

  worker.on("failed", (job, error) => {
    console.error(`Maintenance job ${job?.id} failed:`, error.message);
  });

  void scheduleReconciliationMaintenance();
  return worker;
}
