/**
 * Recreate the LeadReacher Unipile v2 webhook endpoint.
 *
 * UNIPILE_API_KEY must be a v2 Service API key because webhook management is
 * an application-level operation. The endpoint secret returned by Unipile
 * must be stored as UNIPILE_WEBHOOK_SECRET before deploying the API.
 */
import path from "node:path";
import { config } from "dotenv";
import { resolveWebhookUrl } from "../lib/webhook-url.js";

config({ path: path.resolve(process.cwd(), ".env") });

const BASE_URL = "https://api.unipile.com/v2";
const TRIGGER_EVENTS = [
  "message.new",
  "email.new",
  "relation.new",
  "account.status.running",
  "account.status.disconnected",
  "account.status.errored",
  "account.status.degraded",
  "account.status.partial",
] as const;

type WebhookEndpoint = {
  id: string;
  url: string;
  description?: string;
};

type WebhookEndpointList = {
  data: WebhookEndpoint[];
};

type CreatedWebhookEndpoint = WebhookEndpoint & {
  secret: string;
};

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

async function request<T>(
  apiKey: string,
  method: "GET" | "POST" | "DELETE",
  apiPath: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(`${BASE_URL}${apiPath}`, {
    method,
    headers: {
      "X-API-KEY": apiKey,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${method} ${apiPath} failed (${response.status}): ${text}`);
  }
  return text ? JSON.parse(text) as T : {} as T;
}

async function main(): Promise<void> {
  const apiKey = requireEnv("UNIPILE_API_KEY");
  const webhookUrl = resolveWebhookUrl(process.env);
  const list = await request<WebhookEndpointList>(apiKey, "GET", "/webhooks/endpoints/");
  const existing = list.data.filter((endpoint) => endpoint.url === webhookUrl);
  for (const endpoint of existing) {
    await request(apiKey, "DELETE", `/webhooks/endpoints/${endpoint.id}`);
  }

  const created = await request<CreatedWebhookEndpoint>(
    apiKey,
    "POST",
    "/webhooks/endpoints/",
    {
      url: webhookUrl,
      description: "LeadReacher production events",
      trigger_events: [...TRIGGER_EVENTS],
    },
  );

  console.log(JSON.stringify({
    endpointId: created.id,
    url: created.url,
    triggerEvents: TRIGGER_EVENTS,
    secretRequiresConfiguration: Boolean(created.secret),
  }, null, 2));
  if (created.secret) {
    console.log("Store the newly returned endpoint secret as UNIPILE_WEBHOOK_SECRET.");
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
