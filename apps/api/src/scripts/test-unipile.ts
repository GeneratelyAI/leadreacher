/**
 * Unipile ↔ LinkedIn connection smoke test.
 *
 * Read-only verification that a LinkedIn account connected through Unipile is
 * reachable from our API. See docs/unipile-connection-testing.md.
 *
 * Reads UNIPILE_DSN / UNIPILE_API_KEY directly from process.env (via .env) so a
 * database is NOT required — it does not import config/env.ts.
 *
 * Usage:
 *   pnpm --filter @leadreacher/api exec tsx src/scripts/test-unipile.ts
 *   pnpm --filter @leadreacher/api exec tsx src/scripts/test-unipile.ts <accountId> <publicId>
 *
 * Args (optional):
 *   accountId  override the account used for T2/T3/T4 (defaults to first listed)
 *   publicId   public LinkedIn slug to fetch in T3/T4 (defaults to "james-hartley-632b55415")
 */
import path from "node:path";
import { config } from "dotenv";
import { UnipileAdapter, isAccountHealthy } from "../adapters/unipile.js";

config({ path: path.resolve(process.cwd(), ".env") });

const DEFAULT_PUBLIC_ID = "james-hartley-632b55415";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`✗ Missing required env var: ${name}`);
    console.error("  Set UNIPILE_DSN and UNIPILE_API_KEY in apps/api/.env");
    process.exit(1);
  }
  return value;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function runTest<T>(
  label: string,
  fn: () => Promise<T>,
): Promise<{ ok: boolean; result?: T }> {
  try {
    const result = await fn();
    console.log(`✓ PASS  ${label}`);
    return { ok: true, result };
  } catch (error) {
    console.error(`✗ FAIL  ${label}`);
    console.error(`        ${getErrorMessage(error)}`);
    return { ok: false };
  }
}

async function main(): Promise<void> {
  const dsn = requireEnv("UNIPILE_DSN");
  const apiKey = requireEnv("UNIPILE_API_KEY");
  const [accountIdArg, publicIdArg] = process.argv.slice(2);
  const publicId = publicIdArg ?? DEFAULT_PUBLIC_ID;

  const adapter = new UnipileAdapter({ dsn, apiKey });

  console.log(`Unipile smoke test → ${dsn}\n`);

  // T1 — credentials + connected accounts
  const t1 = await runTest("T1  GET /accounts (credentials + account list)", () =>
    adapter.listAccounts(),
  );

  if (!t1.ok) {
    console.error("\nT1 failed — cannot continue. Check API key / DSN.");
    process.exit(1);
  }

  const accounts = t1.result?.items ?? [];
  console.log(`        ${accounts.length} account(s) connected:`);
  for (const acct of accounts) {
    console.log(`          - ${acct.id} (${acct.type})${acct.name ? ` — ${acct.name}` : ""}`);
  }

  const accountId = accountIdArg ?? accounts[0]?.id;
  if (!accountId) {
    console.error(
      "\nNo account_id available. Connect a LinkedIn account in the Unipile dashboard,",
    );
    console.error("or pass one explicitly: ... test-unipile.ts <accountId>");
    process.exit(1);
  }
  console.log(`\n  Using account_id: ${accountId}\n`);

  // T2 — specific account health (every source must report OK)
  const t2 = await runTest(`T2  getAccountStatus(${accountId})`, async () => {
    const account = await adapter.getAccountStatus(accountId);
    const sources = account.sources
      .map((s) => `${s.id}=${s.status}`)
      .join(", ");
    console.log(`        type: ${account.type}; sources: ${sources || "none"}`);
    if (!isAccountHealthy(account)) {
      throw new Error("account is not healthy (a source is not OK)");
    }
    return account;
  });

  if (!t2.ok) {
    console.error("\nT2 failed — account unhealthy, skipping T3/T4/T5.");
    process.exit(1);
  }

  // T3 — authenticated LinkedIn call + capture provider_id for T4
  const t3 = await runTest(
    `T3  getProfile(account, "${publicId}")`,
    () => adapter.getProfile(accountId, publicId),
  );
  if (t3.ok && t3.result) {
    const p = t3.result;
    console.log(`        ${p.first_name} ${p.last_name} — ${p.headline}`);
    console.log(`        provider_id: ${p.provider_id}`);
  }

  if (!t3.ok || !t3.result) {
    console.error("\nT3 failed — cannot get provider_id, skipping T4/T5.");
    process.exit(1);
  }

  const providerId = t3.result.provider_id;

  // T4 — send connection invite
  const t4 = await runTest(
    `T4  sendConnectionInvite(account, "${publicId}", message)`,
    () =>
      adapter.sendConnectionInvite(
        accountId,
        providerId,
      ),
  );
  if (t4.ok) {
    console.log(`        invite sent to provider_id: ${providerId}`);
  }

  // T5 — open a chat (startChat sends the opening message directly)
  // Only runs if T4 passed — connection invite must be accepted before
  // startChat works on LinkedIn. This will likely fail immediately on a
  // fresh invite; it confirms the API call reaches Unipile correctly.
  const t5 = await runTest(
    `T5  startChat(account, "${publicId}", message)`,
    () =>
      adapter.startChat(
        accountId,
        providerId,
        "Follow-up test message from LeadReacher.",
      ),
  );
  if (t5.ok && t5.result) {
    console.log(`        chat_id: ${t5.result.chat_id}`);
  }

  const results = [t1.ok, t2.ok, t3.ok, t4.ok, t5.ok];
  const passed = results.filter(Boolean).length;
  console.log(`\nResult: ${passed}/5 passed.`);
  process.exit(passed === 5 ? 0 : 1);
}

void main();