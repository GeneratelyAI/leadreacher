"use client";

import { useState } from "react";
import {
  CheckoutElementsProvider,
  ContactDetailsElement,
  PaymentElement,
  useCheckoutElements,
} from "@stripe/react-stripe-js/checkout";
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
      const confirmation = await checkout.confirm({
        returnUrl: `${window.location.origin}/onboarding?step=checkout&status=success&session_id={CHECKOUT_SESSION_ID}`,
      });
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
    <form onSubmit={handleSubmit} className="grid gap-5">
      <div className="flex items-center justify-between gap-4 border-b border-onboarding-neutral-150 pb-4 dark:border-onboarding-neutral-750">
        <div>
          <p className="text-sm font-semibold text-onboarding-ink dark:text-white">Card details</p>
          <p className="mt-1 text-xs text-onboarding-neutral-500 dark:text-onboarding-neutral-400">Your payment information is encrypted by Stripe</p>
        </div>
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-onboarding-success-50 text-onboarding-success-600 dark:bg-onboarding-success-500/10 dark:text-onboarding-success-400">
          <Lock className="size-4" aria-hidden />
        </span>
      </div>

      <ContactDetailsElement />
      <PaymentElement options={{ layout: "tabs" }} />

      {errorMessage ? <p className="text-sm text-onboarding-danger-600" role="alert">{errorMessage}</p> : null}

      <button
        type="submit"
        disabled={!checkout.canConfirm || isSubmitting}
        className="h-14 rounded-xl bg-onboarding-purple-700 text-sm font-semibold text-white shadow-onboarding-button transition-[transform,box-shadow,background-color] duration-150 enabled:hover:-translate-y-0.5 enabled:hover:bg-onboarding-purple-800 enabled:active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? <span className="inline-flex items-center gap-2"><Loader2 className="size-4 animate-spin" aria-hidden />Processing payment</span> : "Subscribe securely"}
      </button>
    </form>
  );
}

export default function StripeEmbeddedCheckout({ clientSecret }: { clientSecret: string }) {
  if (!stripePromise) return null;

  return (
    <CheckoutElementsProvider
      stripe={stripePromise}
      options={{
        clientSecret,
        elementsOptions: {
          appearance: {
            theme: "stripe",
            variables: {
              colorPrimary: "#5b2bc6",
              colorText: "#111527",
              colorDanger: "#b42318",
              borderRadius: "10px",
              fontFamily: "Arial, sans-serif",
              spacingUnit: "4px",
            },
          },
        },
      }}
    >
      <CheckoutForm />
    </CheckoutElementsProvider>
  );
}
