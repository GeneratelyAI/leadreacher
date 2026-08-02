import { createClient } from "@/lib/supabase/client";

const TOKEN_CACHE_TTL_MS = 45_000;

let tokenCache: { value: string; expiresAt: number } | null = null;
let tokenRequest: Promise<string | null> | null = null;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function getApiBaseUrl(): string {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!baseUrl) {
    throw new Error("NEXT_PUBLIC_API_URL is not configured");
  }
  return baseUrl.replace(/\/$/, "");
}

export async function getAccessToken(): Promise<string | null> {
  if (tokenCache && tokenCache.expiresAt > Date.now()) {
    return tokenCache.value;
  }

  if (tokenRequest) return tokenRequest;

  tokenRequest = (async () => {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token ?? null;

    tokenCache = token
      ? { value: token, expiresAt: Date.now() + TOKEN_CACHE_TTL_MS }
      : null;
    return token;
  })();

  try {
    return await tokenRequest;
  } finally {
    tokenRequest = null;
  }
}

/** Reset cached browser auth after an explicit authentication state change. */
export function clearAccessTokenCache(): void {
  tokenCache = null;
  tokenRequest = null;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = await getAccessToken();
  if (!token) {
    throw new ApiError("Not authenticated", 401, "UNAUTHORIZED");
  }

  const headers = new Headers(options.headers);
  headers.set("Authorization", `Bearer ${token}`);
  const isFormData =
    typeof FormData !== "undefined" && options.body instanceof FormData;
  if (options.body && !isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const url = `${getApiBaseUrl()}${path}`;

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Network error";
    throw new ApiError(
      `Cannot reach API at ${url}. Is the backend running? (${reason})`,
      0,
      "NETWORK_ERROR",
    );
  }

  const payload = (await response.json().catch(() => null)) as
    | { message?: string; code?: string; error?: string }
    | T
    | null;

  if (!response.ok) {
    const payloadMessage =
      payload &&
      typeof payload === "object" &&
      "message" in payload &&
      typeof payload.message === "string"
        ? payload.message
        : payload &&
            typeof payload === "object" &&
            "error" in payload &&
            typeof payload.error === "string"
          ? payload.error
          : null;
    const message = payloadMessage ?? response.statusText;
    const code =
      payload &&
      typeof payload === "object" &&
      "code" in payload &&
      typeof payload.code === "string"
        ? payload.code
        : undefined;
    throw new ApiError(message, response.status, code);
  }

  return payload as T;
}

export async function bootstrapOrganization(
  name: string,
  anonScrapeId?: string,
  accountType?: "individual" | "company",
): Promise<{
  orgId: string;
  userId: string;
  subscriptionStatus: string | null;
  onboardedAt: string | null;
  activeChannelCount: number;
  scrapeStatus?: {
    status: "idle" | "running" | "completed" | "failed";
    url: string | null;
    market: string;
    offer: string;
    audience: string;
    value: string;
    strategyStatus: string;
    error: string | null;
  } | null;
}> {
  return apiFetch("/auth/bootstrap", {
    method: "POST",
    body: JSON.stringify({
      name,
      ...(anonScrapeId ? { anonScrapeId } : {}),
      ...(accountType ? { accountType } : {}),
    }),
  });
}
