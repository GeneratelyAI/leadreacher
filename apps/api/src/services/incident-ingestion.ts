import type { IncidentRepairStatus, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { incidentAutofixQueue, QUEUE_INCIDENT_AUTOFIX } from "../lib/queue.js";
import type { NormalizedIncidentEvent } from "./incident-normalizer.js";

const RETRYABLE_STATUSES: IncidentRepairStatus[] = ["received", "failed", "blocked"];

export async function ingestIncidentEvent(event: NormalizedIncidentEvent): Promise<{
  repairId: string;
  queued: boolean;
  recovered: boolean;
}> {
  const result = await prisma.$transaction(async (tx) => {
    const repair = await tx.incidentRepair.upsert({
      where: {
        provider_externalIssueId_releaseSha: {
          provider: event.provider,
          externalIssueId: event.externalIssueId,
          releaseSha: event.releaseSha,
        },
      },
      create: {
        provider: event.provider,
        externalIssueId: event.externalIssueId,
        fingerprint: event.fingerprint,
        environment: event.environment,
        releaseSha: event.releaseSha,
        severity: event.severity,
        title: event.title,
        providerUrl: event.providerUrl,
        sanitizedContext: event.context as Prisma.InputJsonValue,
        firstSeenAt: event.occurredAt,
        lastSeenAt: event.occurredAt,
      },
      update: {
        severity: event.severity,
        title: event.title,
        providerUrl: event.providerUrl,
        sanitizedContext: event.context as Prisma.InputJsonValue,
        lastSeenAt: event.occurredAt,
      },
    });

    if (event.recovered) {
      const terminalStatus: IncidentRepairStatus = ["received", "queued", "enriching"]
        .includes(repair.status) ? "cancelled" : repair.status;
      if (terminalStatus !== repair.status) {
        await tx.incidentRepair.update({ where: { id: repair.id }, data: { status: terminalStatus } });
      }
      await appendIncidentEvent(tx, repair.id, terminalStatus, event.eventType, { recovered: true });
      return { repairId: repair.id, queued: false, recovered: true };
    }

    const shouldQueue = RETRYABLE_STATUSES.includes(repair.status) && repair.attemptCount < 3;
    const nextStatus: IncidentRepairStatus = shouldQueue ? "queued" : repair.status;
    if (shouldQueue) {
      await tx.incidentRepair.update({ where: { id: repair.id }, data: { status: nextStatus } });
    }
    await appendIncidentEvent(tx, repair.id, nextStatus, event.eventType, { duplicate: !shouldQueue });
    return { repairId: repair.id, queued: shouldQueue, recovered: false };
  });

  if (result.queued) {
    try {
      await incidentAutofixQueue.add(
        QUEUE_INCIDENT_AUTOFIX,
        { repairId: result.repairId },
        { jobId: `incident-repair-${result.repairId}` },
      );
    } catch (error) {
      await prisma.incidentRepair.update({
        where: { id: result.repairId },
        data: {
          status: "failed",
          lastError: error instanceof Error ? error.message.slice(0, 500) : "Queue submission failed",
        },
      });
      throw error;
    }
  }
  return result;
}

async function appendIncidentEvent(
  tx: Prisma.TransactionClient,
  repairId: string,
  status: IncidentRepairStatus,
  eventType: string,
  metadata: Prisma.InputJsonValue,
): Promise<void> {
  await tx.incidentRepairEvent.create({
    data: { repairId, status, eventType, metadata },
  });
}
