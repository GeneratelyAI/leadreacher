"use client";

import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Check,
  Lock,
  ShieldCheck,
} from "@/components/ui/icons";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Loading } from "@/components/ui/Loading";
import { CheckoutCard } from "@/features/onboarding/components/Checkout";
import { ChannelLogo, type ChannelLogoName } from "@/platform/branding/ChannelLogo";
import { applyStoredTheme } from "@/hooks/useThemeMode";
import { apiFetch, bootstrapCurrentOrganization } from "@/lib/api";
import { isOnboardingDemo, isOnboardingPreview } from "@/features/onboarding/public/preview-api";
import { navigateOnboarding, onboardingHref } from "../../public/navigation";
import { CAMPAIGN_SAVED_EVENT } from "../../public/campaign-events";
import continuation from "../continuation/Continuation.module.css";
import styles from "./CheckoutMobile.module.css";
import { SecurePaymentCard } from "../SecurePaymentCard";
import { OrderSummaryCard } from "../OrderSummaryCard";

const PAYMENT_VERIFICATION_ATTEMPTS = 5;
const PAYMENT_VERIFICATION_DELAY_MS = 2_000;
function isUsableSubscription(status: string | null | undefined): boolean {
  return status === "active" || status === "trialing";
}

type BillingLineItem = {
  key: string;
  priceId: string;
  label: string;
  unitAmount: number | null;
  currency: string | null;
  interval: string | null;
  channel?: string;
  features?: string[];
};

type PricingResponse = {
  lineItems: BillingLineItem[];
  includedChannels?: string[];
  features?: string[];
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
  channels?: unknown;
};

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function formatPrice(item: BillingLineItem): string {
  if (item.unitAmount === null || !item.currency) {
    return "Unavailable";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: item.currency.toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(item.unitAmount / 100);
}

function formatTotal(items: BillingLineItem[]): string {
  if (items.length === 0) return "Unavailable";
  const currency = items[0]?.currency;
  if (!currency || items.some((item) => item.unitAmount === null || item.currency !== currency)) {
    return "Calculated at checkout";
  }

  const total = items.reduce((sum, item) => sum + (item.unitAmount ?? 0), 0);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(total / 100);
}

function selectedChannelsFromStrategy(strategy: StrategyResponse | null): string[] {
  if (!strategy?.channels || typeof strategy.channels !== "object" || Array.isArray(strategy.channels)) return [];
  const selected = (strategy.channels as Record<string, unknown>).selected;
  return Array.isArray(selected)
    ? [...new Set(selected.filter((channel): channel is string => typeof channel === "string"))]
    : [];
}

function channelLabel(channel: string): string {
  if (channel === "email") return "Gmail";
  if (channel === "gmail") return "Gmail";
  if (channel === "outlook") return "Outlook";
  if (channel === "linkedin") return "LinkedIn";
  if (channel === "whatsapp") return "WhatsApp";
  return `${channel.charAt(0).toUpperCase()}${channel.slice(1)}`;
}

function channelLogoName(channel: string): ChannelLogoName | null {
  if (channel === "email" || channel === "gmail") return "gmail";
  if (channel === "outlook") return "outlook";
  if (channel === "whatsapp") return "whatsapp-mark";
  if (channel === "linkedin" || channel === "instagram" || channel === "facebook") return channel;
  return null;
}

export default function Checkout() {
  useLayoutEffect(() => {
    applyStoredTheme();
  }, []);

  const searchParams = useSearchParams();
  const [lineItems, setLineItems] = useState<BillingLineItem[]>([]);
  const [includedChannels, setIncludedChannels] = useState<string[]>([]);
  const [features, setFeatures] = useState<string[]>([]);
  const [strategy, setStrategy] = useState<StrategyResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [isVerifyingPayment, setIsVerifyingPayment] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);
  const [verificationAttempt, setVerificationAttempt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [embeddedCheckout, setEmbeddedCheckout] = useState<{ clientSecret: string; mockMode: boolean } | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const sessionGeneration = useRef(0);
  const returnedFromCheckout = searchParams.get("status") === "success";
  const checkoutSessionId = searchParams.get("session_id");
  const checkoutSucceeded = isUsableSubscription(subscriptionStatus);
  const selectedChannels = selectedChannelsFromStrategy(strategy);
  const primaryLineItems = lineItems.filter((item) => item.key !== "additional_channel");
  const additionalChannelItems = lineItems.filter((item) => item.key === "additional_channel");

  useEffect(() => {
    const invalidate = () => {
      sessionGeneration.current += 1;
      setEmbeddedCheckout(null);
      setIsRedirecting(false);
      setIsLoading(true);
      setLoadAttempt((attempt) => attempt + 1);
    };
    window.addEventListener(CAMPAIGN_SAVED_EVENT, invalidate);
    return () => {
      sessionGeneration.current += 1;
      window.removeEventListener(CAMPAIGN_SAVED_EVENT, invalidate);
    };
  }, []);

  useEffect(() => {
    if (checkoutSucceeded) {
      navigateOnboarding(onboardingHref("connect-channels"), true);
    }
  }, [checkoutSucceeded]);

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
        if (!cancelled) setIncludedChannels(pricing.includedChannels ?? []);
        if (!cancelled) {
          const planFeatures = pricing.features ?? pricing.lineItems.flatMap((item) => item.features ?? []);
          setFeatures(Array.isArray(planFeatures) ? planFeatures.filter((value): value is string => typeof value === "string" && Boolean(value.trim())) : []);
        }
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
        if (!isOnboardingPreview() && !checkoutSessionId.startsWith("cs_")) {
          throw new Error("The payment return did not contain a valid Stripe Checkout Session.");
        }
        const reconciliation = await apiFetch<{ subscriptionStatus: string | null }>(
          "/billing/checkout-session/reconcile",
          {
            method: "POST",
            body: JSON.stringify({ sessionId: checkoutSessionId }),
          },
        );
        if (cancelled) return;
        setSubscriptionStatus(reconciliation.subscriptionStatus);
        if (isUsableSubscription(reconciliation.subscriptionStatus)) {
          setIsVerifyingPayment(false);
          return;
        }
      }

      for (let attempt = 0; attempt < PAYMENT_VERIFICATION_ATTEMPTS; attempt += 1) {
        const bootstrap = await bootstrapCurrentOrganization();
        if (cancelled) return;
        setSubscriptionStatus(bootstrap.subscriptionStatus);
        if (isUsableSubscription(bootstrap.subscriptionStatus)) {
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
    const generation = sessionGeneration.current;

    setIsRedirecting(true);
    setError(null);
    try {
      const session = await apiFetch<{ url: string | null; clientSecret: string | null; mockMode: boolean; lineItems?: BillingLineItem[]; includedChannels?: string[]; configuration?: StrategyResponse }>("/billing/checkout-session", {
        method: "POST",
        body: JSON.stringify({ embedded: true }),
      });
      if (generation !== sessionGeneration.current) return;
      if (session.mockMode && !isOnboardingPreview()) {
        throw new Error("Secure checkout is unavailable. Please contact support to enable Stripe billing.");
      }
      if (!session.clientSecret) throw new Error("Stripe did not return an embedded checkout session.");
      if (!isOnboardingPreview() && (!session.lineItems?.length || !session.configuration || !session.includedChannels)) {
        throw new Error("The checkout pricing snapshot is unavailable. Please try again.");
      }
      if (session.lineItems) setLineItems(session.lineItems);
      if (session.includedChannels) setIncludedChannels(session.includedChannels);
      if (session.configuration) setStrategy(session.configuration);
      setEmbeddedCheckout({ clientSecret: session.clientSecret, mockMode: session.mockMode });
      setIsRedirecting(false);
    } catch (checkoutError) {
      if (generation !== sessionGeneration.current) return;
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
    <div className={`onboarding-page ${continuation.page} ${continuation.responsiveTaskPage} ${styles.screen}`}>
      <main className={`checkout-page continuation-main ${continuation.main} ${styles.main}`}>
        {error ? (
          <Alert
            tone="error"
            className="mx-auto mt-6 w-full max-w-5xl"
            action={!returnedFromCheckout && !isRedirecting ? <Button type="button" variant="secondary" size="sm" onClick={() => setLoadAttempt((attempt) => attempt + 1)}>Try again</Button> : null}
          >
            {error}
          </Alert>
        ) : null}

        <header className={`${continuation.heading} ${styles.desktop}`}>
          <h1 id="payment-heading">Complete your subscription<span className="signup-campaign-period">.</span></h1>
          <p>Pay securely to continue. Your campaign stays in draft until you approve it.</p>
        </header>

        <div className="onboarding-scene-task-scroll" role="region" aria-label="Checkout content" tabIndex={0}>
        <div className={`relative grid w-full min-w-0 gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-0 ${continuation.task} ${styles.grid}`}>
          <div className={styles.mobile}>
            <header className={styles.heading}>
              <h1>Your campaign starts here<span className="signup-campaign-period">.</span></h1>
              <p>Review your plan before continuing.</p>
            </header>
            {isLoading ? <p role="status">Loading your plan...</p> : lineItems.length > 0 ? (
              <section className={styles.plan} aria-label="Your subscription plan">
                <div className={styles.planBody}>
                  <div className={styles.planHeading}>
                    <h2>{primaryLineItems[0]?.label ?? lineItems[0].label}</h2>
                    {isOnboardingPreview() || isOnboardingDemo() ? <span className={styles.sample}>Illustrative pricing</span> : null}
                  </div>
                  <p className={styles.price}>{formatPrice(primaryLineItems[0] ?? lineItems[0])}<span>{(primaryLineItems[0] ?? lineItems[0]).interval ? `/ ${(primaryLineItems[0] ?? lineItems[0]).interval}` : ""}</span></p>
                  {features.length || lineItems.length > 1 ? <ul className={styles.features}>
                    {(features.length ? features : lineItems.filter((item) => item !== (primaryLineItems[0] ?? lineItems[0])).map((item) => item.label)).map((feature) => <li key={feature}><Check aria-hidden />{feature}</li>)}
                  </ul> : null}
                </div>
                <dl className={styles.totals}>
                  {lineItems.map((item, index) => <div key={`${item.key}-${item.channel ?? item.label}-${item.priceId}-${index}`}><dt>{item.key === "platform" && item.interval === "month" ? "Monthly plan" : item.label}</dt><dd>{formatPrice(item)}</dd></div>)}
                  <div className={styles.total}><dt>Subtotal today</dt><dd>{formatTotal(lineItems)}</dd></div>
                </dl>
                <p className={styles.tax}>Taxes calculated by Stripe at checkout.</p>
              </section>
            ) : null}
          </div>
          <SecurePaymentCard>

            {isRedirecting && !embeddedCheckout ? (
              <EmptyState
                className="min-h-64 w-full rounded-2xl border border-onboarding-neutral-150 bg-white dark:border-onboarding-neutral-750 dark:bg-onboarding-neutral-900"
                icon={<Loading tone="brand" label="Loading secure checkout" className="-my-5" />}
                title="Loading secure checkout"
                description="Stripe is preparing your encrypted payment form."
                role="status"
                aria-live="polite"
              />
            ) : null}

            {embeddedCheckout ? (
              <CheckoutCard
                {...embeddedCheckout}
                onRetry={() => {
                  sessionGeneration.current += 1;
                  setEmbeddedCheckout(null);
                  setIsLoading(true);
                  setLoadAttempt((attempt) => attempt + 1);
                }}
                planName={primaryLineItems.find((item) => item.key !== "video_addon")?.label}
                previewAmount={lineItems.reduce((total, item) => total + (item.unitAmount ?? 0), 0)}
                previewCurrency={lineItems.find((item) => item.currency)?.currency ?? "usd"}
                showStripePreview={isOnboardingPreview()}
                onMockSubmit={isOnboardingPreview() ? () => {
                  navigateOnboarding(`${onboardingHref("checkout")}?status=success&session_id=${isOnboardingDemo() ? "demo" : "preview"}`, true);
                } : undefined}
              />
            ) : null}

            {!embeddedCheckout?.mockMode ? <div className={`mt-5 flex items-center justify-center gap-2 text-xs text-onboarding-neutral-500 dark:text-onboarding-neutral-400 h-short:mt-3 ${styles.secureNote}`}>
              <ShieldCheck className="size-4 text-onboarding-success-500" aria-hidden />
              Payment details never touch LeadReacher servers
            </div> : null}
          </SecurePaymentCard>
          <OrderSummaryCard
            loading={isLoading}
            products={primaryLineItems.map((item, index) => ({ key: `${item.key}-${item.priceId}-${index}`, label: item.label, value: formatPrice(item) + (item.interval ? ` / ${item.interval}` : "") }))}
            channels={selectedChannels.map((channel) => {
              const charge = additionalChannelItems.find((item) => item.channel === channel);
              const logoName = channelLogoName(channel);
              return { key: channel, label: <>{logoName ? <ChannelLogo name={logoName} className={styles.channelMark} /> : null}{channelLabel(channel)}</>, value: charge ? formatPrice(charge) : includedChannels.includes(channel) ? "Included" : "Unavailable" };
            })}
            subtotal={isLoading ? "Loading..." : formatTotal(lineItems)}
          />
        </div>
        </div>
      </main>

      <footer className={`onboarding-campaign-action-row ${styles.actions}`}>
        <div>
          <Button type="button" variant="secondary" onClick={() => navigateOnboarding(onboardingHref("channels"))} className="campaign-content-back"><ArrowLeft className="size-5" aria-hidden />Back</Button>
        </div>
        {returnedFromCheckout && !checkoutSucceeded ? <div>
          <Button
            type="button"
            variant="primary"
            disabled={isLoading || isRedirecting || isVerifyingPayment || lineItems.length === 0}
            onClick={() => {
              if (returnedFromCheckout) {
                setVerificationAttempt((attempt) => attempt + 1);
              }
            }}
            className="onboarding-campaign-next"
          >
            {isVerifyingPayment ? "Confirming payment..." : "Check payment status"}
            <Lock className="size-4" aria-hidden />
          </Button>
        </div> : null}
      </footer>
    </div>
  );
}
