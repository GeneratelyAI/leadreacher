import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const reportPath = process.env.PROVIDER_CANARY_REPORT_PATH ?? "artifacts/staging-provider-canary.json";

type CanaryReport = {
  target: "staging" | "production";
  checkedAt: string;
  checks: Array<{
    provider: "stripe" | "unipile" | "r2" | "apify" | "bootstrap";
    status: "passed" | "failed" | "skipped";
    durationMs: number;
    diagnostic?: string;
  }>;
  passed: boolean;
};

async function writeReport(report: CanaryReport): Promise<void> {
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

async function main(): Promise<void> {
  // Import lazily so an invalid staging configuration still produces an
  // archived bootstrap diagnostic instead of failing before the error handler.
  const { assertProviderReadiness, runProviderReadinessChecks } = await import(
    "../lib/production-preflight.js"
  );
  const report = await runProviderReadinessChecks({ target: "staging" });
  await writeReport(report);
  assertProviderReadiness(report);
  console.info(JSON.stringify(report));
}

void main().catch(async (error: unknown) => {
  const diagnostic = error instanceof Error ? error.message : String(error);
  try {
    await writeReport({
      target: "staging",
      checkedAt: new Date().toISOString(),
      checks: [
        {
          provider: "bootstrap",
          status: "failed",
          durationMs: 0,
          diagnostic,
        },
      ],
      passed: false,
    });
  } catch {
    // Preserve the original provider/bootstrap failure when artifact storage is unavailable.
  }
  console.error("Staging provider canary failed", error);
  process.exit(1);
});
