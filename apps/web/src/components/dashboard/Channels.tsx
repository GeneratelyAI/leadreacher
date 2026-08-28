"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  Info,
  Link2,
  Loader2,
  MoreVertical,
  Plus,
  RefreshCw,
  Shield,
  Users,
  Zap,
} from "@/components/ui/icons";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ChannelLogo } from "@/components/onboarding/ChannelLogo";
import { channelDisplayName, DashboardChannelLogo } from "@/components/dashboard/ChannelIdentity";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

type ChannelTrend = {
  direction: "up" | "down" | "flat" | "new";
  percent: number | null;
};

type ChannelAccount = {
  id: string;
  platform: string;
  providerType: string | null;
  accountName: string;
  avatarUrl: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  health: "healthy" | "disconnected" | "needs_attention" | string;
  messagesSent: number;
  prospectsReached: number;
  assignedCampaigns: Array<{ id: string; name: string; status: string }>;
  capacity: {
    invites: { limit: number; remaining: number; resetAt: string };
    messages: { limit: number; remaining: number; resetAt: string };
  } | null;
};

type ChannelsSummary = {
  connectedChannels: number;
  healthyPercent: number;
  messagesSent: number;
  prospectsReached: number;
  trends: {
    connectedChannels: ChannelTrend;
    healthyPercent: ChannelTrend;
    messagesSent: ChannelTrend;
    prospectsReached: ChannelTrend;
  };
};

type ChannelsResponse = {
  accounts: ChannelAccount[];
  summary: ChannelsSummary;
  range: { startDate: string; endDate: string };
};

type ConnectProvider = "LINKEDIN" | "WHATSAPP" | "MESSENGER" | "INSTAGRAM" | "GOOGLE" | "OUTLOOK" | "MAIL";

const CONNECT_CHANNEL_OPTIONS: Array<{
  provider: ConnectProvider;
  label: string;
  mark: "linkedin" | "whatsapp" | "instagram" | "gmail" | "outlook";
}> = [
  { provider: "LINKEDIN", label: "LinkedIn", mark: "linkedin" },
  { provider: "WHATSAPP", label: "WhatsApp", mark: "whatsapp" },
  { provider: "INSTAGRAM", label: "Instagram", mark: "instagram" },
  { provider: "GOOGLE", label: "Gmail", mark: "gmail" },
  { provider: "OUTLOOK", label: "Outlook", mark: "outlook" },
];

function ConnectChannelMark({ mark }: { mark: (typeof CONNECT_CHANNEL_OPTIONS)[number]["mark"] }) {
  return <ChannelLogo name={mark === "whatsapp" ? "whatsapp-mark" : mark} className="size-full object-contain" />;
}

const KPI_CARDS: Array<{
  key: keyof Omit<ChannelsSummary, "trends">;
  label: string;
  icon: typeof Link2;
  tone: string;
  format?: "percent";
  fallbackDetail: string;
}> = [
  {
    key: "connectedChannels",
    label: "Connected accounts",
    icon: Link2,
    tone: "text-onboarding-purple-600 dark:text-onboarding-purple-200",
    fallbackDetail: "Accounts ready for outreach",
  },
  {
    key: "healthyPercent",
    label: "Healthy",
    icon: Shield,
    tone: "text-sky-700 dark:text-sky-200",
    format: "percent",
    fallbackDetail: "All channels active",
  },
  {
    key: "messagesSent",
    label: "Messages sent",
    icon: Zap,
    tone: "text-amber-700 dark:text-amber-200",
    fallbackDetail: "Outbound in selected range",
  },
  {
    key: "prospectsReached",
    label: "Prospects reached",
    icon: Users,
    tone: "text-emerald-700 dark:text-emerald-200",
    fallbackDetail: "Distinct people messaged",
  },
];

function formatNumber(value: number): string {
  return new Intl.NumberFormat().format(value);
}

function titleCase(value: string): string {
  return value.replace(/[_-]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function channelName(platform: string): string {
  return channelDisplayName(platform);
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "?";
}

function statusTooltip(account: ChannelAccount): string {
  if (account.status === "active") return "Active: account is healthy";
  if (account.status === "disconnected") return "Disconnected: reconnect to resume sending";
  if (account.status === "reconnecting") return "Reconnecting";
  return "Needs attention: sync or reconnect this account";
}

function TrendLine({ trend, fallback }: { trend?: ChannelTrend; fallback: string }) {
  if (!trend) {
    return <p className="mt-2 text-xs font-medium text-onboarding-neutral-500 dark:text-onboarding-neutral-400">{fallback}</p>;
  }

  if (trend.direction === "flat" && trend.percent === 0 && fallback) {
    return <p className="mt-2 text-xs font-medium text-onboarding-success-500">{fallback}</p>;
  }

  const label =
    trend.direction === "new"
      ? "New this week"
      : trend.direction === "flat"
        ? "No change this week"
        : `${trend.percent ?? 0}% this week`;

  return (
    <p
      className={cn(
        "mt-2 flex items-center gap-1 text-xs font-medium",
        trend.direction === "up" || trend.direction === "new"
          ? "text-onboarding-success-500"
          : trend.direction === "down"
            ? "text-onboarding-error-500"
            : "text-onboarding-neutral-500 dark:text-onboarding-neutral-400",
      )}
    >
      {trend.direction === "up" ? <ArrowUp className="size-3" aria-hidden /> : null}
      {trend.direction === "down" ? <ArrowDown className="size-3" aria-hidden /> : null}
      {label}
    </p>
  );
}

function PlatformMark({ platform }: { platform: string }) {
  return <DashboardChannelLogo platform={platform} className="size-10" />;
}

function ChannelAccountRow({
  account,
  onReconnect,
}: {
  account: ChannelAccount;
  onReconnect: (provider: ConnectProvider) => void;
}) {
  const statusLabel = titleCase(account.status);
  const healthy = account.health === "healthy";
  const platform = account.platform.toLowerCase();
  const reconnectProvider: ConnectProvider =
    platform === "whatsapp"
      ? "WHATSAPP"
      : platform === "facebook" || platform === "messenger"
        ? "MESSENGER"
        : platform === "instagram"
          ? "INSTAGRAM"
          : platform === "email" || platform === "google" || platform === "outlook" || platform === "microsoft" || platform === "imap" || platform === "mail"
            ? account.providerType?.toLowerCase() === "outlook" || account.providerType?.toLowerCase() === "microsoft"
              ? "OUTLOOK"
              : "GOOGLE"
            : "LINKEDIN";

  return (
    <li className="border-b border-border last:border-b-0">
      <div className="grid gap-4 px-4 py-4 sm:px-5 lg:grid-cols-[minmax(0,1.5fr)_repeat(4,minmax(0,0.72fr))_auto] lg:items-center">
        <div className="flex min-w-0 items-center gap-3">
          <PlatformMark platform={account.platform} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate font-semibold text-onboarding-ink dark:text-onboarding-neutral-0">{account.accountName}</p>
              <Badge variant="outline">{channelName(account.platform)}</Badge>
            </div>
            <div className="mt-1 flex min-w-0 items-center gap-2">
              {account.avatarUrl ? (
                <Avatar size="sm">
                  <AvatarImage src={account.avatarUrl} alt="" />
                  <AvatarFallback>{initials(account.accountName)}</AvatarFallback>
                </Avatar>
              ) : null}
              <p className="truncate text-sm text-onboarding-neutral-600 dark:text-onboarding-neutral-400">
                {account.assignedCampaigns.length === 0
                  ? "Not assigned to a campaign"
                  : account.assignedCampaigns.map((campaign) => campaign.name).slice(0, 2).join(" · ")}
              </p>
            </div>
          </div>
        </div>

        <div>
          <p className="text-xs text-muted-foreground">Status</p>
          <Tooltip>
            <TooltipTrigger
              render={
                <span className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-onboarding-ink dark:text-onboarding-neutral-0" />
              }
            >
              <span
                className={cn(
                  "size-2 rounded-full",
                  account.status === "active"
                    ? "bg-onboarding-success-500"
                    : account.status === "disconnected"
                      ? "bg-onboarding-neutral-400"
                      : "bg-onboarding-warning-500",
                )}
                aria-hidden
              />
              {statusLabel}
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={6}>
              {statusTooltip(account)}
            </TooltipContent>
          </Tooltip>
        </div>

        <div>
          <p className="text-xs text-muted-foreground">Campaigns</p>
          <p className="mt-1 text-sm font-medium">{formatNumber(account.assignedCampaigns.length)}</p>
        </div>

        <div>
          <p className="text-xs text-muted-foreground">Campaign messages</p>
          <p className="mt-1 text-sm font-medium">{formatNumber(account.messagesSent)}</p>
        </div>

        <div>
          <p className="text-xs text-muted-foreground">Daily capacity</p>
          {account.capacity ? (
            <div className="mt-1 text-sm font-medium">
              <p>{account.capacity.messages.remaining}/{account.capacity.messages.limit} messages</p>
              <p className="mt-0.5 text-xs font-normal text-muted-foreground">{account.capacity.invites.remaining}/{account.capacity.invites.limit} invites</p>
            </div>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">Provider managed</p>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 lg:justify-end">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 text-sm font-medium",
              healthy ? "text-onboarding-success-500" : "text-onboarding-warning-900 dark:text-onboarding-warning-150",
            )}
          >
            <CheckCircle2 className="size-3.5" aria-hidden />
            {healthy ? "Healthy" : "Needs attention"}
          </span>
          <div className="flex items-center">
            <Button variant="ghost" size="icon" asChild aria-label={`View ${channelName(account.platform)} activity`}>
              <Link href={`/dashboard/activity?channel=${encodeURIComponent(account.platform)}`}>
                <ChevronRight className="size-4" />
              </Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="Channel actions" />}>
                <MoreVertical className="size-4" weight="regular" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onReconnect(reconnectProvider)}>
                  Reconnect
                </DropdownMenuItem>
                <DropdownMenuItem render={<Link href="/dashboard/activity" />}>
                  View activity
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </li>
  );
}

export function Channels() {
  const searchParams = useSearchParams();
  const startDate = searchParams.get("startDate") ?? "";
  const endDate = searchParams.get("endDate") ?? "";
  const connectStatus = searchParams.get("status");

  const [isConnecting, setIsConnecting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    return params.toString();
  }, [endDate, startDate]);
  const channelsQuery = useQuery({
    queryKey: ["dashboard", "channels", queryString],
    queryFn: () => apiFetch<ChannelsResponse>(`/social-accounts${queryString ? `?${queryString}` : ""}`),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
  const syncMutation = useMutation({
    mutationFn: () => apiFetch("/social-accounts/sync", { method: "POST", body: JSON.stringify({}) }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["dashboard", "channels"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard", "chrome"] }),
      ]);
    },
  });
  const syncAccounts = syncMutation.mutate;
  const accounts = channelsQuery.data?.accounts ?? [];
  const summary = channelsQuery.data?.summary ?? null;
  const isLoading = channelsQuery.isLoading && !channelsQuery.data;
  const connectionError = connectStatus === "failed"
    ? "Channel connection failed. Try again."
    : null;
  const syncError = syncMutation.error instanceof Error
    ? syncMutation.error.message
    : syncMutation.isError
      ? "Unable to sync channels."
      : null;
  const error = actionError
    ?? connectionError
    ?? syncError
    ?? (channelsQuery.error instanceof Error ? channelsQuery.error.message : null);
  const notice = syncMutation.isSuccess
    ? "Accounts synced."
    : connectStatus === "connected"
      ? "Connection received. Syncing the account now."
      : null;

  useEffect(() => {
    if (connectStatus === "connected") {
      syncAccounts();
      window.history.replaceState({}, "", "/dashboard/channels");
    }
  }, [connectStatus, syncAccounts]);

  async function connect(provider: ConnectProvider) {
    setIsConnecting(true);
    try {
      const result = await apiFetch<{ url: string }>("/social-accounts/connect", {
        method: "POST",
        body: JSON.stringify({ provider, returnTo: "dashboard" }),
      });
      window.location.assign(result.url);
    } catch (requestError) {
      setActionError(requestError instanceof Error ? requestError.message : "Unable to start channel connection.");
    } finally {
      setIsConnecting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Channels</h1>
          <p className="mt-2 max-w-2xl text-sm text-onboarding-neutral-600 dark:text-onboarding-neutral-400">
            Manage the connected accounts that make approved outreach delivery possible.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => syncAccounts()} disabled={syncMutation.isPending || isLoading}>
            {syncMutation.isPending ? <Loader2 className="animate-spin" /> : <RefreshCw />}
            Sync accounts
          </Button>
          <Button variant="brand" onClick={() => void connect("LINKEDIN")} disabled={isConnecting}>
            {isConnecting ? <Loader2 className="animate-spin" /> : <Plus />}
            Connect Channel
          </Button>
        </div>
      </div>

      {notice ? (
        <div className="rounded-lg border border-onboarding-purple-200 bg-onboarding-purple-50 px-4 py-3 text-sm text-onboarding-purple-700 dark:border-onboarding-purple-400/30 dark:bg-onboarding-purple-500/15 dark:text-onboarding-purple-100">
          {notice}
        </div>
      ) : null}
      {error ? (
        <div
          className="rounded-lg border border-onboarding-error-200 bg-onboarding-error-50 px-4 py-3 text-sm text-onboarding-error-700 dark:border-onboarding-error-500/40 dark:bg-onboarding-error-500/15 dark:text-onboarding-error-100"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {KPI_CARDS.map(({ key, label, icon: Icon, tone, format, fallbackDetail }) => {
          const value = summary?.[key] ?? 0;
          const display = format === "percent" ? `${value}%` : formatNumber(value);
          return (
            <Card key={key}>
              <CardContent className="flex items-center gap-3.5 p-4 sm:gap-4 sm:p-5">
                <Icon
                  className={cn("size-5 shrink-0 sm:size-6", tone)}
                  strokeWidth={1.75}
                  aria-hidden
                />
                <div className="min-w-0">
                  <p className="text-2xl font-semibold tracking-tight">{display}</p>
                  <p className="mt-1 text-sm text-onboarding-neutral-600 dark:text-onboarding-neutral-400">{label}</p>
                  <TrendLine
                    trend={summary?.trends[key]}
                    fallback={key === "healthyPercent" && value === 100 ? "All channels active" : fallbackDetail}
                  />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <Card className="overflow-hidden">
        <div className="border-b border-border px-4 py-3 sm:px-5">
          <h2 className="font-semibold">Your channels</h2>
        </div>

        {isLoading ? (
          <div className="flex min-h-44 items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 size-4 animate-spin" /> Loading channels
          </div>
        ) : accounts.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <Link2 className="mx-auto size-8 text-muted-foreground" />
            <h3 className="mt-3 font-semibold">No channels connected</h3>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              Connect LinkedIn to make the first outreach channel available. Connecting an account does not send outreach.
            </p>
            <Button className="mt-4" variant="brand" onClick={() => void connect("LINKEDIN")} disabled={isConnecting}>
              <Plus /> Connect LinkedIn
            </Button>
          </div>
        ) : (
          <ul>
            {accounts.map((account) => (
              <ChannelAccountRow key={account.id} account={account} onReconnect={(provider) => void connect(provider)} />
            ))}
          </ul>
        )}

        <div className="border-t border-dashed border-border px-4 py-8 sm:px-5">
          <div className="mx-auto flex max-w-xl flex-col items-center text-center">
            <span className="inline-flex size-10 items-center justify-center text-onboarding-purple-600 dark:text-onboarding-purple-200">
              <Plus className="size-6" strokeWidth={1.75} aria-hidden />
            </span>
            <h3 className="mt-3 font-semibold">Connect a new channel</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Add more channels to expand your outreach capabilities.
            </p>
            <div className="mt-5 flex items-center justify-center gap-3 sm:gap-4">
              {CONNECT_CHANNEL_OPTIONS.map((option) => (
                <Tooltip key={option.provider}>
                  <TooltipTrigger
                    render={
                      <button
                        type="button"
                        aria-label={`Connect ${option.label}`}
                        disabled={isConnecting}
                        onClick={() => void connect(option.provider)}
                        className="inline-flex size-11 items-center justify-center rounded-2xl transition hover:-translate-y-0.5 hover:scale-105 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-onboarding-purple-300 disabled:opacity-50 sm:size-12"
                      />
                    }
                  >
                    <span className={cn("block size-full", option.mark === "whatsapp" && "scale-[1.12]")}>
                      <ConnectChannelMark mark={option.mark} />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={8}>
                    {option.label}
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <div className="flex flex-col gap-2 rounded-xl border border-onboarding-purple-200 bg-onboarding-purple-50 px-4 py-3 text-sm text-onboarding-purple-800 sm:flex-row sm:items-center sm:justify-between dark:border-onboarding-purple-400/30 dark:bg-onboarding-purple-500/15 dark:text-onboarding-purple-100">
        <p className="inline-flex items-start gap-2 sm:items-center">
          <Info className="mt-0.5 size-4 shrink-0 text-onboarding-purple-600 dark:text-onboarding-purple-300 sm:mt-0" aria-hidden />
          All messages are sent only after your explicit approval and follow platform guidelines.
        </p>
        <Link
          href="/dashboard/settings"
          className="inline-flex shrink-0 items-center gap-1 font-medium underline-offset-4 hover:underline"
        >
          View channel safety guidelines
          <ExternalLink className="size-3.5" aria-hidden />
        </Link>
      </div>
    </div>
  );
}
