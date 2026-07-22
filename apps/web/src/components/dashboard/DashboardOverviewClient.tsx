"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Clock3,
  CreditCard,
  LayoutDashboard,
  Link2,
  Loader2,
  Megaphone,
  MessageSquare,
  Play,
  Plus,
  Rocket,
  Send,
  Sparkles,
  TrendingUp,
  Users,
  Video,
} from "lucide-react";
import { useEffect, useState } from "react";
import { ChannelLogo } from "@/components/onboarding/ChannelLogo";
import { Button } from "@/components/ui/Button";
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
    video?: { id: string; status: string; videoUrl: string | null; thumbnailUrl: string | null } | null;
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

type IconTone = "brand" | "success" | "warning" | "neutral";

const METRICS: Array<{
  key: keyof DashboardOverview["metrics"];
  label: string;
  icon: typeof Users;
  tone: IconTone;
}> = [
  { key: "prospects", label: "Prospects", icon: Users, tone: "brand" },
  { key: "outreachInProgress", label: "Outreach in progress", icon: Rocket, tone: "warning" },
  { key: "replies", label: "Replies", icon: MessageSquare, tone: "success" },
  { key: "meetingsBooked", label: "Meetings booked", icon: CalendarDays, tone: "neutral" },
  { key: "customers", label: "Customers", icon: CheckCircle2, tone: "success" },
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

function IconTile({
  icon: Icon,
  tone = "brand",
  className,
}: {
  icon: typeof Users;
  tone?: IconTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center",
        tone === "brand" && "text-onboarding-purple-600 dark:text-onboarding-purple-200",
        tone === "success" && "text-onboarding-success-500",
        tone === "warning" && "text-onboarding-warning-900 dark:text-onboarding-warning-150",
        tone === "neutral" && "text-onboarding-neutral-600 dark:text-onboarding-neutral-300",
        className,
      )}
      aria-hidden
    >
      <Icon className="size-[1.05rem]" />
    </span>
  );
}

function MetricCell({
  value,
  label,
  icon: Icon,
  tone,
  trend,
}: {
  value: number;
  label: string;
  icon: typeof Users;
  tone: IconTone;
  trend?: NonNullable<DashboardOverview["trends"]>[keyof NonNullable<DashboardOverview["trends"]>];
}) {
  return (
    <div className="min-w-0 px-4 py-3 sm:px-5">
      <IconTile icon={Icon} tone={tone} className="size-6" />
      <p className="mt-2 text-xl font-semibold tracking-tight sm:text-2xl">{formatNumber(value)}</p>
      <p className="mt-0.5 text-sm text-onboarding-neutral-600 dark:text-onboarding-neutral-400">{label}</p>
      {trend ? (
        <p className={cn(
          "mt-2 flex items-center gap-1 text-xs font-medium",
          trend.direction === "up" || trend.direction === "new"
            ? "text-onboarding-success-500"
            : trend.direction === "down"
              ? "text-onboarding-error-500"
              : "text-onboarding-neutral-500 dark:text-onboarding-neutral-400",
        )}>
          {trend.direction === "up" ? <ArrowUp className="size-3" aria-hidden /> : trend.direction === "down" ? <ArrowDown className="size-3" aria-hidden /> : null}
          {trend.direction === "new" ? "New activity this period" : `${trend.percent ?? 0}% vs prior period`}
        </p>
      ) : null}
    </div>
  );
}

function ActivityMark({ item }: { item: DashboardOverview["activity"][number] }) {
  const channel = item.channel ?? "";

  if (item.avatarUrl) {
    return (
      <span className="relative size-9 shrink-0" aria-hidden>
        <img src={item.avatarUrl} alt="" className="size-9 rounded-full object-cover" />
        {isChannelLogoName(channel) ? (
          <DashboardChannelMark
            name={channel}
            size="badge"
            className="absolute -right-0.5 -bottom-0.5 border-2 border-onboarding-neutral-0 dark:border-onboarding-neutral-900"
          />
        ) : null}
      </span>
    );
  }

  if (isChannelLogoName(channel)) {
    return <DashboardChannelMark name={channel} />;
  }
  const Icon = item.kind === "message" ? MessageSquare : item.kind === "prospect" ? Users : item.kind === "video" ? Video : Megaphone;
  return <Icon className="size-5 shrink-0 text-onboarding-purple-600 dark:text-onboarding-purple-200" aria-hidden />;
}

function ProgressStage({
  label,
  complete,
  index,
  final,
}: {
  label: string;
  complete: boolean;
  index: number;
  final: boolean;
}) {
  return (
    <div className="relative min-w-0 flex-1 text-center">
      {!final ? (
        <span
          className={cn(
            "absolute top-3 left-1/2 h-px w-full",
            complete ? "bg-onboarding-purple-500" : "bg-onboarding-neutral-150 dark:bg-onboarding-neutral-750",
          )}
          aria-hidden
        />
      ) : null}
      <span
        className={cn(
          "relative z-10 inline-flex size-6 items-center justify-center rounded-full border text-[11px] font-semibold",
          complete
            ? "border-onboarding-purple-500 bg-onboarding-purple-500 text-white"
            : "border-onboarding-neutral-200 bg-onboarding-neutral-0 text-onboarding-neutral-400 dark:border-onboarding-neutral-700 dark:bg-onboarding-neutral-900",
        )}
      >
        {complete ? <CheckCircle2 className="size-3.5" aria-hidden /> : index + 1}
      </span>
      <span
        className={cn(
          "mt-1.5 block truncate text-[11px] font-medium",
          complete ? "text-onboarding-ink dark:text-onboarding-neutral-0" : "text-onboarding-neutral-500 dark:text-onboarding-neutral-400",
        )}
      >
        {label}
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
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);
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

  async function openBillingPortal() {
    if (!overview?.organization.hasBillingPortal || isOpeningPortal) return;

    setIsOpeningPortal(true);
    try {
      const session = await apiFetch<{ url: string }>("/billing/portal-session", {
        method: "POST",
        body: JSON.stringify({}),
      });
      window.location.assign(session.url);
    } catch (portalError) {
      setError(portalError instanceof Error ? portalError.message : "Unable to open billing portal.");
      setIsOpeningPortal(false);
    }
  }

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
  const snapshotMaximum = Math.max(1, ...performanceSnapshot.map((item) => item.value));

  return (
    <div className="mx-auto flex w-full max-w-[100rem] flex-col px-5 py-6 sm:px-6 lg:h-full lg:px-4 lg:py-4 xl:px-5">
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
                  <h1 className="text-[1.7rem] font-semibold tracking-tight sm:text-[1.8rem]">Acquisition engine</h1>
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
                <p className="mt-1.5 max-w-2xl text-sm text-onboarding-neutral-600 dark:text-onboarding-neutral-400">
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
                {overview?.organization.hasBillingPortal ? (
                  <Button variant="secondary" onClick={openBillingPortal} disabled={isOpeningPortal}>
                    {isOpeningPortal ? <Loader2 className="animate-spin" aria-hidden /> : <CreditCard aria-hidden />}
                    Manage billing
                  </Button>
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
              <div className="grid gap-4 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_20rem]">
                <div className="content-start space-y-4 lg:grid lg:min-h-0 lg:grid-rows-[auto_auto_auto] lg:space-y-0 lg:gap-4">
                  <section className="grid overflow-hidden rounded-onboarding border border-onboarding-neutral-150 bg-onboarding-neutral-0 shadow-onboarding-small sm:grid-cols-2 lg:grid-cols-5 dark:border-onboarding-neutral-750 dark:bg-onboarding-neutral-900" aria-label="Campaign metrics">
                    {METRICS.filter(({ key }) => key !== "customers" || typeof overview.metrics.customers === "number").map(({ key, label, icon: Icon, tone }, index) => (
                      <div
                        key={key}
                        className={cn(
                          "border-b border-onboarding-neutral-150 last:border-b-0 lg:border-r lg:border-b-0 lg:last:border-r-0 dark:border-onboarding-neutral-750",
                          index === 1 && "sm:border-b-0",
                        )}
                      >
                        <MetricCell value={overview.metrics[key] ?? 0} label={label} icon={Icon} tone={tone} trend={overview.trends?.[key]} />
                      </div>
                    ))}
                  </section>

                  <section className="shrink-0 overflow-hidden rounded-onboarding border border-onboarding-neutral-150 bg-onboarding-neutral-0 shadow-onboarding-small dark:border-onboarding-neutral-750 dark:bg-onboarding-neutral-900" aria-labelledby="primary-campaign-heading">
                    <div className="grid lg:grid-cols-[minmax(0,1fr)_12rem_10rem]">
                      <div className="p-4 sm:p-5">
                        <p className="text-[11px] font-semibold tracking-[0.08em] text-onboarding-neutral-500 uppercase dark:text-onboarding-neutral-400">Active campaign</p>
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                          <h2 id="primary-campaign-heading" className="text-xl font-semibold tracking-tight">
                            {overview.primaryCampaign?.name ?? "Campaign ready to launch"}
                          </h2>
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-onboarding-success-500">
                            <span className="size-1.5 rounded-full bg-onboarding-success-500" aria-hidden />
                            {overview.primaryCampaign ? titleCase(overview.primaryCampaign.status) : "Ready"}
                          </span>
                        </div>
                        <p className="mt-1.5 max-w-xl text-sm leading-5 text-onboarding-neutral-600 dark:text-onboarding-neutral-400">
                          {overview.primaryCampaign
                            ? `${formatNumber(overview.primaryCampaign.prospectCount)} prospects are enrolled for this campaign.`
                            : "Your strategy, billing, and channel connection are complete. Create a campaign when you are ready."}
                        </p>
                        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
                          <span className="text-xs font-medium text-onboarding-neutral-500 dark:text-onboarding-neutral-400">Using</span>
                          {overview.primaryCampaign?.channels.length ? overview.primaryCampaign.channels.map((channel) => (
                            <span key={channel} className="inline-flex items-center gap-1.5 text-xs font-semibold">
                              {isChannelLogoName(channel) ? <DashboardChannelMark name={channel} size="small" /> : <Link2 className="size-3.5 text-onboarding-purple-600" aria-hidden />}
                              {titleCase(channel)}
                            </span>
                          )) : <span className="text-xs text-onboarding-neutral-500 dark:text-onboarding-neutral-400">No campaign channel selected</span>}
                        </div>
                      </div>

                      <div className="border-t border-onboarding-neutral-150 p-3 dark:border-onboarding-neutral-750 lg:border-t-0 lg:border-l">
                        <div className="relative flex h-24 items-center justify-center overflow-hidden rounded-lg bg-onboarding-neutral-100 dark:bg-onboarding-neutral-850">
                          {overview.primaryCampaign?.video?.thumbnailUrl ? (
                            <img src={overview.primaryCampaign.video.thumbnailUrl} alt="Campaign video preview" className="absolute inset-0 size-full object-cover" />
                          ) : null}
                          <div className="flex flex-col items-center gap-2 text-onboarding-neutral-500 dark:text-onboarding-neutral-400">
                            <span className="inline-flex size-9 items-center justify-center rounded-full border border-onboarding-neutral-300 bg-onboarding-neutral-0/90 text-onboarding-purple-600 dark:border-onboarding-neutral-700 dark:bg-onboarding-neutral-900">
                              <Play className="ml-0.5 size-4" aria-hidden />
                            </span>
                            <span className="text-xs font-medium">Video preview</span>
                          </div>
                        </div>
                        <p className="mt-1.5 text-center text-[11px] text-onboarding-neutral-500 dark:text-onboarding-neutral-400">{overview.primaryCampaign?.video ? "Campaign video ready" : "Preview appears when ready."}</p>
                      </div>

                      <div className="border-t border-onboarding-neutral-150 p-3 dark:border-onboarding-neutral-750 lg:border-t-0 lg:border-l">
                        <p className="text-[11px] font-semibold tracking-[0.08em] text-onboarding-neutral-500 uppercase dark:text-onboarding-neutral-400">Channels active</p>
                        <div className="mt-3 space-y-2.5">
                          {overview.channels.filter((channel) => channel.status === "active").slice(0, 3).map((channel) => (
                            <div key={channel.id} className="flex items-center gap-2.5">
                              {isChannelLogoName(channel.platform) ? <DashboardChannelMark name={channel.platform} /> : <Link2 className="size-4 text-onboarding-purple-600" aria-hidden />}
                              <span className="min-w-0 flex-1 truncate text-xs font-medium">{titleCase(channel.platform)}</span>
                              <span className="text-[11px] font-semibold text-onboarding-neutral-500 dark:text-onboarding-neutral-400">{formatNumber(overview.primaryCampaign?.channelSendCounts?.[channel.platform.toLowerCase()] ?? 0)} sent</span>
                            </div>
                          ))}
                          {overview.channels.every((channel) => channel.status !== "active") ? <p className="text-xs leading-5 text-onboarding-neutral-500 dark:text-onboarding-neutral-400">Connect a channel before launch.</p> : null}
                        </div>
                      </div>
                    </div>

                    <div className="grid border-t border-onboarding-neutral-150 sm:grid-cols-5 dark:border-onboarding-neutral-750">
                      {[
                        { label: "Prospects", value: overview.primaryCampaign?.stats?.prospects ?? overview.primaryCampaign?.prospectCount ?? 0, icon: Users },
                        { label: "Contacted", value: overview.primaryCampaign?.stats?.contacted ?? 0, icon: Send },
                        { label: "Replies", value: overview.primaryCampaign?.stats?.replies ?? 0, icon: MessageSquare },
                        { label: "Meetings", value: overview.primaryCampaign?.stats?.meetings ?? 0, icon: CalendarDays },
                        { label: "Customers", value: overview.primaryCampaign?.stats?.customers ?? 0, icon: CheckCircle2 },
                      ].map(({ label, value, icon: Icon }, index) => (
                        <div key={label} className={cn("flex items-center gap-2.5 px-4 py-2.5", index > 0 && "border-t border-onboarding-neutral-150 sm:border-t-0 sm:border-l dark:border-onboarding-neutral-750")}>
                          <Icon className="size-4 text-onboarding-purple-600 dark:text-onboarding-purple-200" aria-hidden />
                          <div>
                            <p className="text-lg font-semibold leading-none">{formatNumber(value)}</p>
                            <p className="mt-1 text-[11px] text-onboarding-neutral-500 dark:text-onboarding-neutral-400">{label}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="border-t border-onboarding-neutral-150 px-5 py-2.5 dark:border-onboarding-neutral-750">
                      <div className="flex">
                        {(() => {
                          const reached = overview.primaryCampaign?.stats?.meetings
                            ? 4
                            : overview.primaryCampaign?.status === "active"
                              ? 3
                              : overview.primaryCampaign?.stats?.prospects || overview.primaryCampaign?.prospectCount
                                ? 2
                                : overview.primaryCampaign
                                  ? 1
                                  : 0;
                          return ["Setup", "Prospects added", "Outreach running", "Meetings booked"].map((label, index, stages) => (
                            <ProgressStage key={label} label={label} complete={index < reached} index={index} final={index === stages.length - 1} />
                          ));
                        })()}
                      </div>
                    </div>
                  </section>

                  <section className="overflow-hidden rounded-onboarding border border-onboarding-neutral-150 bg-onboarding-neutral-0 shadow-onboarding-small dark:border-onboarding-neutral-750 dark:bg-onboarding-neutral-900" aria-labelledby="activity-heading">
                    <div className="flex items-center justify-between border-b border-onboarding-neutral-150 px-5 py-3 dark:border-onboarding-neutral-750">
                      <div className="flex items-center gap-2.5">
                        <h2 id="activity-heading" className="font-semibold">Live activity</h2>
                        <span className="size-1.5 rounded-full bg-onboarding-success-500" aria-hidden />
                        <p className="text-sm text-onboarding-neutral-600 dark:text-onboarding-neutral-400">Latest updates from your workspace</p>
                      </div>
                      <label className="relative">
                        <span className="sr-only">Filter activity</span>
                        <select
                          value={searchParams.get("activityKind") ?? "all"}
                          onChange={(event) => {
                            const params = new URLSearchParams(searchParams.toString());
                            if (event.target.value === "all") params.delete("activityKind");
                            else params.set("activityKind", event.target.value);
                            router.replace(`/dashboard?${params.toString()}`);
                          }}
                          className="h-8 appearance-none rounded-lg border border-onboarding-neutral-150 bg-onboarding-neutral-0 pr-7 pl-2 text-xs font-semibold focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-onboarding-purple-300 dark:border-onboarding-neutral-750 dark:bg-onboarding-neutral-900"
                        >
                          <option value="all">All activity</option>
                          <option value="message">Messages</option>
                          <option value="prospect">Prospects</option>
                          <option value="video">Videos</option>
                          <option value="campaign">Campaigns</option>
                        </select>
                        <ChevronDown className="pointer-events-none absolute top-2.5 right-2 size-3" aria-hidden />
                      </label>
                    </div>
                    {overview.activity.length === 0 ? (
                      <div className="px-5 py-5">
                        <p className="text-sm font-medium">No activity yet</p>
                        <p className="mt-1 text-sm text-onboarding-neutral-600 dark:text-onboarding-neutral-400">Activity will appear after you add prospects or launch a campaign.</p>
                      </div>
                    ) : (
                      <ul className="divide-y divide-onboarding-neutral-150 dark:divide-onboarding-neutral-750">
                        {overview.activity.slice(0, 3).map((item) => (
                          <li key={item.id} className="flex items-center gap-3 px-5 py-2.5">
                            <ActivityMark item={item} />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold">{item.title}</p>
                              <p className="mt-0.5 truncate text-sm text-onboarding-neutral-600 dark:text-onboarding-neutral-400">{item.detail}</p>
                            </div>
                            <time className="shrink-0 text-xs text-onboarding-neutral-500 dark:text-onboarding-neutral-400" dateTime={item.occurredAt}>{relativeTime(item.occurredAt)}</time>
                            <Button asChild variant="outline" size="sm">
                              <Link href={item.href ?? "/dashboard/activity"}>{item.href && item.action === "reply" ? "Reply" : "View"}</Link>
                            </Button>
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="flex justify-center border-t border-onboarding-neutral-150 px-5 py-2.5 dark:border-onboarding-neutral-750">
                      <Link href="/dashboard/activity" className="inline-flex items-center gap-1.5 text-sm font-semibold text-onboarding-purple-600 transition-colors hover:text-onboarding-purple-700 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-onboarding-purple-300 dark:text-onboarding-purple-200">
                        View all activity <ChevronDown className="size-3.5 -rotate-90" aria-hidden />
                      </Link>
                    </div>
                  </section>
                </div>

                <aside className="grid gap-4 lg:min-h-0 lg:grid-rows-2" aria-label="Workspace insights">
                  <section className="overflow-hidden rounded-onboarding border border-onboarding-neutral-150 bg-onboarding-neutral-0 shadow-onboarding-small dark:border-onboarding-neutral-750 dark:bg-onboarding-neutral-900" aria-labelledby="recommendations-heading">
                    <div className="border-b border-onboarding-neutral-150 px-4 py-3 dark:border-onboarding-neutral-750">
                      <div className="flex items-center gap-2">
                        <h2 id="recommendations-heading" className="font-semibold">Recommendations</h2>
                        <span className="rounded bg-onboarding-purple-50 px-1.5 py-0.5 text-[10px] font-semibold text-onboarding-purple-600 dark:bg-onboarding-purple-900 dark:text-onboarding-purple-100">AI</span>
                      </div>
                      <p className="mt-1 text-xs leading-5 text-onboarding-neutral-600 dark:text-onboarding-neutral-400">Prioritized from recorded workspace data.</p>
                    </div>
                    {recommendationItems.length ? (
                      <ul className="divide-y divide-onboarding-neutral-150 dark:divide-onboarding-neutral-750">
                        {recommendationItems.map((item, index) => (
                          <li key={`${item.title}-${index}`} className="flex items-start gap-3 px-4 py-3">
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
                    <div className="flex justify-center border-t border-onboarding-neutral-150 px-4 py-2.5 dark:border-onboarding-neutral-750">
                      <Link href="/dashboard/analytics" className="inline-flex items-center gap-1.5 text-xs font-semibold text-onboarding-purple-600 hover:text-onboarding-purple-700 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-onboarding-purple-300 dark:text-onboarding-purple-200">
                        View all recommendations <ArrowRight className="size-3" aria-hidden />
                      </Link>
                    </div>
                  </section>

                  <section className="overflow-hidden rounded-onboarding border border-onboarding-neutral-150 bg-onboarding-neutral-0 shadow-onboarding-small dark:border-onboarding-neutral-750 dark:bg-onboarding-neutral-900" aria-labelledby="snapshot-heading">
                    <div className="px-4 pt-4">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="size-4 text-onboarding-purple-600 dark:text-onboarding-purple-200" aria-hidden />
                        <h2 id="snapshot-heading" className="font-semibold">Performance snapshot</h2>
                      </div>
                      <p className="mt-2 text-sm font-semibold">Recorded campaign activity</p>
                      <p className="mt-1 text-xs leading-5 text-onboarding-neutral-600 dark:text-onboarding-neutral-400">A factual view of persisted delivery and response counts.</p>
                    </div>
                    <div className="space-y-3 px-4 py-4">
                      {performanceSnapshot.map((item) => (
                        <div key={item.label}>
                          <div className="flex items-baseline justify-between gap-3">
                            <span className="text-xs text-onboarding-neutral-600 dark:text-onboarding-neutral-400">{item.label}</span>
                            <span className="text-xl font-semibold">{formatNumber(item.value)}</span>
                          </div>
                          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-onboarding-neutral-100 dark:bg-onboarding-neutral-800">
                            <div className="h-full rounded-full bg-onboarding-purple-500" style={{ width: `${(item.value / snapshotMaximum) * 100}%` }} />
                          </div>
                        </div>
                      ))}
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
