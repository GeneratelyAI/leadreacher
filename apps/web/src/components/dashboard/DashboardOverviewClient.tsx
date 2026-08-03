"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  BarChart3,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Clock3,
  LayoutDashboard,
  Link2,
  Loader2,
  Megaphone,
  MessageSquare,
  Plus,
  Send,
  TrendingUp,
  Users,
} from "lucide-react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChannelLogo } from "@/components/onboarding/ChannelLogo";
import { CampaignVideoView, type CampaignVideoSummary } from "@/components/dashboard/CampaignVideoView";
import { DashboardPageFrame } from "@/components/dashboard/DashboardPageFrame";
import { LiveActivityTable } from "@/components/dashboard/LiveActivityTable";
import {
  OverviewChannelUpsellCarousel,
  OverviewInsightCarousel,
} from "@/components/dashboard/OverviewInsightCarousel";
import { Button } from "@/components/ui/Button";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { ApiError, apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

type EngineStatus = "running" | "ready" | "needs_attention";

type DashboardOverview = {
  organization: {
    name: string;
    plan: string;
    subscriptionStatus: string | null;
    hasBillingPortal: boolean;
  };
  engine: {
    status: EngineStatus;
    label: string;
    detail: string;
  };
  metrics: {
    prospects: number;
    outreachInProgress: number;
    replies: number;
    meetingsBooked: number;
    outreachSent: number;
    customers?: number;
  };
  trends?: Partial<Record<keyof DashboardOverview["metrics"], { direction: "up" | "down" | "flat" | "new"; percent: number | null }>>;
  activityTrend?: Array<{ date: string; sent: number; replies: number }>;
  dateRange?: { startDate: string; endDate: string };
  unreadNotificationCount?: number;
  aiOptimizationActive?: boolean;
  primaryCampaign: {
    id: string;
    name: string;
    status: string;
    channels: string[];
    prospectCount: number;
    createdAt: string;
    updatedAt: string;
    startedAt: string;
    stats?: { prospects: number; contacted: number; replies: number; meetings: number; customers: number };
    channelSendCounts?: Record<string, number>;
    video?: CampaignVideoSummary | null;
  } | null;
  channels: Array<{
    id: string;
    platform: string;
    accountName: string;
    avatarUrl: string | null;
    status: string;
  }>;
  attention: Array<{
    kind: "billing" | "channels" | "campaign" | "video";
    title: string;
    detail: string;
  }>;
  activity: Array<{
    id: string;
    kind: "message" | "prospect" | "video" | "campaign";
    title: string;
    detail: string;
    occurredAt: string;
    avatarUrl?: string | null;
    channel?: string;
    action?: "reply" | "view";
    href?: string;
  }>;
  actions?: {
    needsReply: Array<{
      campaignLeadId: string;
      prospectName: string;
      company: string | null;
      avatarUrl: string | null;
      campaignName: string;
      preview: string;
      occurredAt: string;
    }>;
    needsReplyCount: number;
    reconnectAccounts: Array<{
      id: string;
      platform: string;
      accountName: string;
      status: string;
    }>;
    failedSends: Array<{
      id: string;
      kind: "automation" | "operator";
      state: string;
      campaignLeadId: string;
      campaignName: string;
      prospectName: string;
      occurredAt: string;
    }>;
    failedSendCount: number;
    stalled: Array<{
      campaignLeadId: string;
      campaignId: string;
      campaignName: string;
      prospectName: string;
      company: string | null;
      currentStep: number;
      waitingSince: string;
    }>;
    stalledCount: number;
  };
  sendingHealth?: {
    senders: Array<{
      id: string;
      accountName: string;
      status: string;
      invite: { limit: number; remaining: number; resetAt: string };
      message: { limit: number; remaining: number; resetAt: string };
    }>;
    unhealthyAccounts: Array<{
      id: string;
      platform: string;
      accountName: string;
      status: string;
    }>;
    failedSendCount: number;
    pendingInviteAcceptances: number;
  };
};

type AnalyticsInsights = {
  status: "ready" | "aggregating" | "no_data";
  whatsWorking: Array<{ campaignId: string; campaignName: string; text: string }>;
  whatsNotWorking: Array<{ campaignId: string; campaignName: string; text: string }>;
  whatToDoNext: Array<{
    campaignId: string;
    campaignName: string;
    action: string;
    reason: string;
    priority: 1 | 2 | 3;
  }>;
};

type RecommendationItem = {
  title: string;
  detail: string;
  href: string;
  source: "ai" | "ops";
};

function buildOperationalRecommendations(overview: DashboardOverview | null): RecommendationItem[] {
  if (!overview) return [];
  const items: RecommendationItem[] = [];
  const actions = overview.actions;

  if (actions) {
    if (actions.needsReplyCount > 0) {
      items.push({
        title: `Reply to ${actions.needsReplyCount} conversation${actions.needsReplyCount === 1 ? "" : "s"}`,
        detail: actions.needsReply[0]
          ? `${actions.needsReply[0].prospectName}: ${actions.needsReply[0].preview}`
          : "Inbound replies are waiting in Messages.",
        href: "/dashboard/messages?state=needs_reply",
        source: "ops",
      });
    }
    if (actions.reconnectAccounts.length > 0) {
      const account = actions.reconnectAccounts[0]!;
      items.push({
        title: `Reconnect ${account.accountName}`,
        detail: `${titleCase(account.platform)} is ${account.status}. Outreach pauses until the channel is healthy.`,
        href: "/dashboard/channels",
        source: "ops",
      });
    }
    if (actions.failedSendCount > 0) {
      items.push({
        title: `Review ${actions.failedSendCount} failed send${actions.failedSendCount === 1 ? "" : "s"}`,
        detail: actions.failedSends[0]
          ? `${actions.failedSends[0].prospectName} · ${actions.failedSends[0].campaignName}`
          : "Delivery attempts failed or stayed unknown in the last 48 hours.",
        href: "/dashboard/activity",
        source: "ops",
      });
    }
    if (actions.stalledCount > 0 && items.length < 3) {
      items.push({
        title: `${actions.stalledCount} invite${actions.stalledCount === 1 ? "" : "s"} awaiting acceptance`,
        detail: actions.stalled[0]
          ? `${actions.stalled[0].prospectName} in ${actions.stalled[0].campaignName}`
          : "Prospects were contacted and are still waiting to connect.",
        href: "/dashboard/prospects",
        source: "ops",
      });
    }
  }

  if (items.length === 0) {
    for (const item of overview.attention.slice(0, 3)) {
      const href =
        item.kind === "channels"
          ? "/dashboard/channels"
          : item.kind === "campaign"
            ? "/dashboard/campaigns"
            : item.kind === "billing"
              ? "/dashboard/settings"
              : "/dashboard/campaigns";
      items.push({ title: item.title, detail: item.detail, href, source: "ops" });
    }
  }

  if (items.length === 0 && !overview.primaryCampaign) {
    items.push({
      title: "Create your first campaign",
      detail: "Draft a sequence, add prospects, then launch outreach.",
      href: "/dashboard/campaigns",
      source: "ops",
    });
  }

  return items.slice(0, 3);
}

function buildRecommendationItems(
  overview: DashboardOverview | null,
  insights: AnalyticsInsights | null,
): RecommendationItem[] {
  if (insights?.status === "ready" && insights.whatToDoNext.length > 0) {
    return insights.whatToDoNext.slice(0, 3).map((item) => ({
      title: item.action,
      detail: item.reason,
      href: `/dashboard/analytics?campaignId=${encodeURIComponent(item.campaignId)}`,
      source: "ai" as const,
    }));
  }
  return buildOperationalRecommendations(overview);
}

const METRICS: Array<{
  key: keyof DashboardOverview["metrics"];
  label: string;
}> = [
  { key: "prospects", label: "Prospects" },
  { key: "outreachInProgress", label: "Outreach in progress" },
  { key: "replies", label: "Replies" },
  { key: "meetingsBooked", label: "Meetings booked" },
];

function isChannelLogoName(value: string): value is "linkedin" | "whatsapp" {
  return value === "linkedin" || value === "whatsapp";
}

function TodayActionsPanel({ overview }: { overview: DashboardOverview }) {
  const actions = overview.actions;
  if (!actions) return null;

  const cards: Array<{
    key: string;
    title: string;
    detail: string;
    href: string;
    count: number;
  }> = [];

  if (actions.needsReplyCount > 0) {
    cards.push({
      key: "needs-reply",
      title: `${actions.needsReplyCount} need${actions.needsReplyCount === 1 ? "s" : ""} a reply`,
      detail: actions.needsReply[0]
        ? `${actions.needsReply[0].prospectName}: ${actions.needsReply[0].preview}`
        : "Open the inbox and clear inbound replies.",
      href: "/dashboard/messages?state=needs_reply",
      count: actions.needsReplyCount,
    });
  }
  if (actions.reconnectAccounts.length > 0) {
    cards.push({
      key: "reconnect",
      title: `${actions.reconnectAccounts.length} channel${actions.reconnectAccounts.length === 1 ? "" : "s"} need reconnect`,
      detail: actions.reconnectAccounts
        .slice(0, 2)
        .map((account) => `${account.accountName} (${account.status})`)
        .join(" · "),
      href: "/dashboard/channels",
      count: actions.reconnectAccounts.length,
    });
  }
  if (actions.failedSendCount > 0) {
    cards.push({
      key: "failed",
      title: `${actions.failedSendCount} failed or unknown send${actions.failedSendCount === 1 ? "" : "s"}`,
      detail: actions.failedSends[0]
        ? `${actions.failedSends[0].prospectName} · ${actions.failedSends[0].campaignName}`
        : "Review delivery issues from the last 48 hours.",
      href: "/dashboard/activity",
      count: actions.failedSendCount,
    });
  }
  if (actions.stalledCount > 0) {
    cards.push({
      key: "stalled",
      title: `${actions.stalledCount} waiting on invite acceptance`,
      detail: actions.stalled[0]
        ? `${actions.stalled[0].prospectName} in ${actions.stalled[0].campaignName}`
        : "Prospects contacted and still waiting to connect.",
      href: "/dashboard/prospects",
      count: actions.stalledCount,
    });
  }

  return (
    <section
      className="shrink-0 overflow-hidden rounded-onboarding border border-onboarding-neutral-150 bg-onboarding-neutral-0 shadow-onboarding-small dark:border-onboarding-neutral-750 dark:bg-onboarding-neutral-900"
      aria-labelledby="today-heading"
    >
      <div className="flex items-center justify-between gap-3 border-b border-onboarding-neutral-150 px-5 py-3 dark:border-onboarding-neutral-750 sm:px-6">
        <div>
          <h2 id="today-heading" className="text-sm font-semibold tracking-tight">
            Hotlist
          </h2>
          <p className="text-xs text-muted-foreground">Your latest activity updates</p>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link href="/dashboard/messages?state=needs_reply">
            <MessageSquare className="size-3.5" aria-hidden />
            Inbox
          </Link>
        </Button>
      </div>
      {cards.length === 0 ? (
        <div className="flex items-start gap-3 px-5 py-4 sm:px-6">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-onboarding-success-500" aria-hidden />
          <div>
            <p className="text-sm font-medium">You&apos;re clear for now</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              No replies waiting, channels are healthy, and nothing is stalled.
            </p>
          </div>
        </div>
      ) : (
        <ul className="divide-y divide-onboarding-neutral-150 dark:divide-onboarding-neutral-750">
          {cards.map((card) => (
            <li key={card.key}>
              <Link
                href={card.href}
                className="flex items-start justify-between gap-3 px-5 py-3.5 transition-colors hover:bg-app-hover sm:px-6"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{card.title}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{card.detail}</p>
                </div>
                <ArrowRight className="mt-1 size-4 shrink-0 text-onboarding-purple-600 dark:text-onboarding-purple-200" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function SendingHealthStrip({ overview }: { overview: DashboardOverview }) {
  const health = overview.sendingHealth;
  if (!health) return null;

  const primarySender = health.senders[0];

  return (
    <section
      className="overflow-hidden rounded-onboarding border border-onboarding-neutral-150 bg-onboarding-neutral-0 shadow-onboarding-small dark:border-onboarding-neutral-750 dark:bg-onboarding-neutral-900"
      aria-label="Sending health"
    >
      <div className="px-4 py-3">
        <h2 className="text-sm font-semibold">Sending health</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">Daily capacity and delivery status</p>
      </div>
      <div className="relative grid grid-cols-2 px-2 pb-2 before:absolute before:top-0 before:right-4 before:left-4 before:h-px before:bg-onboarding-neutral-150 dark:before:bg-onboarding-neutral-750">
        {[
          {
            label: "Messages left",
            value: primarySender ? `${primarySender.message.remaining}/${primarySender.message.limit}` : "—",
            detail: primarySender?.accountName ?? "No sender",
          },
          {
            label: "Invites left",
            value: primarySender ? `${primarySender.invite.remaining}/${primarySender.invite.limit}` : "—",
            detail: "Resets daily (UTC)",
          },
          {
            label: "Awaiting accept",
            value: String(health.pendingInviteAcceptances),
            detail: "Not connected",
          },
          {
            label: "Health flags",
            value: String(health.unhealthyAccounts.length + health.failedSendCount),
            detail: health.unhealthyAccounts.length > 0 ? "Reconnect channels" : health.failedSendCount > 0 ? "Review failed sends" : "All clear",
          },
        ].map((item, index) => (
          <div
            key={item.label}
            className={cn(
              "relative min-w-0 px-2 py-3",
              index % 2 === 0 && "after:absolute after:inset-y-3 after:right-0 after:w-px after:bg-onboarding-neutral-150 dark:after:bg-onboarding-neutral-750",
              index < 2 && "before:absolute before:right-2 before:bottom-0 before:left-2 before:h-px before:bg-onboarding-neutral-150 dark:before:bg-onboarding-neutral-750",
            )}
          >
            <p className="truncate text-[10px] font-semibold tracking-[0.07em] text-muted-foreground uppercase">{item.label}</p>
            <p className="mt-1 text-lg font-semibold leading-none">{item.value}</p>
            {item.label === "Health flags" && health.unhealthyAccounts.length > 0 ? (
              <Link href="/dashboard/channels" className="mt-1 block truncate text-[11px] font-medium text-onboarding-purple-600 hover:underline dark:text-onboarding-purple-200">
                {item.detail}
              </Link>
            ) : item.label === "Health flags" && health.failedSendCount > 0 ? (
              <Link href="/dashboard/activity" className="mt-1 block truncate text-[11px] font-medium text-onboarding-purple-600 hover:underline dark:text-onboarding-purple-200">
                {item.detail}
              </Link>
            ) : (
              <p className="mt-1 truncate text-[11px] text-muted-foreground">{item.detail}</p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function DashboardChannelMark({
  name,
  size = "default",
  className,
}: {
  name: "linkedin" | "whatsapp";
  size?: "default" | "small" | "badge";
  className?: string;
}) {
  if (name === "linkedin") {
    return (
      <span
        className={cn(
          "inline-flex shrink-0 items-center justify-center",
          size === "badge" ? "size-4" : size === "small" ? "size-5" : "size-8",
          className,
        )}
        aria-hidden
      >
        <ChannelLogo name="linkedin" className="size-full" />
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-[0.3rem] bg-[#25D366] text-white",
        size === "badge" ? "size-4" : size === "small" ? "size-5" : "size-8",
        className,
      )}
      aria-hidden
    >
      <ChannelLogo name="whatsapp" className={size === "badge" ? "size-2.5" : size === "small" ? "size-3" : "size-[62%]"} />
    </span>
  );
}

function titleCase(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat().format(value);
}

function relativeTime(value: string): string {
  const elapsed = Date.now() - new Date(value).getTime();
  const minutes = Math.max(0, Math.round(elapsed / 60_000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function MetricCell({
  value,
  label,
  trend,
}: {
  value: number;
  label: string;
  trend?: NonNullable<DashboardOverview["trends"]>[keyof NonNullable<DashboardOverview["trends"]>];
}) {
  return (
    <div className="flex min-h-full min-w-0 flex-col items-center justify-center px-5 py-1.5 text-center sm:px-6 sm:py-2">
      <p className="text-2xl font-semibold tracking-tight sm:text-[1.75rem]">{formatNumber(value)}</p>
      <p className="mt-1 text-sm text-onboarding-neutral-600 dark:text-onboarding-neutral-400">{label}</p>
      {trend ? (
        <p className={cn(
          "mt-1 flex items-center justify-center gap-1 text-xs font-medium",
          trend.direction === "up" || trend.direction === "new"
            ? "text-onboarding-success-500"
            : trend.direction === "down"
              ? "text-onboarding-error-500"
              : "text-onboarding-neutral-500 dark:text-onboarding-neutral-400",
        )}>
          {trend.direction === "up" ? <ArrowUp className="size-3" aria-hidden /> : trend.direction === "down" ? <ArrowDown className="size-3" aria-hidden /> : null}
          {trend.direction === "new"
            ? "New activity this period"
            : trend.direction === "flat"
              ? "No change this period"
              : `${trend.percent ?? 0}% this period`}
        </p>
      ) : null}
    </div>
  );
}

function ProgressStage({
  label,
  complete,
  active,
  detail,
  index,
}: {
  label: string;
  complete: boolean;
  active: boolean;
  detail: string;
  index: number;
}) {
  return (
    <div className="relative flex min-w-0 flex-1 items-start gap-3 text-left sm:flex-col sm:items-center sm:text-center">
      <span
        className={cn(
          "relative z-10 inline-flex size-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold sm:size-7",
          complete
            ? "border-onboarding-purple-500 bg-onboarding-purple-500 text-white"
            : active
              ? "border-onboarding-purple-500 bg-onboarding-purple-500 text-white"
            : "border-onboarding-neutral-200 bg-onboarding-neutral-0 text-onboarding-neutral-400 dark:border-onboarding-neutral-700 dark:bg-onboarding-neutral-900",
        )}
      >
        {complete ? <Check className="size-4" strokeWidth={2.5} aria-hidden /> : index + 1}
      </span>
      <div className="min-w-0 flex-1 sm:w-full">
        <span
          className={cn(
            "block text-sm font-medium sm:mt-1.5 sm:truncate sm:text-xs",
            complete || active ? "text-onboarding-ink dark:text-onboarding-neutral-0" : "text-onboarding-neutral-500 dark:text-onboarding-neutral-400",
          )}
        >
          {label}
        </span>
        <span className={cn(
          "mt-0.5 block text-xs sm:truncate",
          active ? "font-medium text-onboarding-purple-600 dark:text-onboarding-purple-200" : "text-onboarding-neutral-500 dark:text-onboarding-neutral-400",
        )}>
          {detail}
        </span>
      </div>
    </div>
  );
}

export function DashboardOverviewClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const overviewQuery = searchParams.toString();
  const { data: overview, error: overviewError, isLoading } = useQuery({
    queryKey: ["dashboard", "overview", overviewQuery],
    queryFn: () => {
      const query = new URLSearchParams();
      const currentParams = new URLSearchParams(overviewQuery);
      const startDate = currentParams.get("startDate");
      const endDate = currentParams.get("endDate");
      const activityKind = currentParams.get("activityKind");
      if (startDate && endDate) {
        query.set("startDate", startDate);
        query.set("endDate", endDate);
      }
      if (activityKind) query.set("activityKind", activityKind);
      return apiFetch<DashboardOverview>(`/dashboard/overview?${query.toString()}`);
    },
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
  const { data: insights } = useQuery({
    queryKey: ["dashboard", "analytics-insights"],
    queryFn: () => apiFetch<AnalyticsInsights>("/dashboard/analytics/insights"),
    staleTime: 30_000,
    refetchInterval: (query) => query.state.data?.status === "aggregating" ? 2_500 : false,
    refetchIntervalInBackground: false,
  });
  const error = overviewError instanceof ApiError && overviewError.status === 401
    ? "Your session has expired. Please sign in again."
    : overviewError instanceof Error
      ? overviewError.message
      : null;

  const recommendationItems = buildRecommendationItems(overview ?? null, insights ?? null);
  const featuredInsight = insights?.status === "ready"
    ? insights.whatToDoNext[0]
      ? { title: insights.whatToDoNext[0].action, detail: insights.whatToDoNext[0].reason }
      : insights.whatsWorking[0]
        ? { title: insights.whatsWorking[0].text, detail: insights.whatsWorking[0].campaignName }
        : recommendationItems[0]
          ? { title: recommendationItems[0].title, detail: recommendationItems[0].detail }
          : null
    : recommendationItems[0]
      ? { title: recommendationItems[0].title, detail: recommendationItems[0].detail }
      : null;
  return (
    <DashboardPageFrame className="flex min-w-0 flex-col">
            {error ? (
              <div className="mb-6 flex items-start gap-3 rounded-onboarding border border-onboarding-error-500/30 bg-onboarding-error-50 p-4 text-sm text-onboarding-error-900 dark:bg-onboarding-error-900 dark:text-onboarding-error-50" role="alert">
                <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                <div>
                  <p className="font-semibold">Unable to load workspace</p>
                  <p className="mt-1">{error}</p>
                </div>
              </div>
            ) : null}

            <section className="flex shrink-0 flex-col gap-3 pb-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-[1.75rem] font-semibold tracking-tight sm:text-[1.9rem]">Today</h1>
                  {overview ? (
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 text-xs font-semibold",
                        overview.engine.status === "running"
                          ? "text-onboarding-success-500"
                          : overview.engine.status === "needs_attention"
                            ? "text-onboarding-warning-900 dark:text-onboarding-warning-150"
                            : "text-onboarding-purple-600 dark:text-onboarding-purple-200",
                      )}
                    >
                      <span
                        className={cn(
                          "size-1.5 rounded-full",
                          overview.engine.status === "running"
                            ? "bg-onboarding-success-500"
                            : overview.engine.status === "needs_attention"
                              ? "bg-onboarding-warning-500"
                              : "bg-onboarding-purple-500",
                        )}
                        aria-hidden
                      />
                      {overview.engine.label}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 max-w-2xl text-sm text-onboarding-neutral-600 dark:text-onboarding-neutral-400">
                  {overview?.engine.detail ?? "Loading your operational workspace."}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {overview?.trends?.outreachSent ? (
                  <div className="mr-1 inline-flex h-10 items-center gap-2 rounded-onboarding border border-onboarding-neutral-150 bg-onboarding-neutral-0 px-3 text-sm shadow-onboarding-small dark:border-onboarding-neutral-750 dark:bg-onboarding-neutral-900">
                    <TrendingUp className="size-4 text-onboarding-purple-600 dark:text-onboarding-purple-200" aria-hidden />
                    <strong>{overview.trends.outreachSent.direction === "new" ? "New" : `${overview.trends.outreachSent.percent ?? 0}%`}</strong>
                    <span className="text-onboarding-neutral-500 dark:text-onboarding-neutral-400">vs prior period</span>
                  </div>
                ) : null}
                <Button asChild variant="brand">
                  <Link href="/dashboard/campaigns">
                    <Plus aria-hidden />
                    New campaign
                  </Link>
                </Button>
              </div>
            </section>

            {isLoading && !overview ? (
              <div className="flex min-h-96 items-center justify-center text-sm text-onboarding-neutral-600 dark:text-onboarding-neutral-400">
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden /> Loading workspace
              </div>
            ) : overview ? (
              <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_20rem] 2xl:grid-cols-[minmax(0,1fr)_23rem]">
                <div className="order-1 flex min-h-0 min-w-0 flex-col gap-4">
                  <TodayActionsPanel overview={overview} />

                  <section className="shrink-0 overflow-hidden rounded-onboarding border border-onboarding-neutral-150 bg-onboarding-neutral-0 shadow-onboarding-small dark:border-onboarding-neutral-750 dark:bg-onboarding-neutral-900" aria-label="Campaign metrics">
                    <div className="flex items-center justify-end px-5 pt-2 pb-0 sm:px-6">
                      <Link href="/dashboard/analytics" className="inline-flex items-center gap-1 text-xs font-semibold text-onboarding-purple-600 transition-colors hover:text-onboarding-purple-700 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-onboarding-purple-300 dark:text-onboarding-purple-200">
                        View analytics <ArrowRight className="size-3" aria-hidden />
                      </Link>
                    </div>
                    <div className="grid min-h-[10rem] grid-cols-2 sm:grid-cols-4">
                      {METRICS.map(({ key, label }, index) => (
                        <div
                          key={key}
                          className={cn(
                            "border-b border-onboarding-neutral-150 last:border-b-0 dark:border-onboarding-neutral-750 sm:border-b-0 sm:relative sm:border-r-0 sm:after:absolute sm:after:inset-y-4 sm:after:right-0 sm:after:w-px sm:after:bg-onboarding-neutral-150 sm:last:after:hidden dark:sm:after:bg-onboarding-neutral-750",
                            index >= 2 && "border-b-0",
                          )}
                        >
                          <MetricCell value={overview.metrics[key] ?? 0} label={label} trend={overview.trends?.[key]} />
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[0.4rem] border border-onboarding-neutral-150 bg-onboarding-neutral-0 shadow-onboarding-small lg:min-h-[32rem] dark:border-onboarding-neutral-750 dark:bg-onboarding-neutral-900" aria-labelledby="primary-campaign-heading">
                    <div className="grid lg:min-h-[11rem] lg:grid-cols-[minmax(0,1.15fr)_minmax(14rem,1fr)_minmax(10.5rem,0.7fr)]">
                      <div className="flex flex-col justify-center p-4 sm:p-5 2xl:p-7 lg:relative lg:after:absolute lg:after:inset-y-5 lg:after:right-0 lg:after:w-px lg:after:bg-onboarding-neutral-150 dark:lg:after:bg-onboarding-neutral-750">
                        <p className="text-[11px] font-semibold tracking-[0.08em] text-onboarding-neutral-500 uppercase dark:text-onboarding-neutral-400">Active campaign</p>
                        <h2 id="primary-campaign-heading" className="mt-2 text-xl font-semibold tracking-tight 2xl:text-2xl">
                          {overview.primaryCampaign?.name ?? "Campaign ready to launch"}
                        </h2>
                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
                          <span className={cn(
                            "inline-flex items-center gap-2 text-sm font-medium",
                            overview.primaryCampaign?.status === "active" ? "text-onboarding-success-500" : "text-onboarding-purple-600 dark:text-onboarding-purple-200",
                          )}>
                            <span className={cn("size-2 rounded-full", overview.primaryCampaign?.status === "active" ? "bg-onboarding-success-500" : "bg-onboarding-purple-500")} aria-hidden />
                            {overview.primaryCampaign ? titleCase(overview.primaryCampaign.status) : "Ready"}
                          </span>
                          {overview.primaryCampaign ? <span className="text-sm text-onboarding-neutral-600 dark:text-onboarding-neutral-400">Started {formatDate(overview.primaryCampaign.startedAt)}</span> : null}
                          <span className="inline-flex items-center gap-2 text-xs">
                            <span className="font-medium text-onboarding-neutral-500 dark:text-onboarding-neutral-400">Using</span>
                            {overview.primaryCampaign?.channels.length ? overview.primaryCampaign.channels.map((channel) => (
                              <span key={channel} className="inline-flex items-center gap-1.5 font-semibold">
                                {isChannelLogoName(channel) ? <DashboardChannelMark name={channel} size="small" /> : <Link2 className="size-3.5 text-onboarding-purple-600" aria-hidden />}
                                {titleCase(channel)}
                              </span>
                            )) : <span className="text-onboarding-neutral-500 dark:text-onboarding-neutral-400">No campaign channel selected</span>}
                          </span>
                        </div>
                      </div>

                      <div className="relative flex flex-col justify-center p-4 before:absolute before:top-0 before:right-4 before:left-4 before:h-px before:bg-onboarding-neutral-150 dark:before:bg-onboarding-neutral-750 sm:p-5 lg:before:hidden lg:after:absolute lg:after:inset-y-5 lg:after:left-0 lg:after:w-px lg:after:bg-onboarding-neutral-150 dark:lg:after:bg-onboarding-neutral-750">
                        {overview.primaryCampaign ? (
                          <CampaignVideoView
                            campaignId={overview.primaryCampaign.id}
                            video={overview.primaryCampaign.video}
                            onVideoChange={(next) => {
                              queryClient.setQueryData<DashboardOverview>(["dashboard", "overview", overviewQuery], (current) => {
                                if (!current?.primaryCampaign) return current;
                                return {
                                  ...current,
                                  primaryCampaign: {
                                    ...current.primaryCampaign,
                                    video: next,
                                  },
                                };
                              });
                            }}
                          />
                        ) : (
                          <CampaignVideoView campaignId="" video={null} />
                        )}
                      </div>

                      <div className="relative flex flex-col justify-center p-4 before:absolute before:top-0 before:right-4 before:left-4 before:h-px before:bg-onboarding-neutral-150 dark:before:bg-onboarding-neutral-750 sm:p-5 lg:before:hidden lg:after:absolute lg:after:inset-y-5 lg:after:left-0 lg:after:w-px lg:after:bg-onboarding-neutral-150 dark:lg:after:bg-onboarding-neutral-750">
                        <p className="text-base font-medium text-onboarding-ink dark:text-onboarding-neutral-0">Channels Active</p>
                        <div className="mt-4 space-y-3">
                          {overview.channels.filter((channel) => channel.status === "active").slice(0, 3).map((channel) => (
                            <div key={channel.id} className="flex items-center gap-2.5">
                              {isChannelLogoName(channel.platform) ? <DashboardChannelMark name={channel.platform} /> : <Link2 className="size-5 text-onboarding-purple-600" aria-hidden />}
                              <span className="min-w-0 flex-1 truncate text-sm font-medium">{titleCase(channel.platform)}</span>
                              <span className="inline-flex shrink-0 rounded bg-onboarding-success-50 px-2 py-1 text-xs font-semibold text-onboarding-success-700 dark:bg-onboarding-success-900/50 dark:text-onboarding-success-200">{formatNumber(overview.primaryCampaign?.channelSendCounts?.[channel.platform.toLowerCase()] ?? 0)} sent</span>
                            </div>
                          ))}
                          {overview.channels.every((channel) => channel.status !== "active") ? <p className="text-xs leading-5 text-onboarding-neutral-500 dark:text-onboarding-neutral-400">Connect a channel before launch.</p> : null}
                        </div>
                      </div>
                    </div>

                    <div className="relative grid grid-cols-2 gap-0 p-4 before:absolute before:top-0 before:right-4 before:left-4 before:h-px before:bg-onboarding-neutral-150 dark:before:bg-onboarding-neutral-750 sm:grid-cols-3 sm:p-5 lg:grid-cols-5">
                      {[
                        { label: "Prospects", value: overview.primaryCampaign?.stats?.prospects ?? overview.primaryCampaign?.prospectCount ?? 0, icon: Users },
                        { label: "Contacted", value: overview.primaryCampaign?.stats?.contacted ?? 0, icon: Send },
                        { label: "Replies", value: overview.primaryCampaign?.stats?.replies ?? 0, icon: MessageSquare },
                        { label: "Meetings", value: overview.primaryCampaign?.stats?.meetings ?? 0, icon: CalendarDays },
                        { label: "Customers", value: overview.primaryCampaign?.stats?.customers ?? 0, icon: CheckCircle2 },
                      ].map(({ label, value, icon: Icon }) => (
                        <div key={label} className="relative flex min-w-0 items-center gap-2.5 px-3 py-2.5 first:pl-0 last:pr-0 lg:after:absolute lg:after:inset-y-2.5 lg:after:right-0 lg:after:w-px lg:after:bg-onboarding-neutral-150 lg:last:after:hidden dark:lg:after:bg-onboarding-neutral-750">
                          <Icon className="size-5 shrink-0 text-onboarding-purple-600 dark:text-onboarding-purple-200" strokeWidth={1.75} aria-hidden />
                          <div>
                            <p className="text-lg font-semibold leading-none">{formatNumber(value)}</p>
                            <p className="mt-1 text-xs text-onboarding-neutral-500 dark:text-onboarding-neutral-400">{label}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="relative flex min-h-[7.5rem] flex-1 items-center px-4 pt-6 pb-5 before:absolute before:top-0 before:right-4 before:left-4 before:h-px before:bg-onboarding-neutral-150 dark:before:bg-onboarding-neutral-750 sm:px-5 2xl:px-7">
                      <div className="relative flex w-full flex-col gap-4 sm:flex-row sm:gap-0">
                        {(() => {
                          const campaign = overview.primaryCampaign;
                          const prospectCount = campaign?.stats?.prospects ?? campaign?.prospectCount ?? 0;
                          const currentStage = !campaign
                            ? 0
                            : campaign.status === "completed"
                              ? 4
                              : campaign.status === "active"
                                ? prospectCount > 0
                                  ? 2
                                  : 1
                                : prospectCount > 0
                                  ? 1
                                  : 0;
                          const stages = [
                            { label: "Setup", detail: overview.primaryCampaign ? "Complete" : "Not started" },
                            { label: "Prospects Added", detail: overview.primaryCampaign?.prospectCount ? `Complete · ${formatNumber(overview.primaryCampaign.prospectCount)} added` : "Not started" },
                            { label: "Outreach Running", detail: overview.primaryCampaign?.status === "active" ? "In progress" : "Not started" },
                            { label: "Meetings Booked", detail: overview.primaryCampaign?.stats?.meetings ? `${formatNumber(overview.primaryCampaign.stats.meetings)} booked` : "Not started" },
                          ];
                          const activeIndex = Math.min(currentStage, stages.length - 1);
                          return (
                            <>
                              <span className="absolute top-3.5 left-[12.5%] hidden w-[75%] border-t-2 border-onboarding-neutral-200 sm:block dark:border-onboarding-neutral-700" aria-hidden />
                              <span className="absolute top-3.5 left-[12.5%] hidden border-t-2 border-onboarding-purple-500 sm:block" style={{ width: `${(activeIndex / (stages.length - 1)) * 75}%` }} aria-hidden />
                              {stages.map((stage, index) => (
                                <ProgressStage key={stage.label} label={stage.label} detail={stage.detail} complete={index < currentStage || currentStage === stages.length} active={index === activeIndex && currentStage < stages.length} index={index} />
                              ))}
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  </section>

                </div>

                <section className="order-4 min-w-0 overflow-hidden rounded-onboarding border border-onboarding-neutral-150 bg-onboarding-neutral-0 shadow-onboarding-small xl:col-span-2 xl:row-start-3 dark:border-onboarding-neutral-750 dark:bg-onboarding-neutral-900" aria-labelledby="activity-heading">
                    <div className="flex flex-col gap-3 border-b border-onboarding-neutral-150 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5 dark:border-onboarding-neutral-750">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <h2 id="activity-heading" className="font-semibold">Live activity</h2>
                        <span className="size-1.5 rounded-full bg-onboarding-success-500" aria-hidden />
                        <p className="min-w-0 truncate text-sm text-onboarding-neutral-600 dark:text-onboarding-neutral-400">Latest updates from your workspace</p>
                      </div>
                      <Select
                        value={searchParams.get("activityKind") ?? "all"}
                        onValueChange={(value) => {
                            const params = new URLSearchParams(searchParams.toString());
                            if (value === "all" || !value) params.delete("activityKind");
                            else params.set("activityKind", value);
                            router.replace(`/dashboard?${params.toString()}`);
                          }}
                      >
                        <SelectTrigger aria-label="Filter activity" className="h-8 w-full min-w-0 border-onboarding-neutral-150 bg-onboarding-neutral-0 px-2 text-xs font-semibold text-onboarding-ink sm:w-auto sm:min-w-28 dark:border-onboarding-neutral-750 dark:bg-onboarding-neutral-900 dark:text-onboarding-neutral-0"><span>{searchParams.get("activityKind") === "message" ? "Messages" : searchParams.get("activityKind") === "prospect" ? "Prospects" : searchParams.get("activityKind") === "video" ? "Videos" : searchParams.get("activityKind") === "campaign" ? "Campaigns" : "All activity"}</span></SelectTrigger>
                        <SelectContent align="end" className="w-36 border border-onboarding-neutral-150 bg-onboarding-neutral-0 text-onboarding-ink dark:border-onboarding-neutral-750 dark:bg-onboarding-neutral-900 dark:text-onboarding-neutral-0">
                          <SelectItem value="all" className="text-onboarding-ink focus:bg-onboarding-neutral-50 focus:text-onboarding-ink dark:text-onboarding-neutral-0 dark:focus:bg-onboarding-neutral-800 dark:focus:text-onboarding-neutral-0">All activity</SelectItem>
                          <SelectItem value="message" className="text-onboarding-ink focus:bg-onboarding-neutral-50 focus:text-onboarding-ink dark:text-onboarding-neutral-0 dark:focus:bg-onboarding-neutral-800 dark:focus:text-onboarding-neutral-0">Messages</SelectItem>
                          <SelectItem value="prospect" className="text-onboarding-ink focus:bg-onboarding-neutral-50 focus:text-onboarding-ink dark:text-onboarding-neutral-0 dark:focus:bg-onboarding-neutral-800 dark:focus:text-onboarding-neutral-0">Prospects</SelectItem>
                          <SelectItem value="video" className="text-onboarding-ink focus:bg-onboarding-neutral-50 focus:text-onboarding-ink dark:text-onboarding-neutral-0 dark:focus:bg-onboarding-neutral-800 dark:focus:text-onboarding-neutral-0">Videos</SelectItem>
                          <SelectItem value="campaign" className="text-onboarding-ink focus:bg-onboarding-neutral-50 focus:text-onboarding-ink dark:text-onboarding-neutral-0 dark:focus:bg-onboarding-neutral-800 dark:focus:text-onboarding-neutral-0">Campaigns</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {overview.activity.length === 0 ? (
                      <div className="px-5 py-5">
                        <p className="text-sm font-medium">No activity yet</p>
                        <p className="mt-1 text-sm text-onboarding-neutral-600 dark:text-onboarding-neutral-400">Activity will appear after you add prospects or launch a campaign.</p>
                      </div>
                    ) : (
                      <LiveActivityTable data={overview.activity.slice(0, 4)} />
                    )}
                    <div className="flex justify-center border-t border-onboarding-neutral-150 px-5 py-2.5 dark:border-onboarding-neutral-750">
                      <Link href="/dashboard/activity" className="inline-flex items-center gap-1.5 text-sm font-semibold text-onboarding-purple-600 transition-colors hover:text-onboarding-purple-700 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-onboarding-purple-300 dark:text-onboarding-purple-200">
                        View all activity <ChevronDown className="size-3.5 -rotate-90" aria-hidden />
                      </Link>
                    </div>
                </section>

                <aside className="order-3 flex w-full min-w-0 max-w-full flex-col gap-4 xl:col-start-2" aria-label="Workspace insights">
                  <OverviewChannelUpsellCarousel channels={overview.channels} />

                  <OverviewInsightCarousel overview={overview} featuredInsight={featuredInsight} />

                  <SendingHealthStrip overview={overview} />
                </aside>
              </div>
            ) : null}
    </DashboardPageFrame>
  );
}
