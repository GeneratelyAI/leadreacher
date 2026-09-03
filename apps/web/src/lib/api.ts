import { getBrowserSession } from "@/lib/supabase/client";
import { defaultOrgNameFromEmail } from "@/lib/auth/org-name";
import {
  isOnboardingPreview,
  previewApiFetch,
  previewOrganization,
  usesOnboardingFixtures,
} from "@/lib/onboarding/preview-api";

const TOKEN_CACHE_TTL_MS = 45_000;

let tokenCache: { value: string; expiresAt: number } | null = null;
let tokenRequest: Promise<string | null> | null = null;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly requestId?: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type ApiErrorPayload = {
  status?: number;
  message?: string;
  code?: string;
  error?: string;
  requestId?: string;
  details?: Record<string, unknown>;
};

function apiErrorFromResponse(
  response: Response,
  payload: ApiErrorPayload | null,
): ApiError {
  const message = payload?.message ?? payload?.error ?? response.statusText;
  const requestId = payload?.requestId ?? response.headers.get("X-Request-Id") ?? undefined;
  return new ApiError(
    message,
    response.status,
    payload?.code,
    requestId,
    payload?.details,
  );
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
    const session = await getBrowserSession();
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
  const usesRealPreviewConnection =
    isOnboardingPreview() && path.startsWith("/social-accounts");
  if (usesOnboardingFixtures() && !usesRealPreviewConnection) {
    return previewApiFetch<T>(path, options);
  }

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

  const payload = (await response.json().catch(() => null)) as ApiErrorPayload | T | null;

  if (!response.ok) {
    throw apiErrorFromResponse(response, payload as ApiErrorPayload | null);
  }

  return payload as T;
}

export async function apiStream(path: string, signal: AbortSignal): Promise<Response> {
  const token = await getAccessToken();
  if (!token) throw new ApiError("Not authenticated", 401, "UNAUTHORIZED");
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "text/event-stream" },
    signal,
    cache: "no-store",
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as ApiErrorPayload | null;
    throw apiErrorFromResponse(response, payload);
  }
  return response;
}

export async function apiBlob(path: string, signal?: AbortSignal): Promise<Blob> {
  const token = await getAccessToken();
  if (!token) throw new ApiError("Not authenticated", 401, "UNAUTHORIZED");
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as ApiErrorPayload | null;
    throw apiErrorFromResponse(response, payload);
  }
  return response.blob();
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

/**
 * Reuse the authenticated user's workspace name whenever a client onboarding
 * step needs to resolve the current organization. The API is idempotent, so
 * this name only affects a first-time bootstrap.
 */
export async function bootstrapCurrentOrganization(
  anonScrapeId?: string,
  accountType?: "individual" | "company",
) {
  if (usesOnboardingFixtures()) return previewOrganization();
  const session = await getBrowserSession();
  return bootstrapOrganization(
    defaultOrgNameFromEmail(session?.user?.email ?? ""),
    anonScrapeId,
    accountType,
  );
}
