/** Read-only release gate. It never creates campaigns or sends outreach. */
import { runProductionPreflight } from "../lib/production-preflight.js";

async function main(): Promise<void> {
  await runProductionPreflight();
  console.info("Production preflight passed: Stripe, Unipile, and R2 are reachable.");
}

void main().catch((error: unknown) => {
  console.error("Production preflight failed", error);
  process.exit(1);
});
