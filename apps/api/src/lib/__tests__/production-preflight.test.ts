import { describe, expect, it } from "vitest";
import {
  assertLiveProviderModes,
  assertProviderReadiness,
  runProviderReadinessChecks,
  verifyR2PublicVideo,
} from "../production-preflight.js";

describe("production preflight R2 check", () => {
  it("accepts an MP4 response with byte-range support", async () => {
    const fetcher = async (): Promise<Response> =>
      new Response("ok", {
        status: 206,
        headers: { "content-type": "video/mp4", "content-range": "bytes 0-1/2" },
      });

    await expect(verifyR2PublicVideo("https://cdn.example.test/video.mp4", fetcher)).resolves.toBeUndefined();
  });

  it("rejects a public object without MP4 range playback", async () => {
    const fetcher = async (): Promise<Response> =>
      new Response("missing", { status: 200, headers: { "content-type": "text/plain" } });

    await expect(verifyR2PublicVideo("https://cdn.example.test/video.mp4", fetcher)).rejects.toThrow(
      "R2 preflight failed",
    );
  });
});

describe("shared provider readiness checks", () => {
  const configuration = {
    APIFY_API_KEY: "",
    R2_PREFLIGHT_VIDEO_URL: "https://cdn.example.test/video.mp4",
    // Stripe test credentials still use the live Stripe API, so mock mode is
    // false even though this represents a non-production target.
    STRIPE_MOCK_MODE: false,
    STRIPE_PRICE_AI_VIDEO_AD: "price_video",
    STRIPE_PRICE_PERSONALIZED_OUTREACH: "price_outreach",
    STRIPE_PRICE_UPLOADED_VIDEO: "price_uploaded",
    STRIPE_PRICE_VIDEO_ADDON: "price_addon",
    UNIPILE_API_KEY: "unipile-key",
    VIDEO_MOCK_MODE: false,
  };

  it("permits staging Stripe test-mode and returns one report for every provider", async () => {
    const report = await runProviderReadinessChecks({
      target: "staging",
      configuration,
      getStripePrice: async () => ({ id: "price" }),
      listUnipileAccounts: async () => [],
      fetcher: async () =>
        new Response("ok", {
          status: 206,
          headers: { "content-type": "video/mp4", "content-range": "bytes 0-1/2" },
        }),
      now: () => new Date("2026-08-13T00:00:00.000Z"),
    });

    expect(report).toMatchObject({
      target: "staging",
      checkedAt: "2026-08-13T00:00:00.000Z",
      passed: true,
      checks: [
        { provider: "stripe", status: "passed" },
        { provider: "unipile", status: "passed" },
        { provider: "r2", status: "passed" },
        { provider: "apify", status: "skipped" },
      ],
    });
  });

  it("continues checking providers and reports a provider-specific failure", async () => {
    const report = await runProviderReadinessChecks({
      target: "staging",
      configuration,
      getStripePrice: async () => {
        throw new Error("Stripe test key rejected");
      },
      listUnipileAccounts: async () => [],
      fetcher: async () =>
        new Response("ok", {
          status: 206,
          headers: { "content-type": "video/mp4", "content-range": "bytes 0-1/2" },
        }),
    });

    expect(report.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ provider: "stripe", status: "failed", diagnostic: "Stripe test key rejected" }),
      expect.objectContaining({ provider: "unipile", status: "passed" }),
      expect.objectContaining({ provider: "r2", status: "passed" }),
    ]));
    expect(() => assertProviderReadiness(report)).toThrow("stripe: Stripe test key rejected");
  });

  it("keeps the live-provider policy outside the shared staging checks", () => {
    expect(() => assertLiveProviderModes({ ...configuration, STRIPE_MOCK_MODE: true })).toThrow(
      "Production preflight requires live Stripe and video providers",
    );
    expect(() => assertLiveProviderModes({ STRIPE_MOCK_MODE: false, VIDEO_MOCK_MODE: false })).not.toThrow();
  });

  it("does not apply the production mode assertion while running shared checks", async () => {
    const report = await runProviderReadinessChecks({
      target: "staging",
      configuration: { ...configuration, STRIPE_MOCK_MODE: true, VIDEO_MOCK_MODE: true },
      getStripePrice: async () => ({ id: "price" }),
      listUnipileAccounts: async () => [],
      fetcher: async () =>
        new Response("ok", {
          status: 206,
          headers: { "content-type": "video/mp4", "content-range": "bytes 0-1/2" },
        }),
    });

    expect(report.passed).toBe(true);
  });
});
