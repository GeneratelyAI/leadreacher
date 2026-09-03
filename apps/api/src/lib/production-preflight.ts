import { UnipileAdapter } from "../adapters/unipile.js";
import { env, type Env } from "../config/env.js";
import { CAMPAIGN_PRICE_CONFIG } from "./billing/pricing.js";
import { getStripePrice } from "./stripe.js";

type FetchLike = typeof fetch;

export type ProviderReadinessTarget = "staging" | "production";
export type ProviderName = "stripe" | "unipile" | "r2" | "apify" | "bootstrap";
export type ProviderCheckStatus = "passed" | "failed" | "skipped";

export type ProviderReadinessCheck = {
  provider: ProviderName;
  status: ProviderCheckStatus;
  durationMs: number;
  diagnostic?: string;
};

export type ProviderReadinessReport = {
  target: ProviderReadinessTarget;
  checkedAt: string;
  checks: ProviderReadinessCheck[];
  passed: boolean;
};

type StripePriceEnvKey =
  | "STRIPE_PRICE_AI_VIDEO_AD"
  | "STRIPE_PRICE_PERSONALIZED_OUTREACH"
  | "STRIPE_PRICE_UPLOADED_VIDEO"
  | "STRIPE_PRICE_VIDEO_ADDON";

type ProviderReadinessConfiguration = Pick<
  Env,
  | "APIFY_API_KEY"
  | "R2_PREFLIGHT_VIDEO_URL"
  | StripePriceEnvKey
  | "STRIPE_MOCK_MODE"
  | "UNIPILE_API_KEY"
  | "VIDEO_MOCK_MODE"
>;

export type ProviderReadinessOptions = {
  target: ProviderReadinessTarget;
  configuration?: ProviderReadinessConfiguration;
  fetcher?: FetchLike;
  getStripePrice?: (priceId: string) => Promise<unknown>;
  listUnipileAccounts?: () => Promise<unknown>;
  now?: () => Date;
};

function diagnosticFor(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function runProviderCheck(
  provider: ProviderName,
  check: () => Promise<void>,
): Promise<ProviderReadinessCheck> {
  const startedAt = Date.now();
  try {
    await check();
    return { provider, status: "passed", durationMs: Date.now() - startedAt };
  } catch (error) {
    return {
      provider,
      status: "failed",
      durationMs: Date.now() - startedAt,
      diagnostic: diagnosticFor(error),
    };
  }
}

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

async function verifyApifyConnectivity(
  apiKey = env.APIFY_API_KEY,
  fetcher: FetchLike = fetch,
): Promise<void> {
  if (!apiKey) return;
  const response = await fetcher(
    `https://api.apify.com/v2/users/me?token=${encodeURIComponent(apiKey)}`,
    { signal: AbortSignal.timeout(15_000) },
  );
  if (!response.ok) {
    throw new Error(`Apify credentials check failed with ${response.status}`);
  }
}

/**
 * Executes read-only provider probes for an explicitly selected target. This
 * shared function intentionally does not reject mock-mode flags: staging may
 * use Stripe test-mode credentials. The protected production command owns the
 * live-provider assertion before it calls this function.
 */
export async function runProviderReadinessChecks(
  options: ProviderReadinessOptions,
): Promise<ProviderReadinessReport> {
  const configuration = options.configuration ?? env;
  const fetcher = options.fetcher ?? fetch;
  const getConfiguredStripePrice = options.getStripePrice ?? getStripePrice;
  const listUnipileAccounts =
    options.listUnipileAccounts ??
    (() =>
      new UnipileAdapter({
        apiKey: configuration.UNIPILE_API_KEY,
      }).listAccounts());
  const priceIds = [
    ...Object.values(CAMPAIGN_PRICE_CONFIG).map(
      ({ envKey }) => configuration[envKey as StripePriceEnvKey],
    ),
    configuration.STRIPE_PRICE_VIDEO_ADDON,
  ];

  const checks = await Promise.all([
    runProviderCheck("stripe", async () => {
      await Promise.all(priceIds.map((priceId) => getConfiguredStripePrice(priceId)));
    }),
    runProviderCheck("unipile", async () => {
      await listUnipileAccounts();
    }),
    runProviderCheck("r2", async () => {
      if (!configuration.R2_PREFLIGHT_VIDEO_URL) {
        throw new Error(`R2_PREFLIGHT_VIDEO_URL is required for ${options.target} provider checks`);
      }
      await verifyR2PublicVideo(configuration.R2_PREFLIGHT_VIDEO_URL, fetcher);
    }),
    configuration.APIFY_API_KEY
      ? runProviderCheck("apify", async () => {
          await verifyApifyConnectivity(configuration.APIFY_API_KEY, fetcher);
        })
      : Promise.resolve<ProviderReadinessCheck>({
          provider: "apify",
          status: "skipped",
          durationMs: 0,
          diagnostic: "APIFY_API_KEY is not configured",
        }),
  ]);

  return {
    target: options.target,
    checkedAt: (options.now ?? (() => new Date()))().toISOString(),
    checks,
    passed: checks.every((check) => check.status !== "failed"),
  };
}

export function assertProviderReadiness(report: ProviderReadinessReport): void {
  const failures = report.checks.filter((check) => check.status === "failed");
  if (failures.length === 0) return;

  throw new Error(
    `${report.target} provider readiness failed: ${failures
      .map((check) => `${check.provider}: ${check.diagnostic ?? "unknown failure"}`)
      .join("; ")}`,
  );
}

/** The live-mode requirement belongs to the production command, not shared probes. */
export function assertLiveProviderModes(
  configuration: Pick<Env, "STRIPE_MOCK_MODE" | "VIDEO_MOCK_MODE"> = env,
): void {
  if (configuration.STRIPE_MOCK_MODE || configuration.VIDEO_MOCK_MODE) {
    throw new Error("Production preflight requires live Stripe and video providers");
  }
}

/**
 * Backwards-compatible production probe helper. Callers that represent the
 * protected release command must call assertLiveProviderModes() first.
 */
export function runProductionPreflight(): Promise<ProviderReadinessReport> {
  return runProviderReadinessChecks({ target: "production" });
}
