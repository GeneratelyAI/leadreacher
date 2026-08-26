CREATE TYPE "IncidentProvider" AS ENUM ('sentry', 'better_stack');
CREATE TYPE "IncidentRepairStatus" AS ENUM (
  'received', 'queued', 'enriching', 'dispatched', 'repairing',
  'pull_request_open', 'needs_approval', 'merged', 'verifying',
  'verified', 'blocked', 'failed', 'verification_failed', 'cancelled'
);
CREATE TYPE "IncidentRisk" AS ENUM ('low', 'medium', 'high', 'prohibited', 'unknown');

CREATE TABLE "IncidentRepair" (
  "id" TEXT NOT NULL,
  "provider" "IncidentProvider" NOT NULL,
  "externalIssueId" TEXT NOT NULL,
  "fingerprint" TEXT NOT NULL,
  "environment" TEXT NOT NULL,
  "releaseSha" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "providerUrl" TEXT,
  "status" "IncidentRepairStatus" NOT NULL DEFAULT 'received',
  "risk" "IncidentRisk" NOT NULL DEFAULT 'unknown',
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "branchName" TEXT,
  "commitSha" TEXT,
  "pullRequestNumber" INTEGER,
  "pullRequestUrl" TEXT,
  "workflowRunId" TEXT,
  "workflowRunUrl" TEXT,
  "verificationResult" JSONB,
  "sanitizedContext" JSONB,
  "contextDigest" TEXT,
  "lastError" TEXT,
  "briefedStatus" "IncidentRepairStatus",
  "briefedAt" TIMESTAMP(3),
  "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "IncidentRepair_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IncidentRepairEvent" (
  "id" TEXT NOT NULL,
  "repairId" TEXT NOT NULL,
  "status" "IncidentRepairStatus" NOT NULL,
  "eventType" TEXT NOT NULL,
  "metadata" JSONB,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IncidentRepairEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IncidentRepair_provider_externalIssueId_releaseSha_key"
  ON "IncidentRepair"("provider", "externalIssueId", "releaseSha");
CREATE INDEX "IncidentRepair_status_updatedAt_idx" ON "IncidentRepair"("status", "updatedAt");
CREATE INDEX "IncidentRepair_provider_fingerprint_environment_idx"
  ON "IncidentRepair"("provider", "fingerprint", "environment");
CREATE INDEX "IncidentRepairEvent_repairId_occurredAt_idx"
  ON "IncidentRepairEvent"("repairId", "occurredAt");
CREATE INDEX "IncidentRepairEvent_status_occurredAt_idx"
  ON "IncidentRepairEvent"("status", "occurredAt");

ALTER TABLE "IncidentRepairEvent"
  ADD CONSTRAINT "IncidentRepairEvent_repairId_fkey"
  FOREIGN KEY ("repairId") REFERENCES "IncidentRepair"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
