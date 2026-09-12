"use client";

import { lazy, Suspense } from "react";
import { CreditCard, Lock } from "@/components/ui/icons";
import styles from "./steps/CheckoutMobile.module.css";
import { isOnboardingDemo, isOnboardingPreview } from "../public/preview-api";

const StripeCheckout = lazy(() => import("@/features/onboarding/components/StripeCheckout"));

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

export function PaymentTrustBar() {
  return <header className={styles.protectedHeader}>
    <Lock className={styles.protectedLock} aria-hidden />
    <div><h2>Protected checkout</h2><p>Encrypted end to end</p></div>
    <div className={styles.stripeBrand}><span>Powered by</span><strong>stripe</strong></div>
  </header>;
}

function MockCheckout({ onSubmit }: { onSubmit?: () => void }) {
  return (
    <>
    <div className={`${styles.desktop} ${styles.previewPayment}`} aria-label="Preview payment form">
      <label>Email<input aria-label="Sample email, preview only" value="you@example.com" readOnly /></label>
      <label>Card information<input aria-label="Sample card number, preview only" value="4242 4242 4242 4242" readOnly /></label>
      <div className={styles.previewPaymentSplit}>
        <label>Expiration date<input aria-label="Sample expiry date, preview only" value="12 / 34" readOnly /></label>
        <label>Security code<input aria-label="Sample CVC, preview only" value="CVC" readOnly /></label>
      </div>
      <div className={styles.previewPaymentSplit}>
        <label>Country<input aria-label="Sample country, preview only" value="Canada" readOnly /></label>
        <label>Postal code<input aria-label="Sample postal code, preview only" value="M5T 1T4" readOnly /></label>
      </div>
      <button type="button" disabled={!onSubmit} onClick={onSubmit}><Lock aria-hidden />Subscribe to LeadReacher Pro</button>
      <p>Preview mode: no payment will be processed</p>
    </div>
    <div className={`checkout-mock checkout-accent-card rounded-2xl p-5 sm:p-7 h-short:sm:p-5 ${styles.mock} ${styles.mobile}`}>
      <div className={`flex items-center justify-between gap-4 border-b border-onboarding-neutral-150 pb-4 dark:border-onboarding-neutral-750 ${styles.mockHeader}`}>
        <div>
          <p className="text-sm font-semibold text-onboarding-ink dark:text-white">Card details</p>
          <p className="mt-1 text-xs text-onboarding-neutral-500 dark:text-onboarding-neutral-400">Preview mode: no payment will be processed</p>
        </div>
        <div className="flex items-center gap-1.5" aria-hidden>
          <VisaMark />
          <MastercardMark />
        </div>
      </div>
      <div className={`checkout-mock-fields mt-6 grid gap-5 h-short:mt-4 h-short:gap-3.5 ${styles.mockFields}`}>
        <label className={`grid gap-1.5 text-xs font-medium text-onboarding-neutral-600 dark:text-onboarding-neutral-300 ${styles.desktop}`}>
          Card information
          <span className="flex h-14 min-w-0 items-center gap-2 rounded-xl border border-onboarding-neutral-200 px-3 text-xs text-onboarding-neutral-400 sm:gap-3 sm:px-4 sm:text-sm dark:border-onboarding-neutral-650">
            <CreditCard className="size-5 shrink-0" aria-hidden />
            <span className="min-w-0 whitespace-nowrap">4242 4242 4242 4242</span>
            <span className="ml-auto shrink-0 whitespace-nowrap">12 / 34&nbsp;&nbsp; CVC</span>
          </span>
        </label>
        <label className={`grid gap-1.5 text-xs font-medium text-onboarding-neutral-600 dark:text-onboarding-neutral-300 ${styles.desktop}`}>
          Name on card
          <span className="flex h-14 items-center rounded-xl border border-onboarding-neutral-200 px-4 text-sm text-onboarding-neutral-700 dark:border-onboarding-neutral-650 dark:text-onboarding-neutral-200">Alex Morgan</span>
        </label>
        <div className={styles.mobile}>
          <label className={styles.previewField}>Card number<span><input aria-label="Sample card number, preview only" value="4242 4242 4242 4242" readOnly /><CreditCard aria-hidden /></span></label>
        </div>
        <div className={styles.mobile}>
          <div className={styles.previewSplit}>
            <label className={styles.previewField}>Expiry date<input aria-label="Sample expiry date, preview only" value="12 / 34" readOnly /></label>
            <label className={styles.previewField}>CVC<input aria-label="Sample CVC, preview only" value="123" readOnly /></label>
          </div>
        </div>
        <div className={styles.mobile}><p className={styles.mockSecurity}><Lock aria-hidden />Preview only. No payment will be processed.</p></div>
        <button type="button" className={`mt-1 h-14 rounded-xl bg-onboarding-purple-600 text-sm font-semibold text-white shadow-onboarding-button transition-[transform,box-shadow,background-color] duration-150 enabled:hover:-translate-y-0.5 enabled:hover:bg-onboarding-purple-700 enabled:active:translate-y-0 disabled:cursor-not-allowed ${styles.mockSubmit}`} disabled={!onSubmit} onClick={onSubmit}>
          <span className={styles.desktop}>Subscribe to LeadReacher Pro</span><span className={styles.mobile}>Subscribe (preview)</span>
        </button>
        <div className={styles.mobile}><p className={styles.mockFootnote}>Review your plan before paying.</p></div>
      </div>
    </div>
    </>
  );
}

export function CheckoutCard({
  clientSecret,
  mockMode,
  showStripePreview = false,
  previewAmount,
  previewCurrency,
  onMockSubmit,
  planName,
  onRetry,
}: {
  clientSecret: string;
  mockMode: boolean;
  showStripePreview?: boolean;
  previewAmount?: number;
  previewCurrency?: string;
  onMockSubmit?: () => void;
  planName?: string;
  onRetry?: () => void;
}) {
  if (mockMode) return isOnboardingPreview() || isOnboardingDemo() ? <MockCheckout onSubmit={onMockSubmit} /> : <p role="alert">Secure checkout is unavailable. Please contact support to enable Stripe billing.</p>;

  if (!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim()) {
    return (
      <div className="rounded-xl border border-onboarding-warning-150 bg-onboarding-warning-50 p-5 text-sm text-onboarding-warning-900" role="alert">
        Stripe Checkout is unavailable because the publishable key is not configured.
      </div>
    );
  }

  return (
    <div className={`checkout-accent-card checkout-accent-card--stripe rounded-2xl p-4 sm:p-5 ${styles.stripe}`}>
      <Suspense fallback={<div className="min-h-72" role="status" aria-label="Loading secure checkout" />}>
        <StripeCheckout
          clientSecret={clientSecret}
          planName={planName}
          onRetry={onRetry}
          preview={mockMode && showStripePreview}
          previewAmount={previewAmount}
          previewCurrency={previewCurrency}
          onPreviewSubmit={onMockSubmit}
        />
      </Suspense>
    </div>
  );
}
