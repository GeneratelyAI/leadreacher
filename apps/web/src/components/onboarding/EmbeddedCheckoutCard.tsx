"use client";

import { lazy, Suspense } from "react";
import { CreditCard, Lock } from "@/components/ui/icons";

const StripeEmbeddedCheckout = lazy(() => import("@/components/onboarding/StripeEmbeddedCheckout"));

function VisaMark() {
  return (
    <span className="inline-flex h-5 w-8 items-center justify-center rounded-[2px] bg-[#0a5fb4] text-[0.62rem] font-black italic tracking-[-0.06em] text-white" role="img" aria-label="Visa">
      VISA
    </span>
  );
}

function MastercardMark() {
  return (
    <span className="inline-flex h-5 w-8 items-center justify-center rounded-[2px] bg-[#18181b]" role="img" aria-label="Mastercard">
      <span className="relative h-3.5 w-5" aria-hidden>
        <span className="absolute inset-y-0 left-0 aspect-square rounded-full bg-[#eb001b]" />
        <span className="absolute inset-y-0 right-0 aspect-square rounded-full bg-[#f79e1b]" />
        <span className="absolute inset-y-0 left-1/2 aspect-square -translate-x-1/2 rounded-full bg-[#ff5f00] opacity-90" />
      </span>
    </span>
  );
}

function AmexMark() {
  return (
    <span className="inline-flex h-5 w-8 items-center justify-center rounded-[2px] bg-[#009cde] text-[0.48rem] font-black italic tracking-[-0.08em] text-white" role="img" aria-label="American Express">
      AMEX
    </span>
  );
}

function UnionPayMark() {
  return (
    <span className="inline-flex h-5 w-8 -skew-x-12 items-center justify-center rounded-[2px] bg-[linear-gradient(110deg,#e21836_0_34%,#0071bc_34%_67%,#00a651_67%)] text-[0.34rem] font-black tracking-[-0.08em] text-white" role="img" aria-label="UnionPay">
      <span className="skew-x-12">UnionPay</span>
    </span>
  );
}

export function PaymentTrustBar() {
  return (
    <div className="checkout-accent-card checkout-accent-card--compact mb-5 flex flex-wrap items-center justify-between gap-x-5 gap-y-3 rounded-xl px-4 py-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="grid size-8 shrink-0 place-items-center text-onboarding-success-600 dark:text-onboarding-success-400">
          <Lock className="size-6" aria-hidden />
        </span>
        <div>
          <p className="text-xs font-semibold text-onboarding-ink dark:text-white">Protected checkout</p>
          <p className="text-[0.68rem] text-onboarding-neutral-500 dark:text-onboarding-neutral-400">Encrypted end to end</p>
        </div>
      </div>

      <div className="flex items-center gap-1" aria-label="Accepted cards: Visa, Mastercard, American Express, and UnionPay">
        <VisaMark />
        <MastercardMark />
        <AmexMark />
        <UnionPayMark />
      </div>

      <div className="flex items-center gap-1.5 border-onboarding-neutral-150 text-xs text-onboarding-neutral-500 sm:border-l sm:pl-5 dark:border-onboarding-neutral-750 dark:text-onboarding-neutral-400">
        <span>Powered by</span>
        <span className="text-base font-bold tracking-[-0.06em] text-[#635bff]">stripe</span>
      </div>
    </div>
  );
}

function MockCheckout({ onSubmit }: { onSubmit?: () => void }) {
  return (
    <div className="checkout-mock checkout-accent-card rounded-2xl p-5 sm:p-7 h-short:sm:p-5">
      <div className="flex items-center justify-between gap-4 border-b border-onboarding-neutral-150 pb-4 dark:border-onboarding-neutral-750">
        <div>
          <p className="text-sm font-semibold text-onboarding-ink dark:text-white">Card details</p>
          <p className="mt-1 text-xs text-onboarding-neutral-500 dark:text-onboarding-neutral-400">Preview mode: no payment will be processed</p>
        </div>
        <div className="flex items-center gap-1.5" aria-hidden>
          <VisaMark />
          <MastercardMark />
        </div>
      </div>
      <div className="checkout-mock-fields mt-6 grid gap-5 h-short:mt-4 h-short:gap-3.5">
        <label className="grid gap-1.5 text-xs font-medium text-onboarding-neutral-600 dark:text-onboarding-neutral-300">
          Card information
          <span className="flex h-14 min-w-0 items-center gap-2 rounded-xl border border-onboarding-neutral-200 px-3 text-xs text-onboarding-neutral-400 sm:gap-3 sm:px-4 sm:text-sm dark:border-onboarding-neutral-650">
            <CreditCard className="size-5 shrink-0" aria-hidden />
            <span className="min-w-0 whitespace-nowrap">4242 4242 4242 4242</span>
            <span className="ml-auto shrink-0 whitespace-nowrap">12 / 34&nbsp;&nbsp; CVC</span>
          </span>
        </label>
        <label className="grid gap-1.5 text-xs font-medium text-onboarding-neutral-600 dark:text-onboarding-neutral-300">
          Name on card
          <span className="flex h-14 items-center rounded-xl border border-onboarding-neutral-200 px-4 text-sm text-onboarding-neutral-700 dark:border-onboarding-neutral-650 dark:text-onboarding-neutral-200">Alex Morgan</span>
        </label>
        <button type="button" className="mt-1 h-14 rounded-xl bg-onboarding-purple-600 text-sm font-semibold text-white shadow-onboarding-button transition-[transform,box-shadow,background-color] duration-150 enabled:hover:-translate-y-0.5 enabled:hover:bg-onboarding-purple-700 enabled:active:translate-y-0 disabled:cursor-not-allowed" disabled={!onSubmit} onClick={onSubmit}>
          Subscribe to LeadReacher Pro
        </button>
      </div>
    </div>
  );
}

export function EmbeddedCheckoutCard({
  clientSecret,
  mockMode,
  showStripePreview = false,
  previewAmount,
  previewCurrency,
  onMockSubmit,
}: {
  clientSecret: string;
  mockMode: boolean;
  showStripePreview?: boolean;
  previewAmount?: number;
  previewCurrency?: string;
  onMockSubmit?: () => void;
}) {
  if (mockMode && !showStripePreview) return <MockCheckout onSubmit={onMockSubmit} />;

  if (!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim()) {
    return (
      <div className="rounded-xl border border-onboarding-warning-150 bg-onboarding-warning-50 p-5 text-sm text-onboarding-warning-900" role="alert">
        Stripe Checkout is unavailable because the publishable key is not configured.
      </div>
    );
  }

  return (
    <div className="checkout-accent-card checkout-accent-card--stripe overflow-hidden rounded-2xl p-4 sm:p-5">
      <Suspense fallback={<div className="min-h-72" role="status" aria-label="Loading secure checkout" />}>
        <StripeEmbeddedCheckout
          clientSecret={clientSecret}
          preview={mockMode && showStripePreview}
          previewAmount={previewAmount}
          previewCurrency={previewCurrency}
          onPreviewSubmit={onMockSubmit}
        />
      </Suspense>
    </div>
  );
}
