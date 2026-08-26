const baseUrl = process.env.INCIDENT_AUTOFIX_API_BASE_URL?.replace(/\/$/, "");
const repairId = process.env.INCIDENT_REPAIR_ID;
const secret = process.env.INCIDENT_AUTOFIX_CALLBACK_SECRET;
const rawPayload = process.env.INCIDENT_CALLBACK_PAYLOAD;

if (!baseUrl || !repairId || !secret || !rawPayload) {
  throw new Error("Incident callback configuration is incomplete");
}
if (!/^c[a-z0-9]{8,40}$/i.test(repairId)) throw new Error("Invalid incident repair id");
async function main(): Promise<void> {
  const payload = JSON.parse(rawPayload!) as unknown;
  const response = await fetch(
    `${baseUrl}/internal/incident-autofix/${encodeURIComponent(repairId!)}/callback`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-leadreacher-autofix-secret": secret!,
      },
      body: JSON.stringify(payload),
    },
  );
  if (!response.ok) throw new Error(`Incident callback failed with ${response.status}`);
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Incident callback failed");
  process.exitCode = 1;
});
