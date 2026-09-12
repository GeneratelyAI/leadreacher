"use client";

import { useRef, useState } from "react";
import {
  CheckoutElementsProvider,
  ContactDetailsElement,
  PaymentElement as CheckoutPaymentElement,
  useCheckoutElements,
} from "@stripe/react-stripe-js/checkout";
import {
  Elements,
  LinkAuthenticationElement,
  PaymentElement,
} from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { Loader2, Lock } from "@/components/ui/icons";
import { useThemeMode } from "@/hooks/useThemeMode";
import styles from "./steps/CheckoutMobile.module.css";

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim();
const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

export function CheckoutForm({ planName, onRetry }: { planName?: string; onRetry?: () => void }) {
  const result = useCheckoutElements();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const submissionPending = useRef(false);

  if (result.type === "loading") {
    return <div className="grid min-h-72 place-items-center" role="status"><Loader2 className="size-5 animate-spin text-onboarding-purple-600" aria-label="Loading secure payment form" /></div>;
  }

  if (result.type === "error") {
    return <div className="rounded-xl border border-onboarding-warning-150 bg-onboarding-warning-50 p-4 text-sm text-onboarding-warning-900" role="alert">
      <p>{result.error.message}</p>
      {onRetry ? <button type="button" onClick={onRetry} className="mt-2 min-h-11 rounded-lg border px-3 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2">Retry secure checkout</button> : null}
    </div>;
  }

  const { checkout } = result;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!checkout.canConfirm || submissionPending.current) return;

    submissionPending.current = true;
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const confirmation = await checkout.confirm();
      if (confirmation.type === "error") {
        setErrorMessage(confirmation.error.message ?? "Payment could not be completed.");
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Payment could not be completed.");
    } finally {
      submissionPending.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={styles.paymentForm}>
      <p className="text-sm font-semibold text-[#080e28]">Card information</p>
      <ContactDetailsElement />
      <CheckoutPaymentElement options={{
        layout: "tabs",
        paymentMethodOrder: ["card"],
        terms: { card: "never" },
        wallets: { applePay: "never", googlePay: "never", link: "never" },
      }} />

      {errorMessage ? <p className="text-sm text-onboarding-danger-600" role="alert">{errorMessage}</p> : null}

      <button
        type="submit"
        disabled={!checkout.canConfirm || isSubmitting}
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-[13px] bg-[#5538e7] px-3 py-3 text-sm font-semibold text-white shadow-onboarding-button transition-colors hover:bg-[#452bc8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6747ff] disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none"
      >
        {isSubmitting ? <span className="inline-flex items-center gap-2"><Loader2 className="size-4 animate-spin" aria-hidden />Processing payment</span> : <><Lock className="size-4" aria-hidden />{planName ? `Subscribe to ${planName}` : "Subscribe securely"}</>}
      </button>
    </form>
  );
}

function StripePreviewForm({ onSubmit }: { onSubmit?: () => void }) {
  return (
    <form
      className="grid gap-3.5"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit?.();
      }}
    >
      <div className="border-b border-onboarding-neutral-150 pb-3 dark:border-onboarding-neutral-750">
        <div>
          <p className="text-sm font-semibold text-onboarding-ink dark:text-white">Card details</p>
          <p className="mt-1 text-xs text-onboarding-neutral-500 dark:text-onboarding-neutral-400">Stripe test fields for frontend preview</p>
        </div>
      </div>
      <LinkAuthenticationElement />
      <PaymentElement options={{
        layout: "tabs",
        paymentMethodOrder: ["card"],
        terms: { card: "never" },
        wallets: { applePay: "never", googlePay: "never", link: "never" },
      }} />
      <button
        type="submit"
        disabled={!onSubmit}
        className="h-12 rounded-xl bg-onboarding-purple-700 text-sm font-semibold text-white shadow-onboarding-button disabled:cursor-default disabled:opacity-80"
      >
        Preview only
      </button>
    </form>
  );
}

const lightAppearance = {
  theme: "stripe" as const,
  variables: {
    colorPrimary: "#6747ff",
    colorBackground: "#ffffff",
    colorText: "#080e28",
    colorDanger: "#b42318",
    borderRadius: "8px",
    fontFamily: "Arial, sans-serif",
    spacingUnit: "2px",
    fontSizeBase: "16px",
    fontLineHeight: "1.25",
    gridRowSpacing: "6px",
  },
  rules: {
    ".Input": { padding: "11px 12px" },
    ".Label": { fontSize: "12px", marginBottom: "2px" },
  },
};

const darkAppearance = {
  theme: "night" as const,
  variables: {
    colorPrimary: "#9b7cff",
    colorBackground: "#151820",
    colorText: "#f7f7fb",
    colorDanger: "#ff8a80",
    borderRadius: "10px",
    fontFamily: "Arial, sans-serif",
    spacingUnit: "4px",
  },
};

export default function StripeCheckout({
  clientSecret,
  preview = false,
  previewAmount = 19999,
  previewCurrency = "usd",
  onPreviewSubmit,
  planName,
  onRetry,
}: {
  clientSecret: string;
  preview?: boolean;
  previewAmount?: number;
  previewCurrency?: string;
  onPreviewSubmit?: () => void;
  planName?: string;
  onRetry?: () => void;
}) {
  const { isDark } = useThemeMode();
  const appearance = isDark ? darkAppearance : lightAppearance;

  if (!stripePromise) return null;

  if (preview) {
    return (
      <Elements
        stripe={stripePromise}
        options={{
          mode: "subscription",
          amount: previewAmount,
          currency: previewCurrency,
          appearance,
        }}
      >
        <StripePreviewForm onSubmit={onPreviewSubmit} />
      </Elements>
    );
  }

  return (
    <CheckoutElementsProvider
      stripe={stripePromise}
      options={{
        clientSecret,
        elementsOptions: {
          appearance,
        },
      }}
    >
      <CheckoutForm planName={planName} onRetry={onRetry} />
    </CheckoutElementsProvider>
  );
}
