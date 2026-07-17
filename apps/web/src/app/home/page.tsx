"use client";

import Link from "next/link";
import { Check, CircleAlert, Link2, Loader2, Sparkles } from "lucide-react";
import { useEffect, useLayoutEffect, useState } from "react";
import { ChannelLogo } from "@/components/onboarding/ChannelLogo";
import { OnboardingCard } from "@/components/onboarding/OnboardingCard";
import { Button } from "@/components/ui/Button";
import { ApiError, apiFetch } from "@/lib/api";
import { applyStoredTheme } from "@/hooks/useThemeMode";

type SocialAccount = {
  platform: string;
  accountName: string | null;
  status: string;
};

type BootstrapResponse = {
  subscriptionStatus: string | null;
};

function subscriptionLabel(status: string | null): string {
  if (status === "active") return "Active subscription";
  if (status === "pending") return "Payment processing";
  if (status) return status.replaceAll("_", " ");
  return "Subscription setup required";
}

function isChannelLogoName(value: string): value is "linkedin" | "whatsapp" {
  return value === "linkedin" || value === "whatsapp";
}

export default function HomePage() {
  useLayoutEffect(() => {
    applyStoredTheme();
  }, []);

  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadHome() {
      try {
        const [socialAccounts, bootstrap] = await Promise.all([
          apiFetch<{ accounts: SocialAccount[] }>("/social-accounts"),
          apiFetch<BootstrapResponse>("/auth/bootstrap", {
            method: "POST",
            body: JSON.stringify({ name: "LeadReacher" }),
          }),
        ]);
        if (cancelled) return;

        setAccounts(socialAccounts.accounts);
        setSubscriptionStatus(bootstrap.subscriptionStatus);
      } catch (loadError) {
        if (cancelled) return;
        if (loadError instanceof ApiError && loadError.status === 401) {
          window.location.assign("/login");
          return;
        }
        setError(loadError instanceof Error ? loadError.message : "Unable to load your workspace.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void loadHome();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="onboarding-page flex min-h-dvh items-center px-5 py-12">
      <div className="mx-auto w-full max-w-3xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-onboarding-purple-600 dark:text-onboarding-purple-200">LeadReacher</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-onboarding-ink dark:text-onboarding-neutral-0">Your workspace is ready</h1>
            <p className="mt-2 text-onboarding-neutral-600 dark:text-onboarding-neutral-400">Review your connected channels and subscription before launching outreach.</p>
          </div>
          <Link href="/onboarding?step=strategy">
            <Button variant="brand">View strategy</Button>
          </Link>
        </div>

        {error ? (
          <p className="mt-6 rounded-onboarding bg-onboarding-error-50 px-4 py-3 text-sm text-onboarding-error-900 dark:bg-onboarding-error-900 dark:text-onboarding-error-50" role="alert">
            {error}
          </p>
        ) : null}

        <div className="mt-8 grid gap-5 md:grid-cols-2">
          <OnboardingCard className="p-6">
            <div className="flex items-center gap-3">
              <span className="inline-flex size-10 items-center justify-center rounded-onboarding bg-onboarding-purple-50 text-onboarding-purple-600 dark:bg-onboarding-purple-900 dark:text-onboarding-purple-200">
                <Sparkles className="size-5" aria-hidden />
              </span>
              <div>
                <h2 className="font-semibold text-onboarding-ink dark:text-onboarding-neutral-0">Subscription</h2>
                <p className="mt-1 text-sm text-onboarding-neutral-600 dark:text-onboarding-neutral-400">Stripe-managed plan</p>
              </div>
            </div>
            {isLoading ? (
              <div className="mt-6 flex items-center gap-2 text-sm text-onboarding-neutral-600 dark:text-onboarding-neutral-400"><Loader2 className="size-4 animate-spin" aria-hidden /> Loading subscription</div>
            ) : (
              <p className="mt-6 flex items-center gap-2 text-sm font-medium capitalize text-onboarding-ink dark:text-onboarding-neutral-0">
                {subscriptionStatus === "active" ? <Check className="size-4 text-onboarding-success-500" aria-hidden /> : <CircleAlert className="size-4 text-onboarding-warning-500" aria-hidden />}
                {subscriptionLabel(subscriptionStatus)}
              </p>
            )}
          </OnboardingCard>

          <OnboardingCard className="p-6">
            <div className="flex items-center gap-3">
              <span className="inline-flex size-10 items-center justify-center rounded-onboarding bg-onboarding-success-50 text-onboarding-success-500 dark:bg-onboarding-success-900">
                <Link2 className="size-5" aria-hidden />
              </span>
              <div>
                <h2 className="font-semibold text-onboarding-ink dark:text-onboarding-neutral-0">Connected channels</h2>
                <p className="mt-1 text-sm text-onboarding-neutral-600 dark:text-onboarding-neutral-400">Accounts ready for outreach</p>
              </div>
            </div>
            {isLoading ? (
              <div className="mt-6 flex items-center gap-2 text-sm text-onboarding-neutral-600 dark:text-onboarding-neutral-400"><Loader2 className="size-4 animate-spin" aria-hidden /> Loading channels</div>
            ) : accounts.length === 0 ? (
              <p className="mt-6 text-sm text-onboarding-neutral-600 dark:text-onboarding-neutral-400">No channels connected yet.</p>
            ) : (
              <ul className="mt-5 space-y-3">
                {accounts.map((account) => {
                  const platform = account.platform.toLowerCase();
                  return (
                    <li key={`${account.platform}-${account.accountName ?? "account"}`} className="flex items-center gap-3 text-sm text-onboarding-ink dark:text-onboarding-neutral-0">
                      {isChannelLogoName(platform) ? (
                        <ChannelLogo name={platform} className="size-5" />
                      ) : (
                        <Link2 className="size-5 text-onboarding-purple-600 dark:text-onboarding-purple-200" aria-hidden />
                      )}
                      <span className="min-w-0 flex-1 truncate">{account.accountName ?? account.platform}</span>
                      <span className="status-badge bg-onboarding-success-50 text-onboarding-success-900 dark:bg-onboarding-success-900 dark:text-onboarding-success-50">{account.status}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </OnboardingCard>
        </div>
      </div>
    </main>
  );
}
