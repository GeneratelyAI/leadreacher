"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Link2,
  Loader2,
  Mail,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { HeroBadge } from "@/components/onboarding/HeroBadge";
import { OnboardingCard } from "@/components/onboarding/OnboardingCard";
import { OnboardingChrome } from "@/components/onboarding/OnboardingChrome";
import { Button } from "@/components/ui/Button";
import { applyStoredTheme } from "@/hooks/useThemeMode";
import { apiFetch } from "@/lib/api";
import { onboardingHref } from "./steps";

type SocialAccount = {
  platform: string;
  accountName: string | null;
  avatarUrl: string | null;
  status: "active" | "error" | string;
};

type SocialAccountsResponse = {
  accounts: SocialAccount[];
};

const CHANNELS = [
  {
    key: "linkedin",
    title: "LinkedIn",
    description: "Connect your account to start outreach.",
    icon: <i className="fa-brands fa-linkedin-in text-xl leading-none" aria-hidden />,
    iconClassName: "onboarding-channel-logo--linkedin",
    available: true,
  },
  {
    key: "whatsapp",
    title: "WhatsApp Business",
    description: "Coming soon",
    icon: <i className="fa-brands fa-whatsapp text-xl leading-none" aria-hidden />,
    iconClassName: "onboarding-channel-logo--whatsapp",
    available: false,
  },
  {
    key: "email",
    title: "Email",
    description: "Coming soon",
    icon: <Mail className="size-5" aria-hidden />,
    iconClassName: "onboarding-channel-logo--email",
    available: false,
  },
] as const;

function hasActiveAccount(accounts: SocialAccount[], platform: string): boolean {
  return accounts.some(
    (account) => account.platform.toLowerCase() === platform && account.status === "active",
  );
}

export default function ChannelsClient() {
  useLayoutEffect(() => {
    applyStoredTheme();
  }, []);

  const router = useRouter();
  const searchParams = useSearchParams();
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const connectionFailed = searchParams.get("status") === "failed";
  const connectionReturned = searchParams.get("status") === "connected";

  const loadAccounts = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await apiFetch<SocialAccountsResponse>("/social-accounts");
      setAccounts(response.accounts);
      setError(null);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Unable to load connected channels.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadAccounts();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadAccounts]);

  async function handleConnectLinkedIn() {
    if (isConnecting) return;

    setIsConnecting(true);
    setError(null);
    try {
      const result = await apiFetch<{ url: string }>("/social-accounts/connect", {
        method: "POST",
        body: JSON.stringify({ provider: "LINKEDIN" }),
      });
      window.location.assign(result.url);
    } catch (connectError) {
      setError(
        connectError instanceof Error ? connectError.message : "Unable to start LinkedIn connection.",
      );
      setIsConnecting(false);
    }
  }

  async function handleComplete() {
    if (isCompleting) return;

    setIsCompleting(true);
    setError(null);
    try {
      await apiFetch<{ completed: boolean }>("/onboarding/complete", { method: "POST" });
      setCompleted(true);
    } catch (completeError) {
      setError(
        completeError instanceof Error ? completeError.message : "Unable to complete onboarding.",
      );
    } finally {
      setIsCompleting(false);
    }
  }

  const linkedInConnected = hasActiveAccount(accounts, "linkedin");

  return (
    <div className="onboarding-page relative flex h-dvh min-h-dvh w-full flex-col overflow-y-auto">
      <OnboardingChrome activeStep="channels" />
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center px-5 pb-28 pt-28 lg:pt-34">
        <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
          <HeroBadge icon={<Link2 className="size-7" />} tone="success" />
          <h1 className="mt-5 text-3xl font-bold tracking-tight text-onboarding-ink sm:text-4xl dark:text-onboarding-neutral-0">
            Connect your channels
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-onboarding-neutral-600 dark:text-onboarding-neutral-400">
            Link the platforms where your outreach will happen.
          </p>
        </div>

        {connectionFailed ? (
          <p className="mx-auto mt-6 w-full max-w-3xl rounded-onboarding bg-onboarding-warning-50 px-4 py-3 text-sm text-onboarding-warning-900 dark:bg-onboarding-warning-900 dark:text-onboarding-warning-150" role="alert">
            The connection was not completed. You can try again whenever you&apos;re ready.
          </p>
        ) : null}
        {connectionReturned ? (
          <p className="mx-auto mt-6 w-full max-w-3xl rounded-onboarding bg-onboarding-success-50 px-4 py-3 text-sm text-onboarding-success-900 dark:bg-onboarding-success-900 dark:text-onboarding-success-50">
            Connection request received. Refresh the list once your provider has finished activating it.
          </p>
        ) : null}
        {error ? (
          <p className="mx-auto mt-6 w-full max-w-3xl rounded-onboarding bg-onboarding-error-50 px-4 py-3 text-sm text-onboarding-error-900 dark:bg-onboarding-error-900 dark:text-onboarding-error-50" role="alert">
            {error}
          </p>
        ) : null}

        <OnboardingCard className="mx-auto mt-8 w-full max-w-3xl overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center gap-3 px-6 py-12 text-sm text-onboarding-neutral-600 dark:text-onboarding-neutral-400">
              <Loader2 className="size-5 animate-spin text-onboarding-purple-500" aria-hidden />
              Loading channels
            </div>
          ) : (
            <div className="divide-y divide-onboarding-neutral-150 dark:divide-onboarding-neutral-750">
              {CHANNELS.map((channel) => {
                const connected = hasActiveAccount(accounts, channel.key);
                return (
                  <article key={channel.key} className="flex items-center gap-4 px-5 py-5 sm:px-6">
                    <span className={`inline-flex size-11 shrink-0 items-center justify-center rounded-onboarding ${channel.iconClassName}`}>
                      {channel.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h2 className="text-base font-semibold text-onboarding-ink dark:text-onboarding-neutral-0">
                        {channel.title}
                      </h2>
                      <p className="mt-1 text-sm text-onboarding-neutral-600 dark:text-onboarding-neutral-400">
                        {connected && accounts.find((account) => account.platform.toLowerCase() === channel.key)?.accountName
                          ? accounts.find((account) => account.platform.toLowerCase() === channel.key)?.accountName
                          : channel.description}
                      </p>
                    </div>
                    {connected ? (
                      <span className="status-badge bg-onboarding-success-50 text-onboarding-success-900 dark:bg-onboarding-success-900 dark:text-onboarding-success-50">
                        <Check className="size-3" aria-hidden />
                        Connected
                      </span>
                    ) : channel.available ? (
                      <Button
                        type="button"
                        variant="brand"
                        size="sm"
                        disabled={isConnecting}
                        onClick={() => void handleConnectLinkedIn()}
                      >
                        {isConnecting ? "Opening..." : "Connect"}
                      </Button>
                    ) : (
                      <span className="status-badge bg-onboarding-neutral-100 text-onboarding-neutral-600 dark:bg-onboarding-neutral-800 dark:text-onboarding-neutral-400">
                        Coming soon
                      </span>
                    )}
                  </article>
                );
              })}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-onboarding-neutral-150 px-5 py-4 dark:border-onboarding-neutral-750 sm:px-6">
            <p className="flex items-center gap-2 text-sm text-onboarding-neutral-600 dark:text-onboarding-neutral-400">
              <ShieldCheck className="size-4 text-onboarding-success-500" aria-hidden />
              {linkedInConnected ? "1 required channel connected" : "1 required channel to connect"}
            </p>
            <Button type="button" variant="ghost" size="sm" disabled={isLoading} onClick={() => void loadAccounts()}>
              <RefreshCw className="size-4" aria-hidden />
              Refresh
            </Button>
          </div>
        </OnboardingCard>

        {completed ? (
          <OnboardingCard className="mx-auto mt-6 flex w-full max-w-3xl items-center gap-3 border-onboarding-success-500 px-5 py-4">
            <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-onboarding-pill bg-onboarding-success-50 text-onboarding-success-500">
              <Check className="size-5" aria-hidden />
            </span>
            <div>
              <p className="font-semibold text-onboarding-ink dark:text-onboarding-neutral-0">Onboarding complete</p>
              <p className="mt-1 text-sm text-onboarding-neutral-600 dark:text-onboarding-neutral-400">
                Your outreach workspace is ready for its first campaign.
              </p>
            </div>
          </OnboardingCard>
        ) : null}
      </main>

      <div className="pointer-events-none fixed inset-x-0 bottom-7 z-30 flex items-center justify-between px-6 sm:px-10">
        <Button
          type="button"
          variant="secondary"
          onClick={() => router.push(onboardingHref("checkout"))}
          className="pointer-events-auto h-13 px-7 text-base"
        >
          <ArrowLeft className="size-5" aria-hidden />
          Back
        </Button>
        <Button
          type="button"
          variant="brand"
          disabled={!linkedInConnected || isCompleting || completed}
          onClick={() => void handleComplete()}
          className="pointer-events-auto h-13 px-8 text-base sm:px-10"
        >
          {completed ? "Setup complete" : isCompleting ? "Finishing..." : "Finish setup"}
          <ArrowRight className="size-5" aria-hidden />
        </Button>
      </div>
    </div>
  );
}
