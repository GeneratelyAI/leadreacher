import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

type PendingRepair = { id: string };
type PendingResponse = { repairs?: PendingRepair[] };
type ClaimResponse = { claimed?: boolean; contextDigest?: string };

const baseUrl = process.env.INCIDENT_AUTOFIX_API_BASE_URL?.replace(/\/$/, "");
const secret = process.env.INCIDENT_AUTOFIX_CALLBACK_SECRET;
const outputPath = process.env.INCIDENT_CONTEXT_OUTPUT || "artifacts/incident-context.json";

if (!baseUrl || !secret) throw new Error("Incident subscription runner configuration is incomplete");

const headers = { "x-leadreacher-autofix-secret": secret };

async function readJson<T>(response: Response, label: string): Promise<T> {
  if (!response.ok) throw new Error(`${label} failed with ${response.status}`);
  return response.json() as Promise<T>;
}

async function main(): Promise<void> {
  const pending = await readJson<PendingResponse>(
    await fetch(`${baseUrl}/internal/incident-autofix/pending`, { headers }),
    "Pending incident fetch",
  );
  const repair = pending.repairs?.[0];
  if (!repair) {
    console.log(JSON.stringify({ claimed: false }));
    return;
  }
  if (!/^c[a-z0-9]{8,40}$/i.test(repair.id)) throw new Error("Invalid incident repair id");

  const claim = await readJson<ClaimResponse>(
    await fetch(`${baseUrl}/internal/incident-autofix/${encodeURIComponent(repair.id)}/claim`, {
      method: "POST",
      headers,
    }),
    "Incident claim",
  );
  if (!claim.claimed || !claim.contextDigest) {
    console.log(JSON.stringify({ claimed: false }));
    return;
  }
  if (!/^[a-f0-9]{64}$/i.test(claim.contextDigest)) throw new Error("Invalid context digest");

  const context = await readJson<unknown>(
    await fetch(
      `${baseUrl}/internal/incident-autofix/${encodeURIComponent(repair.id)}/context?digest=${claim.contextDigest}`,
      { headers },
    ),
    "Incident context fetch",
  );
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(context, null, 2)}\n`, { mode: 0o600 });
  console.log(JSON.stringify({ claimed: true, repairId: repair.id }));
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Incident claim failed");
  process.exitCode = 1;
});
