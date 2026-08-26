import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const baseUrl = process.env.INCIDENT_AUTOFIX_API_BASE_URL?.replace(/\/$/, "");
const repairId = process.env.INCIDENT_REPAIR_ID;
const digest = process.env.INCIDENT_CONTEXT_DIGEST;
const secret = process.env.INCIDENT_AUTOFIX_CALLBACK_SECRET;
const outputPath = process.env.INCIDENT_CONTEXT_OUTPUT || "artifacts/incident-context.json";

if (!baseUrl || !repairId || !digest || !secret) {
  throw new Error("Incident context fetch configuration is incomplete");
}
if (!/^c[a-z0-9]{8,40}$/i.test(repairId)) throw new Error("Invalid incident repair id");
if (!/^[a-f0-9]{64}$/i.test(digest)) throw new Error("Invalid incident context digest");

async function main(): Promise<void> {
  const response = await fetch(
    `${baseUrl}/internal/incident-autofix/${encodeURIComponent(repairId!)}/context?digest=${digest}`,
    { headers: { "x-leadreacher-autofix-secret": secret! } },
  );
  if (!response.ok) throw new Error(`Incident context fetch failed with ${response.status}`);
  const context = await response.json();
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(context, null, 2)}\n`, { mode: 0o600 });
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Incident context fetch failed");
  process.exitCode = 1;
});
