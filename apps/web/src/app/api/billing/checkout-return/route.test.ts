import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createClient } = vi.hoisted(() => ({
  createClient: vi.fn(),
}));

vi.mock("@/platform/auth/server", () => ({ createClient }));

import { GET } from "./route";

const checkoutReturn = new Request(
  "https://app.example.test/api/billing/checkout-return?session_id=cs_test_123",
);

describe("Stripe Checkout return", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.example.test");
    vi.stubGlobal("fetch", fetchMock);
    createClient.mockReset();
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("reconciles a completed payment before redirecting directly to Connect Channels", async () => {
    createClient.mockResolvedValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: "token" } } }),
      },
    });
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ subscriptionStatus: "active" }), { status: 200 }),
    );

    const response = await GET(checkoutReturn);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.test/billing/checkout-session/reconcile",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ sessionId: "cs_test_123" }),
      }),
    );
    expect(response.headers.get("location")).toBe(
      "https://app.example.test/onboarding/connect-channels",
    );
  });

  it("preserves the existing Checkout verification path when confirmation cannot grant access", async () => {
    createClient.mockResolvedValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: "token" } } }),
      },
    });
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ subscriptionStatus: "incomplete" }), { status: 200 }),
    );

    const response = await GET(checkoutReturn);

    expect(response.headers.get("location")).toBe(
      "https://app.example.test/onboarding/checkout?status=success&session_id=cs_test_123",
    );
  });
});
