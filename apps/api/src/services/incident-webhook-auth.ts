import { createHmac, timingSafeEqual } from "node:crypto";

export const INCIDENT_WEBHOOK_SECRET_HEADER = "x-leadreacher-webhook-secret";
export const SENTRY_HOOK_SIGNATURE_HEADER = "sentry-hook-signature";

function secureStringEqual(actual: string, expected: string): boolean {
  const actualBuffer = Buffer.from(actual, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  if (actualBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(actualBuffer, expectedBuffer);
}

export function verifyIncidentWebhookSecret(
  provided: string | string[] | undefined,
  expected: string,
): boolean {
  if (!expected || typeof provided !== "string") return false;
  return secureStringEqual(provided, expected);
}

export function verifySentryWebhookSignature(
  payload: unknown,
  provided: string | string[] | undefined,
  clientSecret: string,
): boolean {
  if (!clientSecret || typeof provided !== "string") return false;

  let serializedPayload: string;
  try {
    serializedPayload = JSON.stringify(payload);
  } catch {
    return false;
  }

  const expected = createHmac("sha256", clientSecret)
    .update(serializedPayload, "utf8")
    .digest("hex");
  return secureStringEqual(provided, expected);
}
