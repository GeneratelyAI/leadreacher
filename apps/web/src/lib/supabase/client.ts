import { createBrowserClient } from "@supabase/ssr";
import type { Session } from "@supabase/supabase-js";

const INVALID_REFRESH_TOKEN_PATTERN = /invalid refresh token|refresh token not found/i;

let browserClient: ReturnType<typeof createBrowserClient> | undefined;

export function createClient() {
  browserClient ??= createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  return browserClient;
}

function isInvalidRefreshTokenError(error: unknown): boolean {
  return error instanceof Error && INVALID_REFRESH_TOKEN_PATTERN.test(error.message);
}

async function clearInvalidBrowserSession(): Promise<void> {
  try {
    await createClient().auth.signOut({ scope: "local" });
  } catch {
    // The local cookie may already be gone. The original refresh error is
    // intentionally suppressed so a stale session cannot trap the user.
  }
}

/**
 * Reads the current browser session without leaving a stale refresh token in
 * storage. Supabase rotates refresh tokens, so a session restored in another
 * browser tab can legitimately become invalid here.
 */
export async function getBrowserSession(): Promise<Session | null> {
  const supabase = createClient();

  try {
    const { data, error } = await supabase.auth.getSession();
    if (!error) return data.session;

    if (isInvalidRefreshTokenError(error)) {
      await clearInvalidBrowserSession();
      return null;
    }

    throw error;
  } catch (error) {
    if (isInvalidRefreshTokenError(error)) {
      await clearInvalidBrowserSession();
      return null;
    }

    throw error;
  }
}
