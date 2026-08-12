import { UnipileAdapter } from "../adapters/unipile.js";
import { env } from "../config/env.js";
import { CAMPAIGN_PRICE_CONFIG } from "./billing/pricing.js";
import { getStripePrice } from "./stripe.js";

type FetchLike = typeof fetch;

export async function verifyR2PublicVideo(
  url: string,
  fetcher: FetchLike = fetch,
): Promise<void> {
  const response = await fetcher(url, {
    headers: { Range: "bytes=0-1" },
    signal: AbortSignal.timeout(15_000),
  });
  const contentType = response.headers.get("content-type") ?? "";
  const supportsRanges =
    response.status === 206 ||
    response.headers.get("accept-ranges")?.toLowerCase() === "bytes" ||
    Boolean(response.headers.get("content-range"));

  if (!response.ok || !contentType.toLowerCase().startsWith("video/mp4") || !supportsRanges) {
    throw new Error(
      `R2 preflight failed (status=${response.status}, contentType=${contentType || "missing"}, ranges=${supportsRanges})`,
    );
  }
}

export async function verifyApifyConnectivity(fetcher: FetchLike = fetch): Promise<void> {
  if (!env.APIFY_API_KEY) return;
  const response = await fetcher(
    `https://api.apify.com/v2/users/me?token=${encodeURIComponent(env.APIFY_API_KEY)}`,
    { signal: AbortSignal.timeout(15_000) },
  );
  if (!response.ok) {
    throw new Error(`Apify credentials check failed with ${response.status}`);
  }
}

export async function runProductionPreflight(): Promise<void> {
  if (env.STRIPE_MOCK_MODE || env.VIDEO_MOCK_MODE) {
    throw new Error("Production preflight requires live Stripe and video providers");
  }
  if (!env.R2_PREFLIGHT_VIDEO_URL) {
    throw new Error("R2_PREFLIGHT_VIDEO_URL is required for production preflight");
  }

  const priceIds = [
    ...Object.values(CAMPAIGN_PRICE_CONFIG).map((config) => String(env[config.envKey])),
    env.STRIPE_PRICE_VIDEO_ADDON,
  ];
  await Promise.all(priceIds.map((priceId) => getStripePrice(priceId)));
  await new UnipileAdapter({ dsn: env.UNIPILE_DSN, apiKey: env.UNIPILE_API_KEY }).listAccounts();
  await verifyR2PublicVideo(env.R2_PREFLIGHT_VIDEO_URL);
  await verifyApifyConnectivity();
}
