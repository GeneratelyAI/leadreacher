"use client";

import { useRouter, useSearchParams } from "next/navigation";
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
import { OnboardingChrome } from "@/components/onboarding/OnboardingChrome";
import { Button } from "@/components/ui/Button";
import { applyStoredTheme } from "@/hooks/useThemeMode";
import { apiFetch, bootstrapOrganization } from "@/lib/api";
import { onboardingHref } from "./steps";

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
      return "AI video ad";
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

export default function CheckoutClient() {
  useLayoutEffect(() => {
    applyStoredTheme();
  }, []);

  const router = useRouter();
  const searchParams = useSearchParams();
  const [lineItems, setLineItems] = useState<BillingLineItem[]>([]);
  const [strategy, setStrategy] = useState<StrategyResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const checkoutSucceeded = searchParams.get("status") === "success";

  useEffect(() => {
    let cancelled = false;

    async function loadPricing() {
      try {
        const [pricing, bootstrap] = await Promise.all([
          apiFetch<PricingResponse>("/billing/pricing"),
          bootstrapOrganization("LeadReacher"),
        ]);
        const loadedStrategy = await apiFetch<StrategyResponse>(
          `/strategy/${bootstrap.orgId}`,
        );
        if (!cancelled) setLineItems(pricing.lineItems);
        if (!cancelled) setStrategy(loadedStrategy);
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error ? loadError.message : "Unable to load your plan.",
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void loadPricing();
    return () => {
      cancelled = true;
    };
  }, []);

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
      setError(
        checkoutError instanceof Error
          ? checkoutError.message
          : "Unable to open secure checkout.",
      );
      setIsRedirecting(false);
    }
  }

  return (
    <div className="onboarding-page relative flex h-dvh min-h-dvh w-full flex-col overflow-y-auto">
      <OnboardingChrome activeStep="checkout" />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-5 pb-28 pt-28 lg:pt-34">
        <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
          <HeroBadge icon={<CreditCard className="size-7" />} tone="warning" />
          <h1 className="mt-5 text-3xl font-bold tracking-tight text-onboarding-ink sm:text-4xl dark:text-onboarding-neutral-0">
            Review your plan
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-onboarding-neutral-600 dark:text-onboarding-neutral-400">
            Your campaign setup is ready. Stripe handles payment on its secure hosted page.
          </p>
        </div>

        {error ? (
          <p className="mx-auto mt-6 w-full max-w-5xl rounded-onboarding bg-onboarding-error-50 px-4 py-3 text-sm text-onboarding-error-900 dark:bg-onboarding-error-900 dark:text-onboarding-error-50" role="alert">
            {error}
          </p>
        ) : null}

        {checkoutSucceeded ? (
          <OnboardingCard className="mx-auto mt-6 flex w-full max-w-5xl items-start gap-3 border-onboarding-success-500 px-5 py-4">
            <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-onboarding-pill bg-onboarding-success-50 text-onboarding-success-500">
              <Check className="size-5" aria-hidden />
            </span>
            <div>
              <p className="font-semibold text-onboarding-ink dark:text-onboarding-neutral-0">
                Checkout completed
              </p>
              <p className="mt-1 text-sm text-onboarding-neutral-600 dark:text-onboarding-neutral-400">
                Your subscription will be activated as soon as Stripe confirms the payment.
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
              <div className="flex items-center gap-3 py-10 text-sm text-onboarding-neutral-600 dark:text-onboarding-neutral-400">
                <Loader2 className="size-5 animate-spin text-onboarding-purple-500" aria-hidden />
                Loading Stripe pricing
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
                        {item.interval ? `Billed ${item.interval}ly` : "Pricing managed by Stripe"}
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
              Payment details are entered only on Stripe&apos;s secure checkout page.
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

      <div className="pointer-events-none fixed inset-x-0 bottom-7 z-30 flex items-center justify-between px-6 sm:px-10">
        <Button
          type="button"
          variant="secondary"
          onClick={() => router.push(onboardingHref("video-decision"))}
          className="pointer-events-auto h-13 px-7 text-base"
        >
          <ArrowLeft className="size-5" aria-hidden />
          Back
        </Button>
        <Button
          type="button"
          variant="brand"
          disabled={isLoading || isRedirecting || lineItems.length === 0}
          onClick={() => {
            if (checkoutSucceeded) {
              router.push(onboardingHref("channels"));
              return;
            }
            void handleCheckout();
          }}
          className="pointer-events-auto h-13 px-8 text-base sm:px-10"
        >
          {checkoutSucceeded ? "Continue to channels" : isRedirecting ? "Opening checkout..." : "Continue to secure checkout"}
          {checkoutSucceeded ? <ArrowRight className="size-5" aria-hidden /> : <Lock className="size-4" aria-hidden />}
        </Button>
      </div>
    </div>
  );
}
