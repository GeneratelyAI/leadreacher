import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiFetch, apiStream, clearAccessTokenCache } from "../api";

const { getBrowserSession } = vi.hoisted(() => ({ getBrowserSession: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({
  getBrowserSession,
}));

describe("API error parsing", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_URL = "https://api.example.test";
    clearAccessTokenCache();
    getBrowserSession.mockReset().mockResolvedValue({ access_token: "test-token" });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("parses the unified error envelope and structured details", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      status: 429,
      code: "daily_message_limit",
      message: "Daily limit reached",
      requestId: "req-payload",
      details: { resetAt: "2026-08-06T00:00:00.000Z" },
    }), {
      status: 429,
      headers: { "content-type": "application/json", "X-Request-Id": "req-header" },
    })));

    const error = await apiFetch("/dashboard/conversations").catch((caught) => caught);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 429,
      code: "daily_message_limit",
      message: "Daily limit reached",
      requestId: "req-payload",
      details: { resetAt: "2026-08-06T00:00:00.000Z" },
    });
  });

  it("keeps compatibility with legacy error payloads and header request IDs", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: "Legacy failure",
      code: "LEGACY_ERROR",
    }), {
      status: 502,
      headers: { "content-type": "application/json", "X-Request-Id": "req-legacy" },
    })));

    const error = await apiFetch("/legacy").catch((caught) => caught);
    expect(error).toMatchObject({
      status: 502,
      code: "LEGACY_ERROR",
      message: "Legacy failure",
      requestId: "req-legacy",
    });
  });

  it("parses JSON error envelopes for streams", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      status: 504,
      code: "EXTERNAL_SERVICE_TIMEOUT",
      message: "Groq timed out",
      requestId: "req-stream",
      details: { service: "Groq" },
    }), {
      status: 504,
      headers: { "content-type": "application/json" },
    })));

    const error = await apiStream("/stream", new AbortController().signal).catch(
      (caught) => caught,
    );
    expect(error).toMatchObject({
      status: 504,
      code: "EXTERNAL_SERVICE_TIMEOUT",
      requestId: "req-stream",
      details: { service: "Groq" },
    });
  });

  it("returns an unauthorized error after a stale browser session is cleared", async () => {
    getBrowserSession.mockResolvedValueOnce(null);

    const error = await apiFetch("/dashboard/conversations").catch((caught) => caught);

    expect(error).toMatchObject({
      status: 401,
      code: "UNAUTHORIZED",
      message: "Not authenticated",
    });
  });
});
