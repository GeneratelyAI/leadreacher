import { createClient } from "@/lib/supabase/client";

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
  const supabase = createClient();

  // Validate with Supabase Auth (and refresh if needed). getSession() alone can
  // return a stale or non-Supabase token from browser storage.
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return null;
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session?.access_token ?? null;
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
    const message =
      payload &&
      typeof payload === "object" &&
      "message" in payload &&
      typeof payload.message === "string"
        ? payload.message
        : response.statusText;
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
    }),
  });
}
