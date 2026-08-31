"use client";

import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CreditCard,
  Loader2,
  Lock,
  ShieldCheck,
} from "@/components/ui/icons";
import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { ActionBar } from "@/components/ui/ActionBar";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { EmbeddedCheckoutCard, PaymentTrustBar } from "@/components/onboarding/EmbeddedCheckoutCard";
import { applyStoredTheme } from "@/hooks/useThemeMode";
import { apiFetch, bootstrapCurrentOrganization } from "@/lib/api";
import { isOnboardingDemo } from "@/lib/onboarding/preview-api";
import { navigateOnboarding, onboardingHref } from "./steps";

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
  const [embeddedCheckout, setEmbeddedCheckout] = useState<{ clientSecret: string; mockMode: boolean } | null>(null);
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
          bootstrapCurrentOrganization(),
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
        const bootstrap = await bootstrapCurrentOrganization();
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

  const handleCheckout = useCallback(async () => {
    if (isRedirecting) return;

    setIsRedirecting(true);
    setError(null);
    try {
      const session = await apiFetch<{ url: string | null; clientSecret: string | null; mockMode: boolean }>("/billing/checkout-session", {
        method: "POST",
        body: JSON.stringify({ embedded: true }),
      });
      if (!session.clientSecret) throw new Error("Stripe did not return an embedded checkout session.");
      setEmbeddedCheckout({ clientSecret: session.clientSecret, mockMode: session.mockMode });
      setIsRedirecting(false);
    } catch (checkoutError) {
      setError(errorMessage(checkoutError, "Unable to open secure checkout."));
      setIsRedirecting(false);
    }
  }, [isRedirecting]);

  useEffect(() => {
    if (
      isLoading ||
      returnedFromCheckout ||
      checkoutSucceeded ||
      embeddedCheckout ||
      isRedirecting ||
      error ||
      lineItems.length === 0
    ) return;

    void handleCheckout();
  }, [
    checkoutSucceeded,
    embeddedCheckout,
    error,
    handleCheckout,
    isLoading,
    isRedirecting,
    lineItems.length,
    returnedFromCheckout,
  ]);

  return (
    <div className="onboarding-page relative flex min-h-dvh w-full flex-col">
      <main className="checkout-page mx-auto flex w-full max-w-[76rem] flex-1 flex-col justify-center px-5 pt-36 pb-44 h-compact:justify-start lg:px-8 lg:pt-28 lg:pb-28 h-short:lg:pt-24 h-short:lg:pb-24">
        {error ? (
          <Alert
            tone="error"
            className="mx-auto mt-6 w-full max-w-5xl"
            action={!returnedFromCheckout && !isRedirecting ? <Button type="button" variant="secondary" size="sm" onClick={() => setLoadAttempt((attempt) => attempt + 1)}>Try again</Button> : null}
          >
            {error}
          </Alert>
        ) : null}

        {returnedFromCheckout ? (
          <Alert tone="success" className="mx-auto mt-6 w-full max-w-5xl" title={checkoutSucceeded ? "Payment confirmed" : "Confirming payment"} aria-live="polite">
            {checkoutSucceeded
              ? "Your subscription is active. Continue to connect your channels."
              : "We're waiting for the secure payment confirmation. This usually takes a few seconds."}
          </Alert>
        ) : null}

        <div className="relative grid min-w-0 gap-10 lg:grid-cols-[minmax(0,1.55fr)_minmax(20rem,0.95fr)] lg:gap-0">
          <section className="min-w-0 lg:pr-10 xl:pr-14" aria-labelledby="payment-heading">
            <div className="mb-7 h-short:mb-5">
              <h1 id="payment-heading" className="text-3xl font-semibold tracking-[-0.035em] text-onboarding-ink dark:text-white sm:text-4xl">Complete your subscription</h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-onboarding-neutral-500 dark:text-onboarding-neutral-400">Pay securely to continue. Your campaign stays in draft until you review and approve it.</p>
            </div>

            <PaymentTrustBar />

            {isRedirecting && !embeddedCheckout ? (
              <EmptyState
                className="min-h-64 w-full rounded-2xl border border-onboarding-neutral-150 bg-white dark:border-onboarding-neutral-750 dark:bg-onboarding-neutral-900"
                icon={<Loader2 className="size-5 animate-spin" aria-hidden />}
                title="Loading secure checkout"
                description="Stripe is preparing your encrypted payment form."
                role="status"
                aria-live="polite"
              />
            ) : null}

            {embeddedCheckout ? (
              <EmbeddedCheckoutCard
                {...embeddedCheckout}
                onMockSubmit={isOnboardingDemo() ? () => {
                  navigateOnboarding(`${onboardingHref("checkout")}&status=success&session_id=demo`, true);
                } : undefined}
              />
            ) : null}

            <div className="mt-5 flex items-center justify-center gap-2 text-xs text-onboarding-neutral-500 dark:text-onboarding-neutral-400 h-short:mt-3">
              <ShieldCheck className="size-4 text-onboarding-success-500" aria-hidden />
              Payment details never touch LeadReacher servers
            </div>
          </section>

          <aside className="min-w-0 border-onboarding-neutral-150 lg:border-l lg:pl-10 xl:pl-14 dark:border-onboarding-neutral-750" aria-labelledby="summary-heading">
            <div className="lg:sticky lg:top-32">
              <h2 id="summary-heading" className="text-2xl font-semibold tracking-[-0.025em] text-onboarding-ink dark:text-white sm:text-3xl">Order summary</h2>

              <div className="checkout-accent-card mt-6 overflow-hidden rounded-2xl h-short:mt-5">
                <div className="border-b border-onboarding-neutral-150 p-5 dark:border-onboarding-neutral-750">
                  {isLoading ? (
                    <div className="flex items-center gap-3 text-sm text-onboarding-neutral-500"><Loader2 className="size-4 animate-spin" aria-hidden /> Loading plan</div>
                  ) : lineItems.map((item) => (
                    <div key={item.priceId} className="flex items-center justify-between gap-5">
                      <div className="flex min-w-0 items-center gap-3.5">
                        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-onboarding-purple-600 text-white shadow-onboarding-button">
                          <CreditCard className="size-5" aria-hidden />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-base font-semibold text-onboarding-ink dark:text-white">{item.label}</p>
                          <p className="mt-0.5 text-xs text-onboarding-neutral-500">{item.interval ? `Billed ${item.interval}ly` : "Subscription"}</p>
                        </div>
                      </div>
                      <p className="shrink-0 text-xl font-semibold tracking-[-0.02em] text-onboarding-ink dark:text-white">{formatPrice(item)}<span className="ml-1 text-xs font-normal text-onboarding-neutral-500">{item.interval ? `/${item.interval}` : ""}</span></p>
                    </div>
                  ))}
                </div>

                <div className="p-5">
                  <p className="text-xs font-semibold tracking-[0.12em] text-onboarding-neutral-500 uppercase">Campaign setup</p>
                  <dl className="mt-3 grid gap-1.5 text-sm">
                    <div className="checkout-summary-row">
                      <dt className="text-onboarding-neutral-600 dark:text-onboarding-neutral-400">Audience</dt>
                      <dd className="max-w-48 text-right font-medium leading-5 text-onboarding-ink dark:text-onboarding-neutral-0">
                        {isLoading ? "Loading..." : strategy ? idealCustomerLabel(strategy.icpDefinition) : "Unavailable"}
                      </dd>
                    </div>
                    <div className="checkout-summary-row">
                      <dt className="text-onboarding-neutral-600 dark:text-onboarding-neutral-400">Campaign</dt>
                      <dd className="text-right font-medium text-onboarding-ink dark:text-onboarding-neutral-0">
                        {isLoading ? "Loading..." : campaignTypeLabel(strategy?.campaignType ?? null)}
                      </dd>
                    </div>
                    <div className="checkout-summary-row">
                      <dt className="text-onboarding-neutral-600 dark:text-onboarding-neutral-400">Video</dt>
                      <dd className="text-right font-medium text-onboarding-ink dark:text-onboarding-neutral-0">
                        {isLoading ? "Loading..." : videoLabel(strategy?.videoConfig ?? null)}
                      </dd>
                    </div>
                  </dl>

                  <div className="my-5 border-t border-onboarding-neutral-150 dark:border-onboarding-neutral-750" />
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-base font-semibold text-onboarding-ink dark:text-white">Total due today</span>
                    <span className="text-xl font-semibold tracking-[-0.02em] text-onboarding-ink dark:text-white">{isLoading ? "…" : lineItems.map(formatPrice).join(" + ")}</span>
                  </div>
                </div>
              </div>

              <div className="mt-5 flex items-start gap-3 rounded-xl border border-onboarding-purple-100/80 bg-onboarding-purple-50/50 p-4 text-xs leading-5 text-onboarding-neutral-600 dark:border-onboarding-purple-800/40 dark:bg-onboarding-purple-950/20 dark:text-onboarding-neutral-400 h-short:mt-3">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-onboarding-success-500" aria-hidden />
                Your payment is handled by Stripe. Your campaign will not send anything until you approve it.
              </div>
            </div>
          </aside>
        </div>
      </main>

      <ActionBar
        leading={<Button type="button" variant="secondary" onClick={() => navigateOnboarding(onboardingHref("video-decision"))} className="h-13 px-7 text-base"><ArrowLeft className="size-5" aria-hidden />Back</Button>}
        trailing={checkoutSucceeded || returnedFromCheckout ? (
          <Button
            type="button"
            variant="primary"
            disabled={isLoading || isRedirecting || isVerifyingPayment || lineItems.length === 0}
            onClick={() => {
              if (checkoutSucceeded) {
                navigateOnboarding(onboardingHref("channels"));
                return;
              }
              if (returnedFromCheckout) {
                setVerificationAttempt((attempt) => attempt + 1);
                return;
              }
            }}
            className="h-13 px-8 text-base sm:px-10"
          >
            {checkoutSucceeded ? "Continue to channels" : isVerifyingPayment ? "Confirming payment..." : "Check payment status"}
            {checkoutSucceeded ? <ArrowRight className="size-5" aria-hidden /> : <Lock className="size-4" aria-hidden />}
          </Button>
        ) : null}
      />
    </div>
  );
}
