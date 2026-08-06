"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Link2,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { HeroBadge } from "@/components/onboarding/HeroBadge";
import { ChannelLogo } from "@/components/onboarding/ChannelLogo";
import { OnboardingCard } from "@/components/onboarding/OnboardingCard";
import { OnboardingChrome } from "@/components/onboarding/OnboardingChrome";
import { Button } from "@/components/ui/Button";
import { applyStoredTheme } from "@/hooks/useThemeMode";
import { ApiError, apiFetch, bootstrapOrganization } from "@/lib/api";
import {
  getChannelRecommendations,
  type ChannelRecommendationKey,
  type JsonValue,
} from "@/lib/onboarding/channel-recommendations";
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

// Any of these Unipile providers collapse to the same normalized "email"
// platform server-side (see apps/api/src/lib/channels.ts), so Gmail and
// Outlook can't be distinguished once connected — both rows below share
// this match list and will flip to "Connected" together.
const EMAIL_MATCH_PLATFORMS = ["email", "google", "microsoft", "outlook", "imap", "mail"] as const;

const CHANNELS = [
  {
    key: "linkedin",
    title: "LinkedIn",
    description: "Connect your account to start outreach.",
    icon: <ChannelLogo name="linkedin" className="size-10" />,
    iconClassName: "onboarding-channel-logo--linkedin",
    available: true,
    provider: "LINKEDIN" as const,
    matchPlatforms: ["linkedin"] as const,
    recommendationKey: "linkedin" as const,
  },
  {
    key: "whatsapp",
    title: "WhatsApp",
    description: "Message prospects directly on WhatsApp.",
    icon: <ChannelLogo name="whatsapp-mark" className="size-10 scale-[1.12]" />,
    iconClassName: "onboarding-channel-logo--whatsapp-mark",
    available: true,
    provider: "WHATSAPP" as const,
    matchPlatforms: ["whatsapp"] as const,
    recommendationKey: "whatsapp" as const,
  },
  {
    key: "instagram",
    title: "Instagram",
    description: "Message prospects directly on Instagram.",
    icon: <ChannelLogo name="instagram" className="size-10" />,
    iconClassName: "onboarding-channel-logo--instagram",
    available: true,
    provider: "INSTAGRAM" as const,
    matchPlatforms: ["instagram"] as const,
    recommendationKey: null,
  },
  {
    key: "gmail",
    title: "Gmail",
    description: "Connect your Gmail account.",
    icon: <ChannelLogo name="gmail" className="size-10" />,
    iconClassName: "onboarding-channel-logo--gmail",
    available: true,
    provider: "GOOGLE" as const,
    matchPlatforms: EMAIL_MATCH_PLATFORMS,
    recommendationKey: "email" as const,
  },
  {
    key: "outlook",
    title: "Outlook",
    description: "Connect your Outlook account.",
    icon: <ChannelLogo name="outlook" className="size-10" />,
    iconClassName: "onboarding-channel-logo--outlook",
    available: true,
    provider: "OUTLOOK" as const,
    matchPlatforms: EMAIL_MATCH_PLATFORMS,
    recommendationKey: "email" as const,
  },
] as const;

function hasActiveAccount(accounts: SocialAccount[], platforms: readonly string[]): boolean {
  return accounts.some(
    (account) => platforms.includes(account.platform.toLowerCase()) && account.status === "active",
  );
}

function findAccountForChannel(
  accounts: SocialAccount[],
  platforms: readonly string[],
): SocialAccount | undefined {
  return accounts.find((account) => platforms.includes(account.platform.toLowerCase()));
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
  const [error, setError] = useState<string | null>(null);
  const [recommendedChannels, setRecommendedChannels] = useState<Set<ChannelRecommendationKey>>(
    new Set(),
  );
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

  useEffect(() => {
    if (!connectionReturned) return;
    let attempts = 0;
    const interval = window.setInterval(() => {
      attempts += 1;
      void loadAccounts();
      if (attempts >= 5) {
        window.clearInterval(interval);
        router.replace(onboardingHref("channels"));
      }
    }, 2_000);
    return () => window.clearInterval(interval);
  }, [connectionReturned, loadAccounts, router]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { orgId } = await bootstrapOrganization("LeadReacher");
        const strategy = await apiFetch<{ channels: JsonValue }>(`/strategy/${orgId}`);
        if (cancelled) return;
        const recommendations = getChannelRecommendations(strategy.channels);
        setRecommendedChannels(new Set(recommendations.map((item) => item.channel)));
      } catch (loadError) {
        // "Recommended" tags are a decorative enhancement layered on top of
        // the strategy generated earlier in onboarding — a missing or failed
        // strategy (e.g. 404 before it's generated) should never block the
        // actual channel-connection flow, so this fails silently.
        if (loadError instanceof ApiError && loadError.status === 404) return;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleConnect(provider: "LINKEDIN" | "WHATSAPP" | "INSTAGRAM" | "GOOGLE" | "OUTLOOK") {
    if (isConnecting) return;

    setIsConnecting(true);
    setError(null);
    try {
      const result = await apiFetch<{ url: string }>("/social-accounts/connect", {
        method: "POST",
        body: JSON.stringify({ provider, returnTo: "onboarding" }),
      });
      window.location.assign(result.url);
    } catch (connectError) {
      setError(
        connectError instanceof Error ? connectError.message : "Unable to start channel connection.",
      );
      setIsConnecting(false);
    }
  }

  async function handleComplete() {
    if (isCompleting) return;

    setIsCompleting(true);
    setError(null);
    try {
      await apiFetch<{
        completed: true;
        campaignId: string;
        launched: true;
        jobCount: number;
      }>(
        "/onboarding/complete",
        { method: "POST" },
      );
      router.push("/dashboard");
    } catch (completeError) {
      setError(
        completeError instanceof Error ? completeError.message : "Unable to complete onboarding.",
      );
    } finally {
      setIsCompleting(false);
    }
  }

  const linkedInConnected = hasActiveAccount(accounts, ["linkedin"]);

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
            Connect LinkedIn for your first campaign. Other connected channels will be available when you build additional campaign sequences.
          </p>
        </div>

        {connectionFailed ? (
          <p className="mx-auto mt-6 w-full max-w-3xl rounded-onboarding bg-onboarding-warning-50 px-4 py-3 text-sm text-onboarding-warning-900 dark:bg-onboarding-warning-900 dark:text-onboarding-warning-150" role="alert">
            The connection was not completed. You can try again whenever you&apos;re ready.
          </p>
        ) : null}
        {connectionReturned ? (
          <p className="mx-auto mt-6 w-full max-w-3xl rounded-onboarding bg-onboarding-success-50 px-4 py-3 text-sm text-onboarding-success-900 dark:bg-onboarding-success-900 dark:text-onboarding-success-50">
            Connection request received. We&apos;re checking for the activated account now.
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
                const connected = hasActiveAccount(accounts, channel.matchPlatforms);
                const connectedAccountName = connected
                  ? findAccountForChannel(accounts, channel.matchPlatforms)?.accountName
                  : null;
                const isRecommended =
                  channel.recommendationKey !== null &&
                  recommendedChannels.has(channel.recommendationKey);
                return (
                  <article key={channel.key} className="flex items-center gap-4 px-5 py-5 sm:px-6">
                    <span className={`inline-flex size-11 shrink-0 items-center justify-center rounded-onboarding ${channel.iconClassName}`}>
                      {channel.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-base font-semibold text-onboarding-ink dark:text-onboarding-neutral-0">
                          {channel.title}
                        </h2>
                        {isRecommended ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-onboarding-purple-50 px-2 py-0.5 text-xs font-semibold text-onboarding-purple-700 dark:bg-onboarding-purple-900 dark:text-onboarding-purple-100">
                            <Sparkles className="size-3" aria-hidden />
                            Recommended
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm text-onboarding-neutral-600 dark:text-onboarding-neutral-400">
                        {connectedAccountName ?? channel.description}
                      </p>
                    </div>
                    {connected ? (
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="status-badge bg-onboarding-success-50 text-onboarding-success-900 dark:bg-onboarding-success-900 dark:text-onboarding-success-50">
                          <Check className="size-3" aria-hidden />
                          Connected
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isConnecting}
                          onClick={() => void handleConnect(channel.provider)}
                        >
                          Add another
                        </Button>
                      </div>
                    ) : channel.available ? (
                      <Button
                        type="button"
                        variant="brand"
                        size="sm"
                        disabled={isConnecting}
                        onClick={() => void handleConnect(channel.provider)}
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

        <p className="mx-auto mt-4 max-w-2xl text-center text-sm leading-6 text-onboarding-neutral-600 dark:text-onboarding-neutral-400">
          Finishing setup approves the prospects found during audience analysis and starts your first LinkedIn campaign from the connected account.
        </p>

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
          disabled={!linkedInConnected || isCompleting}
          onClick={() => void handleComplete()}
          className="pointer-events-auto h-13 px-8 text-base sm:px-10"
        >
          {isCompleting ? "Launching campaign..." : "Finish and launch"}
          <ArrowRight className="size-5" aria-hidden />
        </Button>
      </div>
    </div>
  );
}
