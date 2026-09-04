"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Check,
  Lock,
  RefreshCw,
  ShieldCheck,
} from "@/components/ui/icons";
import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { ChannelLogo } from "@/components/onboarding/ChannelLogo";
import { OnboardingCard } from "@/components/onboarding/OnboardingCard";
import { ActionBar } from "@/components/ui/ActionBar";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Loading } from "@/components/ui/Loading";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { applyStoredTheme } from "@/hooks/useThemeMode";
import { ApiError, apiFetch, bootstrapCurrentOrganization } from "@/lib/api";
import { isOnboardingDemo, isOnboardingPreview } from "@/lib/onboarding/preview-api";
import {
  getChannelRecommendations,
  type ChannelRecommendationKey,
  type JsonValue,
} from "@/lib/onboarding/channel-recommendations";
import { navigateOnboarding, onboardingHref } from "./steps";
import { completeStoredDemoSession } from "@/lib/onboarding/demo-store";

type SocialAccount = {
  id: string;
  platform: string;
  providerType: string | null;
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
    recommendationKey: "instagram" as const,
  },
  {
    key: "facebook",
    title: "Facebook",
    description: "Message prospects directly on Facebook Messenger.",
    icon: <ChannelLogo name="facebook" className="size-10" />,
    iconClassName: "onboarding-channel-logo--facebook",
    available: true,
    provider: "MESSENGER" as const,
    matchPlatforms: ["facebook"] as const,
    recommendationKey: "facebook" as const,
  },
  {
    key: "gmail",
    title: "Gmail",
    description: "Connect your Gmail account.",
    icon: <ChannelLogo name="gmail" className="size-10" />,
    iconClassName: "onboarding-channel-logo--gmail",
    available: true,
    provider: "GOOGLE" as const,
    matchPlatforms: ["email"] as const,
    providerTypes: ["google", "gmail"] as const,
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
    matchPlatforms: ["email"] as const,
    providerTypes: ["outlook", "microsoft"] as const,
    recommendationKey: "email" as const,
  },
] as const;

function accountMatchesChannel(
  account: SocialAccount,
  channel: (typeof CHANNELS)[number],
): boolean {
  if (
    !channel.matchPlatforms.some(
      (platform: string) => platform === account.platform.toLowerCase(),
    )
  ) {
    return false;
  }
  if (!("providerTypes" in channel)) return true;
  return channel.providerTypes.some(
    (providerType) => providerType === account.providerType?.toLowerCase(),
  );
}

function findAccountForChannel(
  accounts: SocialAccount[],
  channel: (typeof CHANNELS)[number],
): SocialAccount | undefined {
  return accounts.find((account) => accountMatchesChannel(account, channel));
}

function hasActiveAccount(
  accounts: SocialAccount[],
  channel: (typeof CHANNELS)[number],
): boolean {
  return accounts.some(
    (account) => accountMatchesChannel(account, channel) && account.status === "active",
  );
}

export function returnedConnectionIsActive(
  accounts: SocialAccount[],
  pendingChannelKey: string | null,
): boolean {
  const pendingChannel = CHANNELS.find((channel) => channel.key === pendingChannelKey);
  if (pendingChannel) return hasActiveAccount(accounts, pendingChannel);

  // The success redirect can open in another tab or after browser storage was
  // cleared. Accounts returned by this endpoint are already scoped to the
  // authenticated organization, so any active account proves the callback won
  // the redirect race without relying on local-only state.
  return accounts.some((account) => account.status === "active");
}

export default function Channels() {
  useLayoutEffect(() => {
    applyStoredTheme();
  }, []);

  const router = useRouter();
  const searchParams = useSearchParams();
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [activationPendingChannelKey, setActivationPendingChannelKey] = useState<string | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recommendedChannels, setRecommendedChannels] = useState<Set<ChannelRecommendationKey>>(
    new Set(),
  );
  const [purchasedChannels, setPurchasedChannels] = useState<Set<ChannelRecommendationKey>>(
    new Set(),
  );
  const [isPlanLoading, setIsPlanLoading] = useState(true);
  const [selectedLinkedInAccountId, setSelectedLinkedInAccountId] = useState("");
  const connectionFailed = searchParams.get("status") === "failed"
    || Boolean(searchParams.get("error_title"));
  const connectionReturned = searchParams.get("status") === "connected"
    && Boolean(searchParams.get("account_id"));
  const returnedAccountId = searchParams.get("account_id");
  const returnedConnectionToken = searchParams.get("state");

  const loadAccounts = useCallback(async (sync = false, showLoading = true) => {
    if (showLoading) setIsLoading(true);
    try {
      if (sync) {
        await apiFetch("/social-accounts/sync", { method: "POST" });
      }
      const response = await apiFetch<SocialAccountsResponse>("/social-accounts");
      setAccounts(response.accounts);
      setError(null);
      return response.accounts;
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Unable to load connected channels.",
      );
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadAccounts(false);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadAccounts]);

  useEffect(() => {
    const pendingKey = window.localStorage.getItem("lr_pending_channel_key");
    if (pendingKey && CHANNELS.some((channel) => channel.key === pendingKey)) {
      setActivationPendingChannelKey(pendingKey);
    }
  }, []);

  useEffect(() => {
    if (!activationPendingChannelKey) return;

    let cancelled = false;
    let checking = false;

    const checkActivation = async () => {
      if (checking) return;
      checking = true;
      try {
        const nextAccounts = await loadAccounts(false, false);
        if (
          !cancelled &&
          nextAccounts &&
          returnedConnectionIsActive(nextAccounts, activationPendingChannelKey)
        ) {
          window.localStorage.removeItem("lr_pending_channel_key");
          window.localStorage.removeItem("lr_pending_connection_token");
          setActivationPendingChannelKey(null);
          setError(null);
        }
      } finally {
        checking = false;
      }
    };

    void checkActivation();
    const interval = window.setInterval(() => void checkActivation(), 5_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [activationPendingChannelKey, loadAccounts]);

  useEffect(() => {
    if (!connectionReturned) return;
    let cancelled = false;
    const pendingKey = window.localStorage.getItem("lr_pending_channel_key");
    const connectionToken = returnedConnectionToken
      ?? window.localStorage.getItem("lr_pending_connection_token");

    async function pollForConnection() {
      if (returnedAccountId) {
        try {
          await apiFetch("/social-accounts/connect/confirm", {
            method: "POST",
            body: JSON.stringify({
              accountId: returnedAccountId,
              ...(connectionToken && { connectionToken }),
            }),
          });
        } catch {
          // Hosted auth also persists the account through Unipile's webhook.
          // A transient confirmation failure must not hide an account that is
          // already active in the workspace.
        }
      }

      for (let attempt = 0; attempt < 15; attempt += 1) {
        // The hosted-auth webhook owns account creation. Poll our database
        // here instead of repeatedly reconciling the shared Unipile account
        // list while the callback and redirect race each other.
        const nextAccounts = await loadAccounts(false, false);
        if (cancelled) return;
        if (nextAccounts && returnedConnectionIsActive(nextAccounts, pendingKey)) {
          window.localStorage.removeItem("lr_pending_channel_key");
          window.localStorage.removeItem("lr_pending_connection_token");
          setActivationPendingChannelKey(null);
          navigateOnboarding(onboardingHref("channels"), true);
          return;
        }
        await new Promise((resolve) => window.setTimeout(resolve, 2_000));
      }
      if (!cancelled) {
        setActivationPendingChannelKey(pendingKey);
        navigateOnboarding(onboardingHref("channels"), true);
      }
    }

    void pollForConnection().catch((pollError: unknown) => {
      if (!cancelled) {
        setError(
          pollError instanceof Error
            ? pollError.message
            : "Unable to confirm the channel connection.",
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, [connectionReturned, loadAccounts, returnedAccountId, returnedConnectionToken, router]);

  useEffect(() => {
    const activeLinkedInAccounts = accounts.filter(
      (account) => account.platform.toLowerCase() === "linkedin" && account.status === "active",
    );
    if (
      activeLinkedInAccounts.length > 0 &&
      !activeLinkedInAccounts.some((account) => account.id === selectedLinkedInAccountId)
    ) {
      setSelectedLinkedInAccountId(activeLinkedInAccounts[0].id);
    }
  }, [accounts, selectedLinkedInAccountId]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { orgId } = await bootstrapCurrentOrganization();
        const strategy = await apiFetch<{ channels: JsonValue }>(`/strategy/${orgId}`);
        if (cancelled) return;
        const recommendations = getChannelRecommendations(strategy.channels);
        const selected = strategy.channels &&
          typeof strategy.channels === "object" &&
          !Array.isArray(strategy.channels) &&
          Array.isArray(strategy.channels.selected)
          ? strategy.channels.selected.filter(
              (value): value is ChannelRecommendationKey =>
                value === "linkedin" ||
                value === "email" ||
                value === "whatsapp" ||
                value === "instagram" ||
                value === "facebook",
            )
          : [];
        setRecommendedChannels(new Set(
          selected.length > 0 ? selected : recommendations.map((item) => item.channel),
        ));
        setPurchasedChannels(new Set(selected));
      } catch (loadError) {
        // "Recommended" tags are a decorative enhancement layered on top of
        // the strategy generated earlier in onboarding - a missing or failed
        // strategy (e.g. 404 before it's generated) should never block the
        // actual channel-connection flow, so this fails silently.
        if (loadError instanceof ApiError && loadError.status === 404) return;
      } finally {
        if (!cancelled) setIsPlanLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleConnect(
    provider: "LINKEDIN" | "WHATSAPP" | "INSTAGRAM" | "MESSENGER" | "GOOGLE" | "OUTLOOK",
    channelKey: string,
  ) {
    if (isConnecting) return;

    setIsConnecting(true);
    setError(null);
    try {
      const result = await apiFetch<{ url: string; connectionToken: string }>("/social-accounts/connect", {
        method: "POST",
        body: JSON.stringify({
          provider,
          returnTo: isOnboardingPreview() ? "preview" : "onboarding",
        }),
      });
      if (isOnboardingDemo()) {
        setActivationPendingChannelKey(channelKey);
        await loadAccounts(false, false);
        setActivationPendingChannelKey(null);
        return;
      }
      window.localStorage.setItem("lr_pending_channel_key", channelKey);
      window.localStorage.setItem("lr_pending_connection_token", result.connectionToken);
      setActivationPendingChannelKey(channelKey);
      window.location.assign(result.url);
    } catch (connectError) {
      setError(
        connectError instanceof Error ? connectError.message : "Unable to start channel connection.",
      );
    } finally {
      setIsConnecting(false);
    }
  }

  async function handleComplete() {
    if (isCompleting) return;

    setIsCompleting(true);
    setError(null);
    try {
      const result = await apiFetch<{
        completed: true;
        campaignId: string;
        launched: boolean;
        reviewRequired: boolean;
        discoveryStatus: "queued" | "running" | "completed" | "failed";
      }>(
        "/onboarding/complete",
        {
          method: "POST",
          body: JSON.stringify(
            selectedLinkedInAccountId ? { socialAccountId: selectedLinkedInAccountId } : {},
          ),
        },
      );
      const params = new URLSearchParams({
        reviewCampaignId: result.campaignId,
      });
      if (isOnboardingPreview()) {
        navigateOnboarding(onboardingHref("channels"), true);
        return;
      }
      if (isOnboardingDemo()) {
        completeStoredDemoSession();
        router.push("/demo/dashboard");
        return;
      }
      router.push(`/dashboard/campaigns?${params.toString()}`);
    } catch (completeError) {
      setError(
        completeError instanceof Error ? completeError.message : "Unable to complete onboarding.",
      );
    } finally {
      setIsCompleting(false);
    }
  }

  const linkedInChannel = CHANNELS[0];
  const linkedInConnected = hasActiveAccount(accounts, linkedInChannel);
  const activeLinkedInAccounts = accounts.filter(
    (account) => account.platform.toLowerCase() === "linkedin" && account.status === "active",
  );

  return (
    <div className="onboarding-page relative flex min-h-dvh w-full flex-col">
      <main className="onboarding-connect-screen mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center px-5 pt-40 pb-44 h-compact:justify-start h-compact:pt-36 lg:pt-34 lg:pb-28">
        <PageHeader
          className="mx-auto"
          title="Connect your channels"
          description="Connect the channels included in your plan. LinkedIn is required for your first campaign."
        />

        {connectionFailed ? (
          <Alert tone="warning" className="mx-auto mt-6 w-full max-w-3xl">The connection was not completed. You can try again whenever you&apos;re ready.</Alert>
        ) : null}
        {connectionReturned ? (
          <Alert tone="success" className="mx-auto mt-6 w-full max-w-3xl" aria-live="polite">Connection request received. We&apos;re checking for the activated account now.</Alert>
        ) : null}
        {activationPendingChannelKey ? (
          <Alert
            tone="info"
            className="fixed top-20 right-4 left-4 z-50 px-3 py-2 text-xs shadow-lg sm:left-auto sm:w-80"
            title="Activating your channel"
            action={
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isLoading}
                onClick={() => void loadAccounts(false)}
              >
                Check now
              </Button>
            }
          >
            We&apos;re checking for the active account automatically. You can continue setup as soon as it appears.
          </Alert>
        ) : null}
        {error ? (
          <Alert tone="error" className="mx-auto mt-6 w-full max-w-3xl">{error}</Alert>
        ) : null}

        <OnboardingCard className="onboarding-connect-card mx-auto mt-8 w-full max-w-3xl overflow-hidden">
          {isLoading || isPlanLoading ? (
            <EmptyState icon={<Loading tone="brand" label="Loading channels" className="-my-5" />} title="Loading channels" role="status" aria-live="polite" />
          ) : (
            <div className="divide-y divide-onboarding-neutral-150 dark:divide-onboarding-neutral-750">
              {CHANNELS.map((channel) => {
                const connected = hasActiveAccount(accounts, channel);
                const connectedAccountName = connected
                  ? findAccountForChannel(accounts, channel)?.accountName
                  : null;
                const isRecommended =
                  channel.recommendationKey !== null &&
                  recommendedChannels.has(channel.recommendationKey);
                const isPurchased =
                  channel.recommendationKey !== null &&
                  purchasedChannels.has(channel.recommendationKey);
                return (
                  <article key={channel.key} className="onboarding-connect-row flex items-center gap-4 px-5 py-5 sm:px-6">
                    <span className={`inline-flex shrink-0 items-center justify-center ${channel.iconClassName}`}>
                      {channel.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-base font-semibold text-onboarding-ink dark:text-onboarding-neutral-0">
                          {channel.title}
                        </h2>
                        {!isPurchased && isRecommended ? (
                          <StatusBadge>Recommended</StatusBadge>
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm text-onboarding-neutral-600 dark:text-onboarding-neutral-400">
                        {connectedAccountName ?? channel.description}
                      </p>
                    </div>
                    {connected ? (
                      <div className="flex shrink-0 items-center gap-2">
                        <StatusBadge tone="success">
                          <Check className="size-3" aria-hidden />
                          Connected
                        </StatusBadge>
                        {isPurchased ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={isConnecting}
                            onClick={() => void handleConnect(channel.provider, channel.key)}
                          >
                            Add another
                          </Button>
                        ) : null}
                      </div>
                    ) : channel.available && isPurchased ? (
                      <Button
                        type="button"
                        variant="brand"
                        size="sm"
                        disabled={isConnecting}
                        onClick={() => void handleConnect(channel.provider, channel.key)}
                      >
                        {isConnecting ? "Opening..." : "Connect"}
                      </Button>
                    ) : channel.available ? (
                      <StatusBadge className="gap-1" aria-label={`${channel.title} is not included in your plan`}>
                        <Lock className="size-3" aria-hidden />
                        Not in plan
                      </StatusBadge>
                    ) : (
                      <StatusBadge>Coming soon</StatusBadge>
                    )}
                  </article>
                );
              })}
            </div>
          )}

          <div className="onboarding-connect-footer flex flex-wrap items-center justify-between gap-3 border-t border-onboarding-neutral-150 px-5 py-4 dark:border-onboarding-neutral-750 sm:px-6">
            <p className="flex items-center gap-2 text-sm text-onboarding-neutral-600 dark:text-onboarding-neutral-400">
              <ShieldCheck className="size-4 text-onboarding-success-500" aria-hidden />
              {linkedInConnected ? "1 required channel connected" : "1 required channel to connect"}
            </p>
            <Button type="button" variant="ghost" size="sm" disabled={isLoading} onClick={() => void loadAccounts(true)}>
              <RefreshCw className="size-4" aria-hidden />
              Refresh
            </Button>
          </div>
        </OnboardingCard>

        {activeLinkedInAccounts.length > 1 ? (
          <label className="mx-auto mt-4 grid w-full max-w-3xl gap-1.5 rounded-onboarding border border-onboarding-neutral-150 bg-card px-5 py-4 text-sm font-medium text-onboarding-ink dark:border-onboarding-neutral-750 dark:bg-onboarding-neutral-850 dark:text-onboarding-neutral-0">
            LinkedIn sender for this campaign
            <select
              className="h-10 rounded-onboarding border border-onboarding-neutral-200 bg-transparent px-3 text-sm font-normal dark:border-onboarding-neutral-650"
              value={selectedLinkedInAccountId}
              onChange={(event) => setSelectedLinkedInAccountId(event.target.value)}
            >
              {activeLinkedInAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.accountName || "LinkedIn account"}
                </option>
              ))}
            </select>
            <span className="text-xs font-normal text-onboarding-neutral-600 dark:text-onboarding-neutral-400">
              Prospect discovery and delivery will use this account.
            </span>
          </label>
        ) : null}

        <p className="onboarding-connect-note mx-auto mt-4 max-w-2xl text-center text-sm leading-6 text-onboarding-neutral-600 dark:text-onboarding-neutral-400">
          Finishing setup creates a campaign draft. You will review the prospects and messages before anything is sent.
        </p>

      </main>

      <ActionBar
        trailing={<Button type="button" variant="primary" disabled={!linkedInConnected || isCompleting} onClick={() => void handleComplete()} className="h-13 px-8 text-base sm:px-10">{isCompleting ? "Preparing review..." : "Finish setup and review"}<ArrowRight className="size-5" aria-hidden /></Button>}
      />
    </div>
  );
}
