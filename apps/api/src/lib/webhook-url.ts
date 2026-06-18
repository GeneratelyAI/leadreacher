const WEBHOOK_PATH = "/webhooks/unipile";

export function resolveWebhookUrl(
  env: Record<string, string | undefined>,
): string {
  const explicit = env.UNIPILE_WEBHOOK_URL?.trim();
  if (explicit) {
    return explicit;
  }

  const base = env.PUBLIC_BASE_URL?.trim();
  if (base) {
    return `${base.replace(/\/+$/, "")}${WEBHOOK_PATH}`;
  }

  throw new Error(
    "Set UNIPILE_WEBHOOK_URL (full URL) or PUBLIC_BASE_URL (host) in apps/api/.env to register webhooks",
  );
}
