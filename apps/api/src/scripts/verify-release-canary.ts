import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import {
  evaluateReleaseCanary,
  type ReleaseCanaryReport,
} from "../lib/release-canary.js";

const reportPath = process.env.RELEASE_CANARY_REPORT_PATH ?? "artifacts/release-linkedin-canary.json";

async function writeReport(report: ReleaseCanaryReport): Promise<void> {
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

function getRequiredValue(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function booleanValue(name: string, fallback: boolean): boolean {
  const value = process.env[name];
  if (value === undefined || value === "") return fallback;
  return value.toLowerCase() === "true";
}

async function main(): Promise<void> {
  const attemptId = getRequiredValue("RELEASE_CANARY_ATTEMPT_ID");
  const databaseUrl = getRequiredValue("DATABASE_URL");
  const expectedCampaignStatus = process.env.RELEASE_CANARY_EXPECTED_CAMPAIGN_STATUS ?? "active";
  const requireInboundReconciliation = booleanValue(
    "RELEASE_CANARY_REQUIRE_INBOUND_RECONCILIATION",
    true,
  );
  const pool = new Pool({ connectionString: databaseUrl });
  const db = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const attempt = await db.manualDeliveryAttempt.findUnique({
      where: { id: attemptId },
      select: {
        state: true,
        providerRef: true,
        reservedAt: true,
        sentAt: true,
        message: {
          select: {
            campaignId: true,
            leadId: true,
            channel: true,
            externalId: true,
            sentAt: true,
            status: true,
          },
        },
        campaignLead: {
          select: {
            campaignId: true,
            leadId: true,
            campaign: { select: { status: true } },
          },
        },
      },
    });
    if (!attempt) {
      throw new Error("Release canary delivery attempt was not found in staging");
    }

    const inboundReconciliationCount = await db.message.count({
      where: {
        campaignId: attempt.campaignLead.campaignId,
        leadId: attempt.campaignLead.leadId,
        channel: "linkedin",
        direction: "inbound",
        status: "replied",
        // Do not let a historical reply for the same campaign lead satisfy a
        // new release canary. Evidence must follow this manual delivery.
        createdAt: { gte: attempt.sentAt ?? attempt.reservedAt },
      },
    });
    const report = evaluateReleaseCanary(
      {
        manualAttemptState: attempt.state,
        manualAttemptProviderRef: attempt.providerRef,
        manualAttemptSentAt: attempt.sentAt,
        message: attempt.message,
        campaignLead: {
          campaignId: attempt.campaignLead.campaignId,
          leadId: attempt.campaignLead.leadId,
          campaignStatus: attempt.campaignLead.campaign.status,
        },
        inboundReconciliationCount,
      },
      { expectedCampaignStatus, requireInboundReconciliation },
    );
    await writeReport(report);
    if (!report.passed) {
      throw new Error(
        `Release canary evidence is incomplete: ${report.checks
          .filter((check) => !check.passed)
          .map((check) => check.name)
          .join(", ")}`,
      );
    }

    console.info(JSON.stringify(report));
  } finally {
    await db.$disconnect();
    await pool.end();
  }
}

void main().catch(async (error: unknown) => {
  const diagnostic = error instanceof Error ? error.message : String(error);
  try {
    await writeReport({
      target: "staging-release-canary",
      checkedAt: new Date().toISOString(),
      passed: false,
      checks: [{ name: "release-canary-bootstrap", passed: false, diagnostic }],
    });
  } catch {
    // Preserve the original verification failure if artifact storage is unavailable.
  }
  console.error("Release canary verification failed", diagnostic);
  process.exit(1);
});
