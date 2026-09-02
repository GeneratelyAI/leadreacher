import { Job, Worker } from "bullmq";
import { getBullMqIdleDrainDelaySeconds } from "../config/env.js";
import {
  QUEUE_RECONCILE_MAINTENANCE,
  RECONCILE_MAINTENANCE_INTERVAL_MS,
  scheduleReconciliationMaintenance,
} from "../lib/queue.js";
import { redisSubscriber } from "../lib/redis.js";
import { reconcileCampaignStepZeroJobs } from "./reconcile-campaign-enrollments.js";
import { reconcileDeliveryAttempts } from "./reconcile-delivery-attempts.js";
import { reconcilePendingConnections } from "./reconcile-relations.js";
import { reconcileSocialAccountStatuses } from "./reconcile-social-accounts.js";
import {
  reconcileUnknownTemplateVeoOperations,
  reconcileUnknownVeoOperations,
} from "./video-generation.js";
import { processProductEmailOutbox } from "../services/product-email-outbox.js";
import { processOrganizationExports } from "../services/organization-export.js";
import { purgeExpiredOrganizations } from "../services/organization-lifecycle.js";

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
