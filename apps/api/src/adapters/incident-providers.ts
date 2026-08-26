import { env } from "../config/env.js";
import { sanitizeIncidentText, sanitizeProviderUrl } from "../services/incident-sanitizer.js";

type IncidentContext = {
  culprit?: string;
  occurrenceCount?: number;
  affectedUsers?: number;
  monitorUrl?: string;
  cause?: string;
  status?: string;
};

async function fetchJson(url: string, token: string): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Provider request failed with ${response.status}`);
    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export async function fetchSentryIncidentContext(issueId: string): Promise<IncidentContext> {
  if (!env.SENTRY_API_TOKEN) return {};
  const data = asRecord(await fetchJson(
    `https://sentry.io/api/0/issues/${encodeURIComponent(issueId)}/`,
    env.SENTRY_API_TOKEN,
  ));
  return {
    culprit: sanitizeIncidentText(data.culprit, 240) || undefined,
    occurrenceCount: Number.isFinite(Number(data.count)) ? Number(data.count) : undefined,
    affectedUsers: Number.isFinite(Number(data.userCount)) ? Number(data.userCount) : undefined,
    status: sanitizeIncidentText(data.status, 40) || undefined,
  };
}

export async function fetchBetterStackIncidentContext(incidentId: string): Promise<IncidentContext> {
  if (!env.BETTERSTACK_API_TOKEN) return {};
  const root = asRecord(await fetchJson(
    `https://uptime.betterstack.com/api/v3/incidents/${encodeURIComponent(incidentId)}`,
    env.BETTERSTACK_API_TOKEN,
  ));
  const data = asRecord(root.data);
  const attributes = asRecord(data.attributes);
  return {
    monitorUrl: sanitizeProviderUrl(attributes.url),
    cause: sanitizeIncidentText(attributes.cause, 240) || undefined,
    status: sanitizeIncidentText(attributes.status, 40) || undefined,
  };
}

