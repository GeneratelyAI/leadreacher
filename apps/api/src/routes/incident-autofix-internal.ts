import { createHmac, timingSafeEqual } from "node:crypto";
import type { IncidentRepairStatus, IncidentRisk, Prisma } from "@prisma/client";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { env } from "../config/env.js";
import { AuthError, NotFoundError, ValidationError } from "../lib/errors.js";
import { incidentAutofixQueue, QUEUE_INCIDENT_AUTOFIX } from "../lib/queue.js";
import { prisma } from "../lib/prisma.js";
import { verifyIncidentWebhookSecret } from "../services/incident-webhook-auth.js";
import { sanitizeIncidentText } from "../services/incident-sanitizer.js";

const INTERNAL_SECRET_HEADER = "x-leadreacher-autofix-secret";
const BRIEFABLE_STATUSES: IncidentRepairStatus[] = [
  "pull_request_open",
  "needs_approval",
  "merged",
  "verified",
  "blocked",
  "failed",
  "verification_failed",
  "cancelled",
];

const callbackSchema = z.object({
  status: z.enum([
    "repairing",
    "pull_request_open",
    "needs_approval",
    "merged",
    "verifying",
    "verified",
    "blocked",
    "failed",
    "verification_failed",
    "cancelled",
  ]),
  risk: z.enum(["low", "medium", "high", "prohibited", "unknown"]).optional(),
  eventType: z.string().min(1).max(80).default("workflow_callback"),
  branchName: z.string().max(180).optional(),
  commitSha: z.string().regex(/^[a-f0-9]{7,64}$/i).optional(),
  pullRequestNumber: z.number().int().positive().optional(),
  pullRequestUrl: z.string().url().optional(),
  workflowRunId: z.string().max(80).optional(),
  workflowRunUrl: z.string().url().optional(),
  lastError: z.string().max(500).optional(),
  verificationResult: z.record(z.string(), z.unknown()).optional(),
  summary: z.string().max(1_000).optional(),
});

function requireInternalSecret(request: FastifyRequest): void {
  if (!env.INCIDENT_AUTOFIX_CALLBACK_SECRET || !verifyIncidentWebhookSecret(
    request.headers[INTERNAL_SECRET_HEADER],
    env.INCIDENT_AUTOFIX_CALLBACK_SECRET,
  )) throw new AuthError();
}

function digestFor(repairId: string): string {
  return createHmac("sha256", env.INCIDENT_AUTOFIX_CALLBACK_SECRET)
    .update(repairId)
    .digest("hex");
}

function digestMatches(actual: string, expected: string): boolean {
  const left = Buffer.from(actual);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function incidentAutofixInternalRoutes(app: FastifyInstance): Promise<void> {
  app.get("/internal/incident-autofix/unbriefed", async (request) => {
    requireInternalSecret(request);
    const repairs = await prisma.incidentRepair.findMany({
      where: { status: { in: BRIEFABLE_STATUSES } },
      orderBy: { updatedAt: "asc" },
      take: 25,
    });
    return {
      repairs: repairs
        .filter((repair) => repair.briefedStatus !== repair.status)
        .map((repair) => ({
          id: repair.id,
          provider: repair.provider,
          title: repair.title,
          severity: repair.severity,
          status: repair.status,
          risk: repair.risk,
          pullRequestUrl: repair.pullRequestUrl,
          lastError: repair.lastError,
          updatedAt: repair.updatedAt,
        })),
    };
  });

  app.get<{ Params: { id: string }; Querystring: { digest?: string } }>(
    "/internal/incident-autofix/:id/context",
    async (request) => {
      requireInternalSecret(request);
      const repair = await prisma.incidentRepair.findUnique({ where: { id: request.params.id } });
      if (!repair) throw new NotFoundError("Incident repair");
      const expected = repair.contextDigest || digestFor(repair.id);
      if (!request.query.digest || !digestMatches(request.query.digest, expected)) {
        throw new AuthError("Invalid incident context digest");
      }
      return {
        id: repair.id,
        provider: repair.provider,
        externalIssueId: repair.externalIssueId,
        fingerprint: repair.fingerprint,
        environment: repair.environment,
        releaseSha: repair.releaseSha,
        severity: repair.severity,
        title: repair.title,
        status: repair.status,
        providerUrl: repair.providerUrl,
        context: repair.sanitizedContext,
        dryRun: env.INCIDENT_AUTOFIX_DRY_RUN !== false,
        autoMerge: env.INCIDENT_AUTOFIX_AUTO_MERGE === true,
      };
    },
  );

  app.post<{ Params: { id: string } }>(
    "/internal/incident-autofix/:id/callback",
    async (request) => {
      requireInternalSecret(request);
      const parsed = callbackSchema.safeParse(request.body);
      if (!parsed.success) throw new ValidationError("Invalid incident repair callback");
      const current = await prisma.incidentRepair.findUnique({ where: { id: request.params.id } });
      if (!current) throw new NotFoundError("Incident repair");
      const body = parsed.data;
      const previousVerification = current.verificationResult
        && typeof current.verificationResult === "object"
        && !Array.isArray(current.verificationResult)
        ? current.verificationResult as Record<string, unknown>
        : {};
      const previousSignals = Array.isArray(previousVerification.signals)
        ? previousVerification.signals.filter((value): value is string => typeof value === "string")
        : [];
      const signal = typeof body.verificationResult?.signal === "string"
        ? body.verificationResult.signal.slice(0, 120)
        : undefined;
      const signals = signal ? [...new Set([...previousSignals, signal])] : previousSignals;
      const requestedStatus = body.status as IncidentRepairStatus;
      const status = requestedStatus === "verified" && signals.length < 2
        ? "verifying"
        : requestedStatus;
      const verificationResult = body.verificationResult
        ? { ...body.verificationResult, signals, consecutivePasses: signals.length }
        : undefined;
      const update: Prisma.IncidentRepairUpdateInput = {
        status,
        ...(body.risk ? { risk: body.risk as IncidentRisk } : {}),
        ...(body.branchName ? { branchName: body.branchName } : {}),
        ...(body.commitSha ? { commitSha: body.commitSha } : {}),
        ...(body.pullRequestNumber ? { pullRequestNumber: body.pullRequestNumber } : {}),
        ...(body.pullRequestUrl ? { pullRequestUrl: body.pullRequestUrl } : {}),
        ...(body.workflowRunId ? { workflowRunId: body.workflowRunId } : {}),
        ...(body.workflowRunUrl ? { workflowRunUrl: body.workflowRunUrl } : {}),
        ...(body.lastError ? { lastError: sanitizeIncidentText(body.lastError, 500) } : {}),
        ...(verificationResult
          ? { verificationResult: verificationResult as Prisma.InputJsonValue }
          : {}),
      };
      await prisma.$transaction([
        prisma.incidentRepair.update({ where: { id: current.id }, data: update }),
        prisma.incidentRepairEvent.create({
          data: {
            repairId: current.id,
            status,
            eventType: body.eventType,
            metadata: {
              ...(body.summary ? { summary: sanitizeIncidentText(body.summary, 1_000) } : {}),
            },
          },
        }),
      ]);
      return { updated: true };
    },
  );

  app.post<{ Params: { id: string } }>(
    "/internal/incident-autofix/:id/briefed",
    async (request) => {
      requireInternalSecret(request);
      const repair = await prisma.incidentRepair.findUnique({ where: { id: request.params.id } });
      if (!repair) throw new NotFoundError("Incident repair");
      await prisma.incidentRepair.update({
        where: { id: repair.id },
        data: { briefedStatus: repair.status, briefedAt: new Date() },
      });
      return { updated: true };
    },
  );

  app.post<{ Params: { id: string } }>(
    "/internal/incident-autofix/:id/retry",
    async (request) => {
      requireInternalSecret(request);
      const repair = await prisma.incidentRepair.findUnique({ where: { id: request.params.id } });
      if (!repair) throw new NotFoundError("Incident repair");
      if (repair.attemptCount >= 3) throw new ValidationError("Incident repair attempt limit reached");
      await prisma.incidentRepair.update({ where: { id: repair.id }, data: { status: "queued" } });
      await incidentAutofixQueue.add(
        QUEUE_INCIDENT_AUTOFIX,
        { repairId: repair.id },
        { jobId: `incident-repair-${repair.id}-retry-${repair.attemptCount + 1}` },
      );
      return { queued: true };
    },
  );

  app.post<{ Params: { id: string } }>(
    "/internal/incident-autofix/:id/cancel",
    async (request) => {
      requireInternalSecret(request);
      const repair = await prisma.incidentRepair.findUnique({ where: { id: request.params.id } });
      if (!repair) throw new NotFoundError("Incident repair");
      await prisma.$transaction([
        prisma.incidentRepair.update({ where: { id: repair.id }, data: { status: "cancelled" } }),
        prisma.incidentRepairEvent.create({
          data: { repairId: repair.id, status: "cancelled", eventType: "operator_cancelled" },
        }),
      ]);
      return { cancelled: true };
    },
  );
}
