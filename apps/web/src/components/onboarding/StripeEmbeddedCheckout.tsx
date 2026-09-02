"use client";

import { useState } from "react";
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

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim();
const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

function CheckoutForm() {
  const result = useCheckoutElements();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (result.type === "loading") {
    return <div className="grid min-h-72 place-items-center" role="status"><Loader2 className="size-5 animate-spin text-onboarding-purple-600" aria-label="Loading secure payment form" /></div>;
  }

  if (result.type === "error") {
    return <div className="rounded-xl border border-onboarding-warning-150 bg-onboarding-warning-50 p-4 text-sm text-onboarding-warning-900" role="alert">{result.error.message}</div>;
  }

  const { checkout } = result;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!checkout.canConfirm || isSubmitting) return;

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
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3.5">
      <div className="flex items-center justify-between gap-4 border-b border-onboarding-neutral-150 pb-3 dark:border-onboarding-neutral-750">
        <div>
          <p className="text-sm font-semibold text-onboarding-ink dark:text-white">Card details</p>
          <p className="mt-1 text-xs text-onboarding-neutral-500 dark:text-onboarding-neutral-400">Your payment information is encrypted by Stripe</p>
        </div>
        <span className="grid size-9 shrink-0 place-items-center text-onboarding-success-600 dark:text-onboarding-success-400">
          <Lock className="size-6" aria-hidden />
        </span>
      </div>

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
        className="h-12 rounded-xl bg-onboarding-purple-700 text-sm font-semibold text-white shadow-onboarding-button transition-[transform,box-shadow,background-color] duration-150 enabled:hover:-translate-y-0.5 enabled:hover:bg-onboarding-purple-800 enabled:active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? <span className="inline-flex items-center gap-2"><Loader2 className="size-4 animate-spin" aria-hidden />Processing payment</span> : "Subscribe securely"}
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
      <div className="flex items-center justify-between gap-4 border-b border-onboarding-neutral-150 pb-3 dark:border-onboarding-neutral-750">
        <div>
          <p className="text-sm font-semibold text-onboarding-ink dark:text-white">Card details</p>
          <p className="mt-1 text-xs text-onboarding-neutral-500 dark:text-onboarding-neutral-400">Stripe test fields for frontend preview</p>
        </div>
        <span className="rounded-full bg-onboarding-purple-50 px-2.5 py-1 text-[0.65rem] font-semibold tracking-[0.08em] text-onboarding-purple-700 uppercase">Preview</span>
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

const appearance = {
  theme: "stripe" as const,
  variables: {
    colorPrimary: "#5b2bc6",
    colorText: "#111527",
    colorDanger: "#b42318",
    borderRadius: "10px",
    fontFamily: "Arial, sans-serif",
    spacingUnit: "4px",
  },
};

export default function StripeEmbeddedCheckout({
  clientSecret,
  preview = false,
  previewAmount = 19999,
  previewCurrency = "usd",
  onPreviewSubmit,
}: {
  clientSecret: string;
  preview?: boolean;
  previewAmount?: number;
  previewCurrency?: string;
  onPreviewSubmit?: () => void;
}) {
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
      <CheckoutForm />
    </CheckoutElementsProvider>
  );
}
