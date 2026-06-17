/**
 * Recreate Unipile webhooks with Unipile-Auth header authentication.
 *
 * Deletes existing webhooks pointing at WEBHOOK_URL, then creates:
 *   - leadreacher-messaging  (source: messaging, events: message_received)
 *   - leadreacher-relations  (source: users, events: new_relation)
 *
 * Usage:
 *   pnpm --filter @leadreacher/api exec tsx src/scripts/recreate-unipile-webhooks.ts
 */
import path from "node:path";
import { config } from "dotenv";
import { resolveWebhookUrl } from "../lib/webhook-url.js";

config({ path: path.resolve(process.cwd(), ".env") });

type WebhookHeader = { key: string; value: string };

type CreateWebhookPayload = {
  request_url: string;
  source: "messaging" | "users";
  name: string;
  events: string[];
  headers: WebhookHeader[];
};

type WebhookListItem = {
  id: string;
  name?: string;
  request_url: string;
  source?: string;
  events?: string[];
};

type WebhookListResponse = {
  object: string;
  items: WebhookListItem[];
};

type CreateWebhookResponse = {
  object: string;
  webhook_id: string;
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`✗ Missing required env var: ${name}`);
    process.exit(1);
  }
  return value;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function unipileRequest<T>(
  dsn: string,
  apiKey: string,
  method: "GET" | "POST" | "DELETE",
  apiPath: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const url = `https://${dsn}/api/v1${apiPath}`;
  const init: RequestInit = {
    method,
    headers: {
      "X-API-KEY": apiKey,
      accept: "application/json",
    },
  };

  if (body !== undefined) {
    init.headers = {
      ...init.headers,
      "Content-Type": "application/json",
    };
    init.body = JSON.stringify(body);
  }

  const res = await fetch(url, init);
  const text = await res.text();

  if (!res.ok) {
    throw new Error(`${method} ${apiPath} failed (${res.status}): ${text}`);
  }

  return text ? (JSON.parse(text) as T) : ({} as T);
}

async function main(): Promise<void> {
  const dsn = requireEnv("UNIPILE_DSN");
  const apiKey = requireEnv("UNIPILE_API_KEY");
  const webhookSecret = requireEnv("UNIPILE_WEBHOOK_SECRET");
  const WEBHOOK_URL = resolveWebhookUrl(process.env);

  const authHeaders: WebhookHeader[] = [
    { key: "Unipile-Auth", value: webhookSecret },
    { key: "Content-Type", value: "application/json" },
  ];

  console.log(`Unipile webhook recreate → ${dsn}`);
  console.log(`Target URL: ${WEBHOOK_URL}\n`);

  const list = await unipileRequest<WebhookListResponse>(
    dsn,
    apiKey,
    "GET",
    "/webhooks",
  );

  const existing = (list.items ?? []).filter(
    (webhook) => webhook.request_url === WEBHOOK_URL,
  );

  if (existing.length === 0) {
    console.log("No existing webhooks matched WEBHOOK_URL.");
  } else {
    console.log(`Deleting ${existing.length} webhook(s) for ${WEBHOOK_URL}:`);
    for (const webhook of existing) {
      console.log(`  - ${webhook.id} (${webhook.name ?? "unnamed"})`);
      await unipileRequest(dsn, apiKey, "DELETE", `/webhooks/${webhook.id}`);
      console.log(`    deleted`);
    }
  }

  const webhooksToCreate: CreateWebhookPayload[] = [
    {
      name: "leadreacher-messaging",
      request_url: WEBHOOK_URL,
      source: "messaging",
      events: ["message_received"],
      headers: authHeaders,
    },
    {
      name: "leadreacher-relations",
      request_url: WEBHOOK_URL,
      source: "users",
      events: ["new_relation"],
      headers: authHeaders,
    },
  ];

  console.log("\nCreating webhooks:");
  for (const payload of webhooksToCreate) {
    const created = await unipileRequest<CreateWebhookResponse>(
      dsn,
      apiKey,
      "POST",
      "/webhooks",
      payload,
    );

    console.log(`✓ ${payload.name}`);
    console.log(`  webhook_id: ${created.webhook_id}`);
    console.log(`  source: ${payload.source}`);
    console.log(`  events: ${payload.events.join(", ")}`);
    console.log(`  request_url: ${payload.request_url}`);
    console.log(
      `  headers: ${payload.headers.map((h) => `${h.key}=${h.value.slice(0, 8)}…`).join(", ")}`,
    );
  }

  console.log("\nDone. Verify webhooks in the Unipile dashboard.");
}

main().catch((error) => {
  console.error(`✗ ${getErrorMessage(error)}`);
  process.exit(1);
});
