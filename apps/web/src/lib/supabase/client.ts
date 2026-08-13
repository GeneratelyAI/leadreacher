import { createBrowserClient } from "@supabase/ssr";
import type { Session } from "@supabase/supabase-js";

const INVALID_REFRESH_TOKEN_PATTERN = /invalid refresh token|refresh token not found/i;

let browserClient: ReturnType<typeof createBrowserClient> | undefined;

export function createClient() {
  // The browser needs access to the session because this application calls a
  // separate API with a bearer token. Keep session storage in Supabase's SSR
  // cookies rather than localStorage; moving the token to HttpOnly cookies
  // would require routing those API calls through a server-side BFF.
  browserClient ??= createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: {
        path: "/",
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      },
    },
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
