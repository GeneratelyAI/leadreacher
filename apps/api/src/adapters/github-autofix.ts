import { env } from "../config/env.js";

export type IncidentDispatchPayload = {
  repairId: string;
  provider: string;
  externalIssueId: string;
  releaseSha: string;
  severity: string;
  contextDigest: string;
};

export async function dispatchIncidentAutofix(payload: IncidentDispatchPayload): Promise<void> {
  if (!env.GITHUB_AUTOFIX_TOKEN) throw new Error("GITHUB_AUTOFIX_TOKEN is not configured");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(
      `https://api.github.com/repos/${env.GITHUB_AUTOFIX_REPOSITORY}/dispatches`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.GITHUB_AUTOFIX_TOKEN}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        body: JSON.stringify({ event_type: "incident_autofix", client_payload: payload }),
        signal: controller.signal,
      },
    );
    if (!response.ok) throw new Error(`GitHub dispatch failed with ${response.status}`);
  } finally {
    clearTimeout(timeout);
  }
}

