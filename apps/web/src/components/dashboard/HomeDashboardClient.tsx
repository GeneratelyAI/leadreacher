"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  BarChart3,
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Clock3,
  CreditCard,
  Gauge,
  HelpCircle,
  LayoutDashboard,
  Link2,
  Loader2,
  Mail,
  Megaphone,
  MessageSquare,
  Moon,
  Rocket,
  Search,
  Settings,
  Sun,
  Target,
  Users,
  Video,
} from "lucide-react";
import { useEffect, useState } from "react";
import { ChannelLogo } from "@/components/onboarding/ChannelLogo";
import { OnboardingLogo } from "@/components/onboarding/OnboardingLogo";
import { Button } from "@/components/ui/Button";
import { ApiError, apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useThemeMode } from "@/hooks/useThemeMode";
import {
  DASHBOARD_WORKSPACE_VIEWS,
  DashboardOperationsClient,
  type DashboardWorkspaceView,
} from "@/components/dashboard/DashboardOperationsClient";

type EngineStatus = "running" | "ready" | "needs_attention";

type DashboardOverview = {
  organization: {
    name: string;
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
  };
  primaryCampaign: {
    id: string;
    name: string;
    status: string;
    channels: string[];
    prospectCount: number;
    createdAt: string;
    updatedAt: string;
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
  }>;
};

type DashboardNavItem = {
  value: "overview" | DashboardWorkspaceView;
  label: string;
  icon: typeof LayoutDashboard;
};

type IconTone = "brand" | "success" | "warning" | "neutral";

const NAV_ITEMS: DashboardNavItem[] = [
  { value: "overview", label: "Overview", icon: LayoutDashboard },
  { value: "campaigns", label: "Campaigns", icon: Megaphone },
  { value: "prospects", label: "Prospects", icon: Users },
  { value: "messages", label: "Messages", icon: MessageSquare },
  { value: "channels", label: "Channels", icon: Link2 },
  { value: "analytics", label: "Analytics", icon: BarChart3 },
  { value: "settings", label: "Settings", icon: Settings },
];

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
];

function isChannelLogoName(value: string): value is "linkedin" | "whatsapp" {
  return value === "linkedin" || value === "whatsapp";
}

function DashboardChannelMark({ name, className }: { name: "linkedin" | "whatsapp"; className?: string }) {
  const isLinkedIn = name === "linkedin";

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-[0.3rem] text-white",
        isLinkedIn ? "bg-[#0A66C2]" : "bg-[#25D366]",
        className,
      )}
      aria-hidden
    >
      <ChannelLogo name={name} className="size-[62%]" />
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
}: {
  value: number;
  label: string;
  icon: typeof Users;
  tone: IconTone;
}) {
  return (
    <div className="min-w-0 px-5 py-4 sm:px-6">
      <IconTile icon={Icon} tone={tone} className="size-8" />
      <p className="mt-3 text-2xl font-semibold tracking-tight sm:text-[1.75rem]">{formatNumber(value)}</p>
      <p className="mt-1 text-sm text-onboarding-neutral-600 dark:text-onboarding-neutral-400">{label}</p>
    </div>
  );
}

export function HomeDashboardClient({ memberName }: { memberName: string }) {
  const searchParams = useSearchParams();
  const { isDark, toggle } = useThemeMode();
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadOverview() {
      try {
        const nextOverview = await apiFetch<DashboardOverview>("/dashboard/overview");
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
    return () => {
      cancelled = true;
    };
  }, []);

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

  const requestedView = searchParams.get("view");
  const workspaceView = DASHBOARD_WORKSPACE_VIEWS.find((view) => view === requestedView);
  if (workspaceView) {
    return <DashboardOperationsClient memberName={memberName} activeView={workspaceView} />;
  }

  return (
    <div className="h-dvh overflow-hidden bg-onboarding-neutral-0 text-onboarding-ink dark:bg-onboarding-neutral-950 dark:text-onboarding-neutral-0">
      <div className="flex h-full w-full">
        <aside className="hidden h-full w-[17.5rem] shrink-0 border-r border-onboarding-neutral-150 bg-onboarding-neutral-0 px-5 py-7 dark:border-onboarding-neutral-750 dark:bg-onboarding-neutral-900 lg:flex lg:flex-col">
          <OnboardingLogo className="h-8 w-auto" />
          <p className="mt-1 pl-9 text-[10px] font-medium tracking-[0.14em] text-onboarding-neutral-400 uppercase dark:text-onboarding-neutral-500">AI customer acquisition</p>
          <nav className="mt-11 space-y-1.5" aria-label="Workspace navigation">
            {NAV_ITEMS.map(({ value, label, icon: Icon }) => (
              <Link
                key={value}
                href={value === "overview" ? "/home" : `/home?view=${value}`}
                className={cn(
                  "flex h-11 items-center gap-3 rounded-onboarding px-3.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-onboarding-purple-300",
                  value === "overview"
                    ? "bg-onboarding-purple-50 font-semibold text-onboarding-purple-600 dark:bg-onboarding-purple-900 dark:text-onboarding-purple-100"
                    : "text-onboarding-neutral-500 hover:bg-onboarding-neutral-100 dark:text-onboarding-neutral-400 dark:hover:bg-onboarding-neutral-800",
                )}
                aria-current={value === "overview" ? "page" : undefined}
              >
                <Icon className="size-4" aria-hidden />
                {label}
              </Link>
            ))}
          </nav>

          <div className="mt-auto space-y-3">
            <button type="button" className="flex w-full items-center gap-3 rounded-onboarding px-2 py-2 text-left text-sm transition-colors hover:bg-onboarding-neutral-100 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-onboarding-purple-300 dark:hover:bg-onboarding-neutral-800">
              <span className="inline-flex size-8 items-center justify-center rounded-full bg-onboarding-neutral-150 font-semibold text-onboarding-purple-600 dark:bg-onboarding-neutral-750 dark:text-onboarding-purple-200">
                {memberName.slice(0, 1).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1 truncate font-medium">{memberName}</span>
              <ChevronDown className="size-4 text-onboarding-neutral-400" aria-hidden />
            </button>
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <header className="flex h-[4.75rem] shrink-0 items-center justify-between border-b border-onboarding-neutral-150 bg-onboarding-neutral-0 px-5 dark:border-onboarding-neutral-750 dark:bg-onboarding-neutral-900 sm:px-8 lg:px-10">
            <div className="flex items-center gap-3 lg:hidden">
              <OnboardingLogo className="h-6 w-auto" />
              <span className="text-xs text-onboarding-neutral-500 dark:text-onboarding-neutral-400">Overview</span>
            </div>
            <div className="hidden max-w-[29rem] flex-1 lg:block">
              <div className="flex h-10 items-center gap-2.5 rounded-onboarding border border-onboarding-neutral-150 bg-onboarding-neutral-50 px-3.5 text-sm text-onboarding-neutral-400 dark:border-onboarding-neutral-750 dark:bg-onboarding-neutral-850 dark:text-onboarding-neutral-500">
                <Search className="size-4" aria-hidden />
                Search coming soon
                <span className="ml-auto rounded border border-onboarding-neutral-200 px-1.5 py-0.5 text-[10px] font-medium text-onboarding-neutral-400 dark:border-onboarding-neutral-700">⌘ K</span>
              </div>
            </div>
            <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
              <span className="hidden h-10 items-center gap-2 rounded-onboarding border border-onboarding-neutral-150 px-3.5 text-sm font-medium text-onboarding-neutral-600 dark:border-onboarding-neutral-750 dark:text-onboarding-neutral-300 xl:inline-flex">
                <CalendarDays className="size-4" aria-hidden />
                Workspace overview
                <ChevronDown className="size-3.5 text-onboarding-neutral-400" aria-hidden />
              </span>
              <button
                type="button"
                onClick={(event) => toggle(event.currentTarget)}
                className="inline-flex size-10 items-center justify-center rounded-onboarding text-onboarding-neutral-600 transition-colors hover:bg-onboarding-neutral-100 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-onboarding-purple-300 dark:text-onboarding-neutral-300 dark:hover:bg-onboarding-neutral-800"
                aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
              >
                {isDark ? <Sun className="size-[1.1rem]" aria-hidden /> : <Moon className="size-[1.1rem]" aria-hidden />}
              </button>
              <span className="hidden size-10 items-center justify-center rounded-onboarding text-onboarding-neutral-400 sm:inline-flex" aria-label="Notifications coming soon">
                <Bell className="size-4" aria-hidden />
              </span>
            </div>
          </header>

          <div className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain", !error && "xl:overflow-hidden")}>
            <div className="mx-auto w-full max-w-[94rem] px-5 py-6 sm:px-8 lg:px-10 xl:flex xl:h-full xl:flex-col xl:px-12 xl:py-5">
            {error ? (
              <div className="mb-6 flex items-start gap-3 rounded-onboarding border border-onboarding-error-500/30 bg-onboarding-error-50 p-4 text-sm text-onboarding-error-900 dark:bg-onboarding-error-900 dark:text-onboarding-error-50" role="alert">
                <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                <div>
                  <p className="font-semibold">Unable to load workspace</p>
                  <p className="mt-1">{error}</p>
                </div>
              </div>
            ) : null}

            <section className="flex shrink-0 flex-col gap-4 pb-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h1 className="text-[1.8rem] font-semibold tracking-tight sm:text-[2rem]">Acquisition engine</h1>
                <p className="mt-2 max-w-2xl text-sm text-onboarding-neutral-600 dark:text-onboarding-neutral-400">
                  {overview?.engine.detail ?? "Loading your operational workspace."}
                </p>
              </div>
              {overview?.organization.hasBillingPortal ? (
                <Button variant="secondary" className="shrink-0" onClick={openBillingPortal} disabled={isOpeningPortal}>
                  {isOpeningPortal ? <Loader2 className="animate-spin" aria-hidden /> : <CreditCard aria-hidden />}
                  Manage billing
                </Button>
              ) : null}
            </section>

            {isLoading ? (
              <div className="flex min-h-96 items-center justify-center text-sm text-onboarding-neutral-600 dark:text-onboarding-neutral-400">
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden /> Loading workspace
              </div>
            ) : overview ? (
              <div className="grid gap-5 xl:min-h-0 xl:flex-1 xl:grid-cols-[minmax(0,1fr)_22rem]">
                <div className="space-y-5 xl:flex xl:min-h-0 xl:flex-col xl:space-y-0 xl:gap-5">
                  <section className="grid overflow-hidden rounded-onboarding border border-onboarding-neutral-150 bg-onboarding-neutral-0 shadow-onboarding-small sm:grid-cols-2 lg:grid-cols-4 dark:border-onboarding-neutral-750 dark:bg-onboarding-neutral-900" aria-label="Campaign metrics">
                    {METRICS.map(({ key, label, icon: Icon, tone }, index) => (
                      <div
                        key={key}
                        className={cn(
                          "border-b border-onboarding-neutral-150 last:border-b-0 lg:border-r lg:border-b-0 lg:last:border-r-0 dark:border-onboarding-neutral-750",
                          index === 1 && "sm:border-b-0",
                        )}
                      >
                        <MetricCell value={overview.metrics[key]} label={label} icon={Icon} tone={tone} />
                      </div>
                    ))}
                  </section>

                  <section className="shrink-0 overflow-hidden rounded-onboarding border border-onboarding-neutral-150 bg-onboarding-neutral-0 shadow-onboarding-small dark:border-onboarding-neutral-750 dark:bg-onboarding-neutral-900" aria-labelledby="primary-campaign-heading">
                    <div className="grid min-h-[17.5rem] lg:grid-cols-[minmax(0,1.35fr)_minmax(17rem,0.65fr)]">
                      <div className="p-5 sm:p-6">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-4">
                            <IconTile icon={overview.primaryCampaign ? Rocket : Target} tone="brand" className="size-11" />
                            <div>
                              <p className="text-[11px] font-semibold tracking-[0.08em] text-onboarding-purple-600 uppercase dark:text-onboarding-purple-200">Primary campaign</p>
                              <h2 id="primary-campaign-heading" className="mt-2 text-2xl font-semibold tracking-tight">
                                {overview.primaryCampaign?.name ?? "Campaign ready to launch"}
                              </h2>
                              <p className="mt-2 max-w-xl text-sm leading-6 text-onboarding-neutral-600 dark:text-onboarding-neutral-400">
                                {overview.primaryCampaign
                                  ? `${titleCase(overview.primaryCampaign.status)} with ${formatNumber(overview.primaryCampaign.prospectCount)} enrolled prospects.`
                                  : "Your strategy, billing, and channel connection are complete. Add prospects and review the first outreach before launching."}
                              </p>
                            </div>
                          </div>
                        </div>

                        {overview.primaryCampaign ? (
                          <div className="mt-5 flex flex-wrap items-center gap-3">
                            <span className="text-sm text-onboarding-neutral-500 dark:text-onboarding-neutral-400">Using</span>
                            {overview.primaryCampaign.channels.map((channel) => (
                              <span key={channel} className="inline-flex items-center gap-2 text-sm font-medium">
                                {isChannelLogoName(channel) ? <DashboardChannelMark name={channel} className="size-5" /> : <Link2 className="size-4 text-onboarding-purple-600" aria-hidden />}
                                {titleCase(channel)}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <div className="mt-5 grid gap-3 sm:grid-cols-3">
                            <div className="rounded-onboarding bg-onboarding-neutral-50 p-3 dark:bg-onboarding-neutral-850">
                              <div className="flex items-center gap-2.5">
                                <IconTile icon={Target} tone="success" className="size-8" />
                                <p className="text-sm font-semibold">Strategy ready</p>
                              </div>
                              <p className="mt-1 text-xs leading-5 text-onboarding-neutral-500 dark:text-onboarding-neutral-400">Audience and messaging defined</p>
                            </div>
                            <div className="rounded-onboarding bg-onboarding-neutral-50 p-3 dark:bg-onboarding-neutral-850">
                              <div className="flex items-center gap-2.5">
                                <IconTile icon={CreditCard} tone="success" className="size-8" />
                                <p className="text-sm font-semibold">Billing configured</p>
                              </div>
                              <p className="mt-1 text-xs leading-5 text-onboarding-neutral-500 dark:text-onboarding-neutral-400">Your plan is active</p>
                            </div>
                            <div className="rounded-onboarding bg-onboarding-neutral-50 p-3 dark:bg-onboarding-neutral-850">
                              <div className="flex items-center gap-2.5">
                                <IconTile icon={Link2} tone={overview.channels.some((channel) => channel.status === "active") ? "success" : "warning"} className="size-8" />
                                <p className="text-sm font-semibold">Channel {overview.channels.some((channel) => channel.status === "active") ? "connected" : "needed"}</p>
                              </div>
                              <p className="mt-1 text-xs leading-5 text-onboarding-neutral-500 dark:text-onboarding-neutral-400">{overview.channels.some((channel) => channel.status === "active") ? "Ready for outreach" : "Connect a channel to continue"}</p>
                            </div>
                          </div>
                        )}

                        <div className="mt-5 grid gap-2 sm:grid-cols-4">
                          {[
                            { label: "Setup", complete: true },
                            { label: "Channels", complete: overview.channels.some((channel) => channel.status === "active") },
                            { label: "Prospects", complete: overview.metrics.prospects > 0 },
                            { label: "Launch", complete: overview.primaryCampaign?.status === "active" },
                          ].map((stage, index) => (
                            <div key={stage.label} className="relative flex items-center gap-2 sm:block">
                              {index > 0 ? <span className="hidden sm:absolute sm:-left-1/2 sm:top-3 sm:block sm:h-px sm:w-full sm:bg-onboarding-neutral-150 dark:sm:bg-onboarding-neutral-750" aria-hidden /> : null}
                              <span className={cn("relative z-10 inline-flex size-6 items-center justify-center rounded-full border text-[11px] font-semibold", stage.complete ? "border-onboarding-purple-500 bg-onboarding-purple-500 text-white" : "border-onboarding-neutral-200 bg-onboarding-neutral-0 text-onboarding-neutral-400 dark:border-onboarding-neutral-700 dark:bg-onboarding-neutral-900")}>
                                {stage.complete ? <CheckCircle2 className="size-3.5" aria-hidden /> : index + 1}
                              </span>
                              <span className={cn("text-xs font-medium sm:mt-2 sm:block", stage.complete ? "text-onboarding-ink dark:text-onboarding-neutral-0" : "text-onboarding-neutral-500 dark:text-onboarding-neutral-400")}>{stage.label}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="border-t border-onboarding-neutral-150 bg-onboarding-neutral-50 p-5 dark:border-onboarding-neutral-750 dark:bg-onboarding-neutral-850 lg:border-t-0 lg:border-l">
                        <p className="text-[11px] font-semibold tracking-[0.08em] text-onboarding-neutral-500 uppercase dark:text-onboarding-neutral-400">Workspace activity</p>
                        <dl className="mt-4 grid grid-cols-2 gap-2.5">
                          <div className="rounded-onboarding border border-onboarding-neutral-150 bg-onboarding-neutral-0 p-2.5 dark:border-onboarding-neutral-750 dark:bg-onboarding-neutral-900">
                            <dt className="text-xs text-onboarding-neutral-500 dark:text-onboarding-neutral-400">Prospects</dt>
                            <dd className="mt-1.5 text-xl font-semibold">{formatNumber(overview.metrics.prospects)}</dd>
                          </div>
                          <div className="rounded-onboarding border border-onboarding-neutral-150 bg-onboarding-neutral-0 p-2.5 dark:border-onboarding-neutral-750 dark:bg-onboarding-neutral-900">
                            <dt className="text-xs text-onboarding-neutral-500 dark:text-onboarding-neutral-400">Sent</dt>
                            <dd className="mt-1.5 text-xl font-semibold">{formatNumber(overview.metrics.outreachSent)}</dd>
                          </div>
                          <div className="rounded-onboarding border border-onboarding-neutral-150 bg-onboarding-neutral-0 p-2.5 dark:border-onboarding-neutral-750 dark:bg-onboarding-neutral-900">
                            <dt className="text-xs text-onboarding-neutral-500 dark:text-onboarding-neutral-400">Replies</dt>
                            <dd className="mt-1.5 text-xl font-semibold">{formatNumber(overview.metrics.replies)}</dd>
                          </div>
                          <div className="rounded-onboarding border border-onboarding-neutral-150 bg-onboarding-neutral-0 p-2.5 dark:border-onboarding-neutral-750 dark:bg-onboarding-neutral-900">
                            <dt className="text-xs text-onboarding-neutral-500 dark:text-onboarding-neutral-400">Meetings</dt>
                            <dd className="mt-1.5 text-xl font-semibold">{formatNumber(overview.metrics.meetingsBooked)}</dd>
                          </div>
                        </dl>
                        <p className="mt-4 text-xs leading-5 text-onboarding-neutral-500 dark:text-onboarding-neutral-400">Counts reflect persisted workspace activity. Performance trends appear once campaigns begin running.</p>
                      </div>
                    </div>
                  </section>

                  <section className="overflow-hidden rounded-onboarding border border-onboarding-neutral-150 bg-onboarding-neutral-0 shadow-onboarding-small dark:border-onboarding-neutral-750 dark:bg-onboarding-neutral-900 xl:flex xl:min-h-0 xl:flex-1 xl:flex-col" aria-labelledby="activity-heading">
                    <div className="flex shrink-0 items-center justify-between border-b border-onboarding-neutral-150 px-6 py-3.5 dark:border-onboarding-neutral-750">
                      <div>
                        <h2 id="activity-heading" className="font-semibold">Recent activity</h2>
                        <p className="mt-1 text-sm text-onboarding-neutral-600 dark:text-onboarding-neutral-400">Latest recorded work across your workspace.</p>
                      </div>
                      <Clock3 className="size-4 text-onboarding-neutral-400" aria-hidden />
                    </div>
                    {overview.activity.length === 0 ? (
                      <div className="px-6 py-6 xl:flex xl:flex-1 xl:flex-col xl:justify-center">
                        <p className="text-sm font-medium">No activity yet</p>
                        <p className="mt-1 text-sm text-onboarding-neutral-600 dark:text-onboarding-neutral-400">Activity will appear after you add prospects or launch a campaign.</p>
                      </div>
                    ) : (
                      <ul className="min-h-0 divide-y divide-onboarding-neutral-150 dark:divide-onboarding-neutral-750 xl:flex-1 xl:overflow-y-auto">
                        {overview.activity.map((item) => (
                          <li key={item.id} className="flex gap-3 px-6 py-3.5">
                            <IconTile
                              icon={item.kind === "message" ? MessageSquare : item.kind === "prospect" ? Users : item.kind === "video" ? Video : Megaphone}
                              tone={item.kind === "message" ? "success" : item.kind === "video" ? "warning" : "brand"}
                              className="size-9"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium">{item.title}</p>
                              <p className="mt-1 truncate text-sm text-onboarding-neutral-600 dark:text-onboarding-neutral-400">{item.detail}</p>
                            </div>
                            <time className="shrink-0 text-xs text-onboarding-neutral-500 dark:text-onboarding-neutral-400" dateTime={item.occurredAt}>
                              {relativeTime(item.occurredAt)}
                            </time>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                </div>

                <aside className="space-y-6" aria-label="Workspace health">
                  <section className="overflow-hidden rounded-onboarding border border-onboarding-neutral-150 bg-onboarding-neutral-0 shadow-onboarding-small dark:border-onboarding-neutral-750 dark:bg-onboarding-neutral-900" aria-labelledby="channels-heading">
                    <div className="flex items-center justify-between">
                      <div className="flex items-start gap-3 p-5 pb-0">
                        <IconTile icon={Link2} tone="brand" className="size-9" />
                        <div>
                          <h2 id="channels-heading" className="font-semibold">Channel health</h2>
                          <p className="mt-1 text-sm text-onboarding-neutral-600 dark:text-onboarding-neutral-400">Accounts ready for outreach.</p>
                        </div>
                      </div>
                    </div>
                    {overview.channels.length === 0 ? (
                      <p className="px-5 py-5 text-sm text-onboarding-neutral-600 dark:text-onboarding-neutral-400">No channels connected.</p>
                    ) : (
                      <ul className="mt-5 divide-y divide-onboarding-neutral-150 dark:divide-onboarding-neutral-750">
                        {overview.channels.map((channel) => (
                          <li key={channel.id} className="flex items-center gap-3 px-5 py-4">
                            {isChannelLogoName(channel.platform) ? (
                              <DashboardChannelMark name={channel.platform} className="size-9" />
                            ) : (
                              <span className="inline-flex size-9 items-center justify-center text-onboarding-purple-600 dark:text-onboarding-purple-200">
                                {channel.platform === "email" ? <Mail className="size-4" aria-hidden /> : <Link2 className="size-4" aria-hidden />}
                              </span>
                            )}
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium">{titleCase(channel.platform)}</span>
                              <span className="block truncate text-xs text-onboarding-neutral-500 dark:text-onboarding-neutral-400">{channel.accountName}</span>
                            </span>
                            {channel.status === "active" ? <CheckCircle2 className="size-4 text-onboarding-success-500" aria-label="Active" /> : <CircleAlert className="size-4 text-onboarding-warning-500" aria-label={`${channel.status} status`} />}
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>

                  <section className="overflow-hidden rounded-onboarding border border-onboarding-neutral-150 bg-onboarding-neutral-0 shadow-onboarding-small dark:border-onboarding-neutral-750 dark:bg-onboarding-neutral-900" aria-labelledby="attention-heading">
                    <div className="flex items-center justify-between">
                      <div className="flex items-start gap-3 p-5 pb-0">
                        <IconTile icon={Gauge} tone="warning" className="size-9" />
                        <div>
                          <h2 id="attention-heading" className="font-semibold">Needs attention</h2>
                          <p className="mt-1 text-sm text-onboarding-neutral-600 dark:text-onboarding-neutral-400">Actions that need a decision.</p>
                        </div>
                      </div>
                    </div>
                    {overview.attention.length === 0 ? (
                      <p className="px-5 py-5 text-sm text-onboarding-neutral-600 dark:text-onboarding-neutral-400">Everything looks healthy right now.</p>
                    ) : (
                      <ul className="mt-5 divide-y divide-onboarding-neutral-150 dark:divide-onboarding-neutral-750">
                        {overview.attention.map((item) => (
                          <li key={`${item.kind}-${item.title}`} className="px-5 py-4">
                            <div className="flex items-start gap-3">
                              <IconTile
                                icon={item.kind === "campaign" ? Rocket : item.kind === "channels" ? Link2 : item.kind === "billing" ? CreditCard : Video}
                                tone={item.kind === "video" ? "warning" : "brand"}
                                className="mt-0.5 size-8"
                              />
                              <div>
                                <p className="text-sm font-medium">{item.title}</p>
                                <p className="mt-1 text-xs leading-5 text-onboarding-neutral-600 dark:text-onboarding-neutral-400">{item.detail}</p>
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>

                  <section className="rounded-onboarding border border-onboarding-purple-100 bg-onboarding-purple-50 p-5 dark:border-onboarding-purple-800 dark:bg-onboarding-purple-900/40" aria-labelledby="workspace-guidance-heading">
                    <div className="flex items-start gap-3">
                      <IconTile icon={HelpCircle} tone="brand" className="size-9" />
                      <div>
                        <h2 id="workspace-guidance-heading" className="text-sm font-semibold">Getting your engine running</h2>
                        <p className="mt-1.5 text-xs leading-5 text-onboarding-neutral-600 dark:text-onboarding-neutral-300">A campaign needs a connected channel, approved prospects, and a final launch decision.</p>
                      </div>
                    </div>
                  </section>
                </aside>
              </div>
            ) : null}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
