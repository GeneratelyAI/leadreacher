import type { FastifyBaseLogger } from "fastify";
import { getPausedWorkerFamilies } from "../config/env.js";
import { redis } from "./redis.js";

export const WORKER_LEASE_TTL_SECONDS = 90;
export const WORKER_LEASE_RENEWAL_MS = 30_000;

export const REQUIRED_WORKER_LEASES = [
  "campaign",
  "reconcile",
  "video",
  "analytics",
  "lifecycle",
] as const;

export type WorkerLeaseName = (typeof REQUIRED_WORKER_LEASES)[number];

function leaseKey(name: WorkerLeaseName): string {
  return `worker-lease:${name}`;
}

function activityKey(name: WorkerLeaseName): string {
  return `worker-activity:${name}`;
}

export async function renewWorkerLeases(names: readonly WorkerLeaseName[]): Promise<void> {
  const renewedAt = new Date().toISOString();
  const pipeline = redis.pipeline();
  for (const name of names) {
    pipeline.set(leaseKey(name), renewedAt, "EX", WORKER_LEASE_TTL_SECONDS);
  }
  await pipeline.exec();
}

export async function recordWorkerActivity(name: WorkerLeaseName): Promise<void> {
  await redis.set(activityKey(name), new Date().toISOString(), "EX", 7 * 24 * 60 * 60);
}

export async function getStaleWorkerLeases(
  required: readonly WorkerLeaseName[] = REQUIRED_WORKER_LEASES.filter(
    (name) => !getPausedWorkerFamilies().has(name),
  ),
): Promise<WorkerLeaseName[]> {
  if (required.length === 0) {
    return [];
  }

  const values = await redis.mget(required.map(leaseKey));
  return required.filter((_, index) => !values[index]);
}

export function startWorkerLeaseRenewal(input: {
  names: readonly WorkerLeaseName[];
  logger: Pick<FastifyBaseLogger, "error">;
}): () => void {
  const renew = async () => {
    try {
      await renewWorkerLeases(input.names);
    } catch (error) {
      input.logger.error({ err: error, workers: input.names }, "Worker lease renewal failed");
    }
  };

  void renew();
  const timer = setInterval(() => {
    void renew();
  }, WORKER_LEASE_RENEWAL_MS);
  timer.unref();

  return () => clearInterval(timer);
}
