import { createHmac } from "node:crypto";
import { Job, Worker } from "bullmq";
import type { Prisma } from "@prisma/client";
import { env, getBullMqIdleDrainDelaySeconds } from "../config/env.js";
import { QUEUE_INCIDENT_AUTOFIX, type IncidentAutofixJob } from "../lib/queue.js";
import { redis, redisSubscriber } from "../lib/redis.js";
import { prisma } from "../lib/prisma.js";
import {
  fetchBetterStackIncidentContext,
  fetchSentryIncidentContext,
} from "../adapters/incident-providers.js";
import { dispatchIncidentAutofix } from "../adapters/github-autofix.js";
import { sanitizeIncidentText } from "../services/incident-sanitizer.js";

const FAILURE_WINDOW_SECONDS = 30 * 60;
const FAILURE_LIMIT = 5;

function contextDigest(repairId: string): string {
  return createHmac("sha256", env.INCIDENT_AUTOFIX_CALLBACK_SECRET)
    .update(repairId)
    .digest("hex");
}

async function transition(
  repairId: string,
  status: "enriching" | "dispatched" | "failed",
  eventType: string,
  data: Prisma.IncidentRepairUpdateInput = {},
): Promise<void> {
  await prisma.$transaction([
    prisma.incidentRepair.update({ where: { id: repairId }, data: { ...data, status } }),
    prisma.incidentRepairEvent.create({ data: { repairId, status, eventType } }),
  ]);
}

export async function runIncidentAutofix(job: IncidentAutofixJob): Promise<void> {
  if (!env.INCIDENT_AUTOFIX_ENABLED) return;
  if (!env.INCIDENT_AUTOFIX_CALLBACK_SECRET) {
    throw new Error("INCIDENT_AUTOFIX_CALLBACK_SECRET is not configured");
  }
  const failures = Number(await redis.get("incident-autofix:dispatch-failures") ?? 0);
  if (failures >= FAILURE_LIMIT) throw new Error("Incident autofix circuit breaker is open");

  const repair = await prisma.incidentRepair.findUnique({ where: { id: job.repairId } });
  if (!repair || repair.status === "cancelled" || repair.status === "verified") return;
  if (repair.attemptCount >= 3) {
    await transition(repair.id, "failed", "attempt_limit", { lastError: "Attempt limit reached" });
    return;
  }

  await transition(repair.id, "enriching", "worker_started", { attemptCount: { increment: 1 } });
  try {
    let context: Record<string, unknown> = {};
    try {
      context = repair.provider === "sentry"
        ? await fetchSentryIncidentContext(repair.externalIssueId)
        : await fetchBetterStackIncidentContext(repair.externalIssueId);
    } catch (error) {
      context = {
        enrichmentWarning: sanitizeIncidentText(
          error instanceof Error ? error.message : String(error),
          240,
        ),
      };
    }
    const digest = contextDigest(repair.id);
    const existingContext = repair.sanitizedContext
      && typeof repair.sanitizedContext === "object"
      && !Array.isArray(repair.sanitizedContext)
      ? repair.sanitizedContext as Record<string, unknown>
      : {};
    const sanitizedContext = { ...existingContext, provider: context };
    await prisma.incidentRepair.update({
      where: { id: repair.id },
      data: { sanitizedContext: sanitizedContext as Prisma.InputJsonValue, contextDigest: digest },
    });
    await dispatchIncidentAutofix({
      repairId: repair.id,
      provider: repair.provider,
      externalIssueId: repair.externalIssueId,
      releaseSha: repair.releaseSha,
      severity: repair.severity,
      contextDigest: digest,
    });
    await redis.del("incident-autofix:dispatch-failures");
    await transition(repair.id, "dispatched", "github_dispatched");
  } catch (error) {
    const count = await redis.incr("incident-autofix:dispatch-failures");
    if (count === 1) await redis.expire("incident-autofix:dispatch-failures", FAILURE_WINDOW_SECONDS);
    const message = error instanceof Error ? error.message : String(error);
    await transition(repair.id, "failed", "worker_failed", { lastError: message.slice(0, 500) });
    throw error;
  }
}

export function startIncidentAutofixWorker(): Worker<IncidentAutofixJob> {
  return new Worker<IncidentAutofixJob>(
    QUEUE_INCIDENT_AUTOFIX,
    (job: Job<IncidentAutofixJob>) => runIncidentAutofix(job.data),
    { connection: redisSubscriber, concurrency: 1, drainDelay: getBullMqIdleDrainDelaySeconds() },
  );
}
