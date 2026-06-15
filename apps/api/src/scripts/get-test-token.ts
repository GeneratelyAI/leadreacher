/**
 * Sign in a test user via Supabase Auth and print their access_token for curl.
 *
 * Reads env directly from apps/api/.env (does not import config/env.ts).
 *
 * Usage:
 *   pnpm exec tsx src/scripts/get-test-token.ts <email> <password>
 *
 * Env (set in apps/api/.env; copy anon key from apps/web/.env.local if missing):
 *   SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY
 */
import path from "node:path";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: path.resolve(process.cwd(), ".env"), quiet: true });

function requireEnv(primary: string, fallback?: string): string {
  const value = process.env[primary] ?? (fallback ? process.env[fallback] : undefined);
  if (!value) {
    const names = fallback ? `${primary} or ${fallback}` : primary;
    console.error(`✗ Missing required env var: ${names}`);
    console.error(
      "  Add to apps/api/.env (copy from apps/web/.env.local if needed):",
    );
    console.error("    SUPABASE_URL=https://<ref>.supabase.co");
    console.error("    SUPABASE_ANON_KEY=<anon key>");
    process.exit(1);
  }
  return value;
}

function usage(): never {
  console.error(
    "Usage: pnpm exec tsx src/scripts/get-test-token.ts <email> <password>",
  );
  process.exit(1);
}

async function main(): Promise<void> {
  const email = process.argv[2];
  const password = process.argv[3];
  if (!email || !password) {
    usage();
  }

  const supabaseUrl = requireEnv("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = requireEnv(
    "SUPABASE_ANON_KEY",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  );

  const supabase = createClient(supabaseUrl, anonKey);

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    console.error(`✗ Sign-in failed: ${error.message}`);
    process.exit(1);
  }

  const accessToken = data.session?.access_token;
  if (!accessToken) {
    console.error(
      "✗ Sign-in succeeded but no session access_token was returned (email confirmation required?)",
    );
    process.exit(1);
  }

  const apiPort = process.env.PORT ?? "3001";
  console.error(
    `Example: curl http://localhost:${apiPort}/leads -H "Authorization: Bearer ${accessToken}"`,
  );
  console.log(accessToken);
}

main().catch((error: unknown) => {
  console.error(
    "✗ Unexpected error:",
    error instanceof Error ? error.message : String(error),
  );
  process.exit(1);
});
