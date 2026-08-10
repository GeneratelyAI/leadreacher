"use client";

import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CreditCard,
  Loader2,
  Lock,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useEffect, useLayoutEffect, useState } from "react";
import { HeroBadge } from "@/components/onboarding/HeroBadge";
import { OnboardingCard } from "@/components/onboarding/OnboardingCard";
import { Chrome } from "@/components/onboarding/Chrome";
import { Button } from "@/components/ui/Button";
import { applyStoredTheme } from "@/hooks/useThemeMode";
import { apiFetch, bootstrapOrganization } from "@/lib/api";
import { navigateOnboarding, onboardingHref } from "./steps";

const ORGANIZATION_NAME = "LeadReacher";
const PAYMENT_VERIFICATION_ATTEMPTS = 5;
const PAYMENT_VERIFICATION_DELAY_MS = 2_000;
const ACTIVE_SUBSCRIPTION_STATUS = "active";

type BillingLineItem = {
  key: string;
  priceId: string;
  label: string;
  unitAmount: number | null;
  currency: string | null;
  interval: string | null;
};

type PricingResponse = {
  lineItems: BillingLineItem[];
};

type StrategyResponse = {
  campaignType: string | null;
  videoConfig: {
    source?: "generated" | "uploaded" | null;
    tone?: "professional" | "casual" | "aggressive" | null;
  } | null;
  icpDefinition: {
    idealCustomer?: unknown;
  };
};

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function formatPrice(item: BillingLineItem): string {
  if (item.unitAmount === null || !item.currency) {
    return "Usage-based";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: item.currency.toUpperCase(),
    maximumFractionDigits: 0,
  }).format(item.unitAmount / 100);
}

function campaignTypeLabel(value: string | null): string {
  switch (value) {
    case "personalized_outreach":
      return "Personalized outreach";
    case "ai_video_ad":
      return "AI campaign video";
    case "uploaded_video":
      return "Uploaded video";
    default:
      return "Not selected";
  }
}

function videoLabel(config: StrategyResponse["videoConfig"]): string {
  if (!config) return "Not selected";
  if (config.tone) {
    return `${config.tone.charAt(0).toUpperCase()}${config.tone.slice(1)} tone`;
  }
  if (config.source === "uploaded") return "Uploaded video";
  if (config.source === "generated") return "AI generated";
  return "Not selected";
}

function idealCustomerLabel(icpDefinition: StrategyResponse["icpDefinition"]): string {
  return typeof icpDefinition.idealCustomer === "string" && icpDefinition.idealCustomer.trim()
    ? icpDefinition.idealCustomer
    : "Not available";
}

export default function Checkout() {
  useLayoutEffect(() => {
    applyStoredTheme();
  }, []);

  const searchParams = useSearchParams();
  const [lineItems, setLineItems] = useState<BillingLineItem[]>([]);
  const [strategy, setStrategy] = useState<StrategyResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [isVerifyingPayment, setIsVerifyingPayment] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);
  const [verificationAttempt, setVerificationAttempt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const returnedFromCheckout = searchParams.get("status") === "success";
  const checkoutSessionId = searchParams.get("session_id");
  const checkoutSucceeded = subscriptionStatus === ACTIVE_SUBSCRIPTION_STATUS;

  useEffect(() => {
    let cancelled = false;

    async function loadPricing() {
      setIsLoading(true);
      setError(null);
      try {
        const [pricing, bootstrap] = await Promise.all([
          apiFetch<PricingResponse>("/billing/pricing"),
          bootstrapOrganization(ORGANIZATION_NAME),
        ]);
        const loadedStrategy = await apiFetch<StrategyResponse>(
          `/strategy/${bootstrap.orgId}`,
        );
        if (!cancelled) setLineItems(pricing.lineItems);
        if (!cancelled) setStrategy(loadedStrategy);
        if (!cancelled) setSubscriptionStatus(bootstrap.subscriptionStatus);
      } catch (loadError) {
        if (!cancelled) {
          setError(errorMessage(loadError, "Unable to load your plan."));
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void loadPricing();
    return () => {
      cancelled = true;
    };
  }, [loadAttempt]);

  useEffect(() => {
    if (!returnedFromCheckout || checkoutSucceeded) return;

    let cancelled = false;
    setIsVerifyingPayment(true);
    setError(null);

    async function verifyPayment() {
      if (checkoutSessionId) {
        const reconciliation = await apiFetch<{ subscriptionStatus: string | null }>(
          "/billing/checkout-session/reconcile",
          {
            method: "POST",
            body: JSON.stringify({ sessionId: checkoutSessionId }),
          },
        );
        if (cancelled) return;
        setSubscriptionStatus(reconciliation.subscriptionStatus);
        if (reconciliation.subscriptionStatus === ACTIVE_SUBSCRIPTION_STATUS) {
          setIsVerifyingPayment(false);
          return;
        }
      }

      for (let attempt = 0; attempt < PAYMENT_VERIFICATION_ATTEMPTS; attempt += 1) {
        const bootstrap = await bootstrapOrganization(ORGANIZATION_NAME);
        if (cancelled) return;
        setSubscriptionStatus(bootstrap.subscriptionStatus);
        if (bootstrap.subscriptionStatus === ACTIVE_SUBSCRIPTION_STATUS) {
          setIsVerifyingPayment(false);
          return;
        }
        await new Promise((resolve) =>
          window.setTimeout(resolve, PAYMENT_VERIFICATION_DELAY_MS),
        );
      }

      if (!cancelled) {
        setIsVerifyingPayment(false);
        setError(
          "Checkout is complete, but the subscription is not active yet. Check payment status again in a moment.",
        );
      }
    }

    void verifyPayment().catch((verificationError: unknown) => {
      if (cancelled) return;
      setIsVerifyingPayment(false);
      setError(errorMessage(verificationError, "Unable to verify your subscription."));
    });

    return () => {
      cancelled = true;
    };
  }, [checkoutSessionId, checkoutSucceeded, returnedFromCheckout, verificationAttempt]);

  async function handleCheckout() {
    if (isRedirecting) return;

    setIsRedirecting(true);
    setError(null);
    try {
      const session = await apiFetch<{ url: string }>("/billing/checkout-session", {
        method: "POST",
      });
      window.location.assign(session.url);
    } catch (checkoutError) {
      setError(errorMessage(checkoutError, "Unable to open secure checkout."));
      setIsRedirecting(false);
    }
  }

  return (
    <div className="onboarding-page relative flex min-h-dvh w-full flex-col">
      <Chrome activeStep="checkout" />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-5 pb-44 pt-28 lg:pb-28 lg:pt-34">
        <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
          <HeroBadge icon={<CreditCard className="size-7" />} tone="warning" />
          <h1 className="mt-5 text-3xl font-bold tracking-tight text-onboarding-ink sm:text-4xl dark:text-onboarding-neutral-0">
            Review your plan
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-onboarding-neutral-600 dark:text-onboarding-neutral-400">
            Your campaign setup is ready. Payment is handled on a secure hosted page.
          </p>
        </div>

        {error ? (
          <div className="mx-auto mt-6 flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 rounded-onboarding bg-onboarding-error-50 px-4 py-3 text-sm text-onboarding-error-900 dark:bg-onboarding-error-900 dark:text-onboarding-error-50" role="alert">
            <p>{error}</p>
            {!returnedFromCheckout && !isRedirecting ? <Button type="button" variant="secondary" size="sm" onClick={() => setLoadAttempt((attempt) => attempt + 1)}>Try again</Button> : null}
          </div>
        ) : null}

        {returnedFromCheckout ? (
          <OnboardingCard className="mx-auto mt-6 flex w-full max-w-5xl items-start gap-3 border-onboarding-success-500 px-5 py-4" role="status" aria-live="polite">
            <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-onboarding-pill bg-onboarding-success-50 text-onboarding-success-500">
              {checkoutSucceeded ? (
                <Check className="size-5" aria-hidden />
              ) : (
                <Loader2 className="size-5 animate-spin" aria-hidden />
              )}
            </span>
            <div>
              <p className="font-semibold text-onboarding-ink dark:text-onboarding-neutral-0">
                {checkoutSucceeded ? "Payment confirmed" : "Confirming payment"}
              </p>
              <p className="mt-1 text-sm text-onboarding-neutral-600 dark:text-onboarding-neutral-400">
                {checkoutSucceeded
                  ? "Your subscription is active. Continue to connect your channels."
                  : "We're waiting for the secure payment confirmation. This usually takes a few seconds."}
              </p>
            </div>
          </OnboardingCard>
        ) : null}

        <div className="mx-auto mt-8 grid w-full max-w-5xl gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(16rem,2fr)]">
          <OnboardingCard className="px-5 py-5 sm:px-6">
            <div className="flex items-center gap-3">
              <Sparkles className="size-5 shrink-0 text-onboarding-purple-600 dark:text-onboarding-purple-200" aria-hidden />
              <div>
                <h2 className="text-base font-semibold text-onboarding-ink dark:text-onboarding-neutral-0">
                  Your subscription
                </h2>
                <p className="mt-1 text-sm text-onboarding-neutral-600 dark:text-onboarding-neutral-400">
                  Plans adjust to the choices you made in onboarding.
                </p>
              </div>
            </div>

            {isLoading ? (
              <div className="flex items-center gap-3 py-10 text-sm text-onboarding-neutral-600 dark:text-onboarding-neutral-400" role="status" aria-live="polite">
                <Loader2 className="size-5 animate-spin text-onboarding-purple-500" aria-hidden />
                Loading pricing
              </div>
            ) : (
              <div className="mt-6 divide-y divide-onboarding-neutral-150 dark:divide-onboarding-neutral-750">
                {lineItems.map((item) => (
                  <div key={item.priceId} className="flex items-center justify-between gap-4 py-4 first:pt-0">
                    <div>
                      <p className="text-sm font-medium text-onboarding-ink dark:text-onboarding-neutral-0">
                        {item.label}
                      </p>
                      <p className="mt-1 text-xs text-onboarding-neutral-500 dark:text-onboarding-neutral-400">
                        {item.interval ? `Billed ${item.interval}ly` : "Pricing managed externally"}
                      </p>
                    </div>
                    <span className="status-badge bg-onboarding-purple-50 text-onboarding-purple-600 dark:bg-onboarding-purple-900 dark:text-onboarding-purple-200">
                      {formatPrice(item)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-5 flex items-center gap-3 border-t border-onboarding-neutral-150 pt-5 text-sm text-onboarding-neutral-600 dark:border-onboarding-neutral-750 dark:text-onboarding-neutral-400">
              <ShieldCheck className="size-5 shrink-0 text-onboarding-success-500" aria-hidden />
              Payment details are entered only on a secure checkout page.
            </div>
          </OnboardingCard>

          <OnboardingCard muted className="px-5 py-5 sm:px-6">
            <h2 className="text-base font-semibold text-onboarding-ink dark:text-onboarding-neutral-0">
              Campaign summary
            </h2>
            <dl className="mt-5 space-y-4 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-onboarding-neutral-600 dark:text-onboarding-neutral-400">Audience</dt>
                <dd className="max-w-48 text-right font-medium text-onboarding-ink dark:text-onboarding-neutral-0">
                  {isLoading ? "Loading..." : strategy ? idealCustomerLabel(strategy.icpDefinition) : "Unavailable"}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-onboarding-neutral-600 dark:text-onboarding-neutral-400">Campaign</dt>
                <dd className="font-medium text-onboarding-ink dark:text-onboarding-neutral-0">
                  {isLoading ? "Loading..." : campaignTypeLabel(strategy?.campaignType ?? null)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-onboarding-neutral-600 dark:text-onboarding-neutral-400">Video</dt>
                <dd className="font-medium text-onboarding-ink dark:text-onboarding-neutral-0">
                  {isLoading ? "Loading..." : videoLabel(strategy?.videoConfig ?? null)}
                </dd>
              </div>
            </dl>
          </OnboardingCard>
        </div>
      </main>

      <div className="onboarding-actions pointer-events-none fixed inset-x-0 z-30 flex items-center justify-between">
        <Button
          type="button"
          variant="secondary"
          onClick={() => navigateOnboarding(onboardingHref("video-decision"))}
          className="pointer-events-auto h-13 px-7 text-base"
        >
          <ArrowLeft className="size-5" aria-hidden />
          Back
        </Button>
        <Button
          type="button"
          variant="brand"
          disabled={
            isLoading ||
            isRedirecting ||
            isVerifyingPayment ||
            lineItems.length === 0
          }
          onClick={() => {
            if (checkoutSucceeded) {
              navigateOnboarding(onboardingHref("channels"));
              return;
            }
            if (returnedFromCheckout) {
              setVerificationAttempt((attempt) => attempt + 1);
              return;
            }
            void handleCheckout();
          }}
          className="pointer-events-auto h-13 px-8 text-base sm:px-10"
        >
          {checkoutSucceeded
            ? "Continue to channels"
            : isVerifyingPayment
                ? "Confirming payment..."
                : isRedirecting
                  ? "Opening checkout..."
                  : returnedFromCheckout
                    ? "Check payment status"
                    : "Continue to secure checkout"}
          {checkoutSucceeded ? <ArrowRight className="size-5" aria-hidden /> : <Lock className="size-4" aria-hidden />}
        </Button>
      </div>
    </div>
  );
}
