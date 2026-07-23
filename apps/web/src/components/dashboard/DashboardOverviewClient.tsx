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
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { useEffect, useState } from "react";
import { ChannelLogo } from "@/components/onboarding/ChannelLogo";
import { CampaignVideoView, type CampaignVideoSummary } from "@/components/dashboard/CampaignVideoView";
import { LiveActivityTable } from "@/components/dashboard/LiveActivityTable";
import { Button } from "@/components/ui/Button";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
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

function DashboardChannelMark({
  name,
  size = "default",
  className,
}: {
  name: "linkedin" | "whatsapp";
  size?: "default" | "small" | "badge";
  className?: string;
}) {
  const isLinkedIn = name === "linkedin";

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-[0.3rem] text-white",
        size === "badge" ? "size-4" : size === "small" ? "size-5" : "size-8",
        isLinkedIn ? "bg-[#0A66C2]" : "bg-[#25D366]",
        className,
      )}
      aria-hidden
    >
      <ChannelLogo name={name} className={size === "badge" ? "size-2.5" : size === "small" ? "size-3" : "size-[62%]"} />
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

function formatChartDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00.000Z`));
}

const INSIGHT_CHART_CONFIG: ChartConfig = {
  sent: { label: "Sent", color: "#5326b7" },
  replies: { label: "Replies", color: "#16a34a" },
};

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
    <div className="relative min-w-0 flex-1 text-center">
      <span
        className={cn(
          "relative z-10 inline-flex size-7 items-center justify-center rounded-full border text-xs font-semibold",
          complete
            ? "border-onboarding-purple-500 bg-onboarding-purple-500 text-white"
            : active
              ? "border-onboarding-purple-500 bg-onboarding-purple-500 text-white"
            : "border-onboarding-neutral-200 bg-onboarding-neutral-0 text-onboarding-neutral-400 dark:border-onboarding-neutral-700 dark:bg-onboarding-neutral-900",
        )}
      >
        {complete ? <Check className="size-4" strokeWidth={2.5} aria-hidden /> : index + 1}
      </span>
      <span
        className={cn(
          "mt-1.5 block truncate text-xs font-medium",
          complete || active ? "text-onboarding-ink dark:text-onboarding-neutral-0" : "text-onboarding-neutral-500 dark:text-onboarding-neutral-400",
        )}
      >
        {label}
      </span>
      <span className={cn(
        "mt-0.5 block truncate text-xs",
        active ? "font-medium text-onboarding-purple-600 dark:text-onboarding-purple-200" : "text-onboarding-neutral-500 dark:text-onboarding-neutral-400",
      )}>
        {detail}
      </span>
    </div>
  );
}

export function DashboardOverviewClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [insights, setInsights] = useState<AnalyticsInsights | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const overviewQuery = searchParams.toString();

  useEffect(() => {
    let cancelled = false;

    async function loadOverview() {
      try {
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
        const nextOverview = await apiFetch<DashboardOverview>(`/dashboard/overview?${query.toString()}`);
        if (!cancelled) {
          setOverview(nextOverview);
          setError(null);
        }
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

    void loadOverview();
    void apiFetch<AnalyticsInsights>("/dashboard/analytics/insights")
      .then((nextInsights) => {
        if (!cancelled) setInsights(nextInsights);
      })
      .catch(() => {
        // Overview data remains useful if the optional recommendation preview is unavailable.
      });
    return () => {
      cancelled = true;
    };
  }, [overviewQuery]);

  const recommendationItems = insights?.status === "ready"
    ? insights.whatToDoNext.slice(0, 3).map((item) => ({ title: item.action, detail: item.reason }))
    : (overview?.attention ?? []).slice(0, 3).map((item) => ({ title: item.title, detail: item.detail }));
  const performanceSnapshot = overview
    ? [
        { label: "Sent", value: overview.metrics.outreachSent },
        { label: "Replies", value: overview.metrics.replies },
        { label: "Meetings", value: overview.metrics.meetingsBooked },
      ]
    : [];
  const activityTrend = overview?.activityTrend ?? [];
  const hasActivityTrend = activityTrend.some((item) => item.sent > 0 || item.replies > 0);
  const featuredInsight = insights?.status === "ready"
    ? insights.whatToDoNext[0]
      ? { title: insights.whatToDoNext[0].action, detail: insights.whatToDoNext[0].reason }
      : insights.whatsWorking[0]
        ? { title: insights.whatsWorking[0].text, detail: insights.whatsWorking[0].campaignName }
        : null
    : null;

  return (
    <div className="mx-auto flex w-full max-w-[104rem] flex-col px-[var(--dashboard-page-px,1rem)] py-[var(--dashboard-page-py,1.25rem)]">
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
                  <h1 className="text-[1.75rem] font-semibold tracking-tight sm:text-[1.9rem]">Acquisition engine</h1>
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

            {isLoading ? (
              <div className="flex min-h-96 items-center justify-center text-sm text-onboarding-neutral-600 dark:text-onboarding-neutral-400">
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden /> Loading workspace
              </div>
            ) : overview ? (
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem] 2xl:grid-cols-[minmax(0,1fr)_23rem]">
                <div className="order-1 flex min-h-0 min-w-0 flex-col gap-4">
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
                              setOverview((current) => {
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
                      <div className="relative flex w-full">
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
                              <span className="absolute top-3.5 left-[12.5%] w-[75%] border-t-2 border-onboarding-neutral-200 dark:border-onboarding-neutral-700" aria-hidden />
                              <span className="absolute top-3.5 left-[12.5%] border-t-2 border-onboarding-purple-500" style={{ width: `${(activeIndex / (stages.length - 1)) * 75}%` }} aria-hidden />
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

                <section className="order-4 overflow-hidden rounded-onboarding border border-onboarding-neutral-150 bg-onboarding-neutral-0 shadow-onboarding-small xl:col-span-2 xl:row-start-3 dark:border-onboarding-neutral-750 dark:bg-onboarding-neutral-900" aria-labelledby="activity-heading">
                    <div className="flex items-center justify-between border-b border-onboarding-neutral-150 px-5 py-3 dark:border-onboarding-neutral-750">
                      <div className="flex items-center gap-2.5">
                        <h2 id="activity-heading" className="font-semibold">Live activity</h2>
                        <span className="size-1.5 rounded-full bg-onboarding-success-500" aria-hidden />
                        <p className="text-sm text-onboarding-neutral-600 dark:text-onboarding-neutral-400">Latest updates from your workspace</p>
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
                        <SelectTrigger aria-label="Filter activity" className="h-8 w-auto min-w-28 border-onboarding-neutral-150 bg-onboarding-neutral-0 px-2 text-xs font-semibold text-onboarding-ink dark:border-onboarding-neutral-750 dark:bg-onboarding-neutral-900 dark:text-onboarding-neutral-0"><span>{searchParams.get("activityKind") === "message" ? "Messages" : searchParams.get("activityKind") === "prospect" ? "Prospects" : searchParams.get("activityKind") === "video" ? "Videos" : searchParams.get("activityKind") === "campaign" ? "Campaigns" : "All activity"}</span></SelectTrigger>
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

                <aside className="order-3 grid gap-4 xl:col-start-2 xl:grid-rows-2 xl:self-stretch" aria-label="Workspace insights">
                  <section className="overflow-hidden rounded-onboarding border border-onboarding-neutral-150 bg-onboarding-neutral-0 shadow-onboarding-small dark:border-onboarding-neutral-750 dark:bg-onboarding-neutral-900" aria-labelledby="recommendations-heading">
                    <div className="relative px-4 py-3 before:absolute before:right-4 before:bottom-0 before:left-4 before:h-px before:bg-onboarding-neutral-150 dark:before:bg-onboarding-neutral-750">
                      <div className="flex items-center gap-2">
                        <h2 id="recommendations-heading" className="font-semibold">Recommendations</h2>
                        <span className="rounded bg-onboarding-purple-50 px-1.5 py-0.5 text-[10px] font-semibold text-onboarding-purple-600 dark:bg-onboarding-purple-900 dark:text-onboarding-purple-100">AI</span>
                      </div>
                      <p className="mt-1 text-xs leading-5 text-onboarding-neutral-600 dark:text-onboarding-neutral-400">Prioritized from recorded workspace data.</p>
                    </div>
                    {recommendationItems.length ? (
                      <ul>
                        {recommendationItems.map((item, index) => (
                          <li key={`${item.title}-${index}`} className="relative flex items-start gap-3 px-4 py-3 after:absolute after:right-4 after:bottom-0 after:left-4 after:h-px after:bg-onboarding-neutral-150 last:after:hidden dark:after:bg-onboarding-neutral-750">
                            <span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center text-onboarding-purple-600 dark:text-onboarding-purple-200" aria-hidden>
                              {index === 0 ? <TrendingUp className="size-4" /> : index === 1 ? <Sparkles className="size-4" /> : <CircleAlert className="size-4" />}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold leading-5">{item.title}</p>
                              <p className="mt-1 text-xs leading-5 text-onboarding-neutral-600 dark:text-onboarding-neutral-400">{item.detail}</p>
                            </div>
                            <Link href="/dashboard/analytics" className="mt-1 inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-onboarding-purple-600 hover:text-onboarding-purple-700 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-onboarding-purple-300 dark:text-onboarding-purple-200">
                              Review <ArrowRight className="size-3" aria-hidden />
                            </Link>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="px-4 py-5">
                        <p className="text-sm font-medium">Insights are still gathering</p>
                        <p className="mt-1 text-xs leading-5 text-onboarding-neutral-600 dark:text-onboarding-neutral-400">Recommendations will appear after recorded outreach has enough data to analyze.</p>
                      </div>
                    )}
                    <div className="relative flex justify-center px-4 py-2.5 before:absolute before:top-0 before:right-4 before:left-4 before:h-px before:bg-onboarding-neutral-150 dark:before:bg-onboarding-neutral-750">
                      <Link href="/dashboard/analytics" className="inline-flex items-center gap-1.5 text-xs font-semibold text-onboarding-purple-600 hover:text-onboarding-purple-700 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-onboarding-purple-300 dark:text-onboarding-purple-200">
                        View all recommendations <ArrowRight className="size-3" aria-hidden />
                      </Link>
                    </div>
                  </section>

                  <section className="overflow-hidden rounded-onboarding border border-onboarding-neutral-150 bg-onboarding-neutral-0 shadow-onboarding-small dark:border-onboarding-neutral-750 dark:bg-onboarding-neutral-900" aria-labelledby="snapshot-heading">
                    <div className="px-4 pt-4">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="size-4 text-onboarding-purple-600 dark:text-onboarding-purple-200" aria-hidden />
                        <h2 id="snapshot-heading" className="font-semibold">Today&apos;s insight</h2>
                      </div>
                      {featuredInsight ? (
                        <>
                          <p className="mt-3 text-sm font-semibold leading-5">{featuredInsight.title}</p>
                          <p className="mt-1 text-xs leading-5 text-onboarding-neutral-600 dark:text-onboarding-neutral-400">{featuredInsight.detail}</p>
                        </>
                      ) : (
                        <>
                          <p className="mt-3 text-sm font-semibold">Recorded campaign activity</p>
                          <p className="mt-1 text-xs leading-5 text-onboarding-neutral-600 dark:text-onboarding-neutral-400">Once outreach is sent, evidence-based insights will appear here.</p>
                        </>
                      )}
                    </div>
                    <div className="px-4 pt-3">
                      <ChartContainer config={INSIGHT_CHART_CONFIG} className="h-36 w-full aspect-auto">
                        <AreaChart data={activityTrend} margin={{ top: 8, right: 2, left: 0, bottom: 0 }}>
                          <defs>
                            <linearGradient id="insight-sent-fill" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="var(--color-sent)" stopOpacity={0.22} />
                              <stop offset="100%" stopColor="var(--color-sent)" stopOpacity={0.02} />
                            </linearGradient>
                            <linearGradient id="insight-replies-fill" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="var(--color-replies)" stopOpacity={0.18} />
                              <stop offset="100%" stopColor="var(--color-replies)" stopOpacity={0.02} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid vertical={false} strokeDasharray="3 3" />
                          <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} minTickGap={22} tickFormatter={(value) => formatChartDate(String(value))} />
                          <YAxis hide domain={[0, "auto"]} />
                          <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" labelFormatter={(value) => formatChartDate(String(value))} />} />
                          <Area type="monotone" dataKey="sent" stroke="var(--color-sent)" fill="url(#insight-sent-fill)" strokeWidth={2} dot={false} />
                          <Area type="monotone" dataKey="replies" stroke="var(--color-replies)" fill="url(#insight-replies-fill)" strokeWidth={2} dot={false} />
                        </AreaChart>
                      </ChartContainer>
                      {!hasActivityTrend ? <p className="pb-2 text-center text-xs text-onboarding-neutral-500 dark:text-onboarding-neutral-400">No sent messages or replies in this period.</p> : null}
                      <div className="grid grid-cols-3 gap-2 border-t border-onboarding-neutral-150 py-3 dark:border-onboarding-neutral-750">
                        {performanceSnapshot.map((item) => <div key={item.label} className="min-w-0"><p className="text-[11px] text-onboarding-neutral-500 dark:text-onboarding-neutral-400">{item.label}</p><p className="mt-0.5 text-base font-semibold">{formatNumber(item.value)}</p></div>)}
                      </div>
                    </div>
                    <div className="flex justify-center border-t border-onboarding-neutral-150 px-4 py-2.5 dark:border-onboarding-neutral-750">
                      <Link href="/dashboard/analytics" className="inline-flex items-center gap-1.5 text-xs font-semibold text-onboarding-purple-600 hover:text-onboarding-purple-700 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-onboarding-purple-300 dark:text-onboarding-purple-200">
                        View full report <ArrowRight className="size-3" aria-hidden />
                      </Link>
                    </div>
                  </section>
                </aside>
              </div>
            ) : null}
    </div>
  );
}
