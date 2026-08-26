import { timingSafeEqual } from "node:crypto";

export const INCIDENT_WEBHOOK_SECRET_HEADER = "x-leadreacher-webhook-secret";

export function verifyIncidentWebhookSecret(
  provided: string | string[] | undefined,
  expected: string,
): boolean {
  if (!expected || typeof provided !== "string") return false;
  const actualBuffer = Buffer.from(provided, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  if (actualBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(actualBuffer, expectedBuffer);
}

