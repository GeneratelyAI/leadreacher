/** Read-only release gate. It never creates campaigns or sends outreach. */
import {
  assertLiveProviderModes,
  assertProviderReadiness,
  runProductionPreflight,
} from "../lib/production-preflight.js";

async function main(): Promise<void> {
  // Keep the live-mode policy in this protected command. Shared provider
  // readiness checks are also used by staging with Stripe test-mode.
  assertLiveProviderModes();
  const report = await runProductionPreflight();
  assertProviderReadiness(report);
  console.info(JSON.stringify(report));
}

void main().catch((error: unknown) => {
  console.error("Production preflight failed", error);
  process.exit(1);
});
