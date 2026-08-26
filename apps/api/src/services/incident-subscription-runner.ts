import type { IncidentRepairStatus } from "@prisma/client";

export const SUBSCRIPTION_CLAIM_STALE_MS = 90 * 60 * 1_000;

export function canClaimSubscriptionRepair(
  repair: { status: IncidentRepairStatus; attemptCount: number; updatedAt: Date },
  now = Date.now(),
): boolean {
  if (repair.attemptCount >= 3) return false;
  if (repair.status === "dispatched") return true;
  return repair.status === "repairing"
    && repair.updatedAt.getTime() < now - SUBSCRIPTION_CLAIM_STALE_MS;
}
