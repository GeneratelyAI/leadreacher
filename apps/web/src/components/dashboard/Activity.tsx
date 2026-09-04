"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Megaphone,
  MessageSquare,
  Reply,
  Sparkles,
  Trophy,
  Users,
  Video,
} from "@/components/ui/icons";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { channelDisplayName, DashboardChannelLogo, formatSocialMediaNames } from "@/components/dashboard/ChannelIdentity";
import { Filter, type FilterGroup } from "@/components/dashboard/Filter";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Loading } from "@/components/ui/Loading";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 10;

type ActivityKind = "message" | "prospect" | "video" | "campaign";
type ActivityTab = "all" | ActivityKind;

type ActivityTrend = {
  direction: "up" | "down" | "flat" | "new";
  percent: number | null;
};

type ActivityItem = {
  id: string;
  kind: ActivityKind;
  title: string;
  detail: string;
  occurredAt: string;
  avatarUrl?: string | null;
  channel?: string;
  action?: "reply" | "view";
  href?: string;
};

type ActivitySummary = {
  totalActivities: number;
  messagesSent: number;
  repliesReceived: number;
  meetingsBooked: number;
  videosSent: number;
  trends: Record<keyof Omit<ActivitySummary, "trends">, ActivityTrend>;
};

type ActivityResponse = {
  activity: ActivityItem[];
  total: number;
  limit: number;
  offset: number;
  summary: ActivitySummary;
  filters: {
    campaigns: Array<{ id: string; name: string }>;
    channels: string[];
  };
  range: { startDate: string; endDate: string };
};

type DayGroup = {
  key: string;
  label: string;
  items: ActivityItem[];
};

const KIND_TABS: Array<{ value: ActivityTab; label: string }> = [
  { value: "all", label: "All Activity" },
  { value: "message", label: "Messages" },
  { value: "prospect", label: "Prospects" },
  { value: "campaign", label: "Campaigns" },
  { value: "video", label: "Videos" },
];

const KPI_CARDS: Array<{
  key: keyof Omit<ActivitySummary, "trends">;
  label: string;
  icon: typeof Sparkles;
}> = [
  { key: "totalActivities", label: "Total activities", icon: Sparkles },
  { key: "messagesSent", label: "Messages sent", icon: MessageSquare },
  { key: "repliesReceived", label: "Replies received", icon: Reply },
  { key: "meetingsBooked", label: "Meetings booked", icon: CalendarDays },
  { key: "videosSent", label: "Videos sent", icon: Video },
];

function formatNumber(value: number): string {
  return new Intl.NumberFormat().format(value);
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "?";
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

function dayKey(value: string): string {
  return new Date(value).toISOString().slice(0, 10);
}

function dayLabel(key: string): string {
  const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);
  const yesterday = new Date(today);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const yesterdayKey = yesterday.toISOString().slice(0, 10);
  if (key === todayKey) return "Today";
  if (key === yesterdayKey) return "Yesterday";
  return new Intl.DateTimeFormat(undefined, { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${key}T00:00:00.000Z`),
  );
}

function groupByDay(items: ActivityItem[]): DayGroup[] {
  const groups = new Map<string, ActivityItem[]>();
  for (const item of items) {
    const key = dayKey(item.occurredAt);
    const bucket = groups.get(key) ?? [];
    bucket.push(item);
    groups.set(key, bucket);
  }
  return [...groups.entries()].map(([key, groupItems]) => ({
    key,
    label: dayLabel(key),
    items: groupItems,
  }));
}

function ActivityMark({ item }: { item: ActivityItem }) {
  if (item.avatarUrl) {
    return (
      <span className="relative size-9 shrink-0" aria-hidden>
        <Avatar size="default">
          <AvatarImage src={item.avatarUrl} alt="" />
          <AvatarFallback className="bg-onboarding-purple-100 text-onboarding-purple-700 dark:bg-onboarding-purple-900 dark:text-onboarding-purple-100">
            {initials(item.title)}
          </AvatarFallback>
        </Avatar>
        {item.channel ? (
          <DashboardChannelLogo platform={item.channel} className="absolute -right-0.5 -bottom-0.5 size-4 rounded-sm border-2 border-onboarding-neutral-0 dark:border-onboarding-neutral-900" />
        ) : null}
      </span>
    );
  }

  if (item.channel) return <DashboardChannelLogo platform={item.channel} className="size-8" />;

  if (item.kind === "campaign") {
    return <Trophy className="size-5 shrink-0 text-onboarding-purple-600 dark:text-onboarding-purple-200" aria-hidden />;
  }
  if (item.kind === "video") {
    return <Sparkles className="size-5 shrink-0 text-onboarding-purple-600 dark:text-onboarding-purple-200" aria-hidden />;
  }
  if (item.kind === "prospect") {
    return <Users className="size-5 shrink-0 text-onboarding-purple-600 dark:text-onboarding-purple-200" aria-hidden />;
  }
  return <Megaphone className="size-5 shrink-0 text-onboarding-purple-600 dark:text-onboarding-purple-200" aria-hidden />;
}

function TrendLine({ trend }: { trend: ActivityTrend }) {
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

export function Activity() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const startDate = searchParams.get("startDate") ?? "";
  const endDate = searchParams.get("endDate") ?? "";

  const [kind, setKind] = useState<ActivityTab>(() => {
    const value = searchParams.get("kind");
    if (value === "message" || value === "prospect" || value === "video" || value === "campaign") return value;
    return "all";
  });
  const [page, setPage] = useState(1);
  const [channelFilter, setChannelFilter] = useState("");
  const [campaignFilter, setCampaignFilter] = useState(() => searchParams.get("campaignId") ?? "");
  const activityParams = useMemo(() => {
    const params = new URLSearchParams({
      kind,
      limit: String(PAGE_SIZE),
      offset: String((page - 1) * PAGE_SIZE),
    });
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    if (channelFilter) params.set("channel", channelFilter);
    if (campaignFilter) params.set("campaignId", campaignFilter);
    return params.toString();
  }, [campaignFilter, channelFilter, endDate, kind, page, startDate]);
  const activityQuery = useQuery({
    queryKey: ["dashboard", "activity", activityParams],
    queryFn: () => apiFetch<ActivityResponse>(`/dashboard/activity?${activityParams}`),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
  const activity = useMemo(() => activityQuery.data?.activity ?? [], [activityQuery.data?.activity]);
  const total = activityQuery.data?.total ?? 0;
  const summary = activityQuery.data?.summary ?? null;
  const campaigns = activityQuery.data?.filters.campaigns ?? [];
  const channels = activityQuery.data?.filters.channels ?? [];
  const isLoading = activityQuery.isLoading && !activityQuery.data;
  const isRefreshing = activityQuery.isFetching && !!activityQuery.data;
  const error = activityQuery.error instanceof Error ? activityQuery.error.message : null;

  useEffect(() => {
    setPage(1);
  }, [kind, channelFilter, campaignFilter, startDate, endDate]);

  useEffect(() => {
    if (total <= page * PAGE_SIZE) return;
    const nextParams = new URLSearchParams(activityParams);
    nextParams.set("offset", String(page * PAGE_SIZE));
    const nextPageParams = nextParams.toString();
    void queryClient.prefetchQuery({
      queryKey: ["dashboard", "activity", nextPageParams],
      queryFn: () => apiFetch<ActivityResponse>(`/dashboard/activity?${nextPageParams}`),
      staleTime: 30_000,
    });
  }, [activityParams, page, queryClient, total]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const dayGroups = useMemo(() => groupByDay(activity), [activity]);
  const selectedFilter = campaignFilter ? `campaign:${campaignFilter}` : channelFilter ? `channel:${channelFilter}` : "";
  const filterGroups: FilterGroup[] = [
    {
      label: "Channels",
      options: channels.map((channel) => ({
        value: `channel:${channel}`,
        label: channelDisplayName(channel),
        icon: <DashboardChannelLogo platform={channel} className="size-6" />,
      })),
    },
    {
      label: "Campaigns",
      options: campaigns.map((campaign) => ({
        value: `campaign:${campaign.id}`,
        label: formatSocialMediaNames(campaign.name),
      })),
    },
  ].filter((group) => group.options.length > 0);

  function setVisualFilter(next: string) {
    if (!next) {
      setChannelFilter("");
      setCampaignFilter("");
      return;
    }
    if (next.startsWith("channel:")) {
      setChannelFilter(next.slice("channel:".length));
      setCampaignFilter("");
      return;
    }
    setCampaignFilter(next.slice("campaign:".length));
    setChannelFilter("");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-semibold tracking-tight">Activity</h1>
            <span className="size-2 rounded-full bg-onboarding-success-500" aria-hidden />
          </div>
          <p className="mt-2 max-w-2xl text-sm text-onboarding-neutral-600 dark:text-onboarding-neutral-400">
            A live feed of outreach, replies, prospect changes, and campaign events across your workspace.
          </p>
        </div>

        <Tabs value={kind} onValueChange={(value) => setKind(value as ActivityTab)}>
          <TabsList className="h-auto flex-wrap justify-start gap-1 bg-transparent p-0">
            {KIND_TABS.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm data-[state=active]:bg-onboarding-purple-50 data-[state=active]:text-onboarding-purple-700 data-[state=active]:shadow-none",
                  "dark:data-[state=active]:bg-onboarding-purple-900 dark:data-[state=active]:text-onboarding-purple-100",
                )}
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {error ? (
        <div
          className="rounded-lg border border-onboarding-error-200 bg-onboarding-error-50 px-4 py-3 text-sm text-onboarding-error-700 dark:border-onboarding-error-500/40 dark:bg-onboarding-error-500/15 dark:text-onboarding-error-100"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {KPI_CARDS.map(({ key, label, icon: Icon }) => {
          const value = summary?.[key] ?? 0;
          const trend = summary?.trends[key];
          return (
            <Card key={key} className="overflow-hidden">
              <CardContent className="flex items-center gap-3.5 p-4 sm:gap-4 sm:p-5">
                <Icon
                  className="size-5 shrink-0 text-onboarding-purple-600 sm:size-6 dark:text-onboarding-purple-200"
                  strokeWidth={1.75}
                  aria-hidden
                />
                <div className="min-w-0">
                  <p className="text-2xl font-semibold tracking-tight">{formatNumber(value)}</p>
                  <p className="mt-1 text-sm text-onboarding-neutral-600 dark:text-onboarding-neutral-400">{label}</p>
                  {trend ? <TrendLine trend={trend} /> : null}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
          <div className="flex items-center gap-2"><h2 className="text-sm font-semibold">{dayGroups[0]?.label ?? "Activity"}</h2>{isRefreshing ? <span className="text-xs text-muted-foreground">Updating…</span> : null}</div>
          <Filter
            value={selectedFilter}
            groups={filterGroups}
            onValueChange={setVisualFilter}
            allLabel="All activity"
            aria-label="Filter activity"
          />
        </div>

        {isLoading ? (
          <div className="flex min-h-44 flex-col items-center justify-center text-sm text-muted-foreground">
            <Loading tone="brand" label="Loading activity" className="-mb-4" />
            <span>Loading activity</span>
          </div>
        ) : activity.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <MessageSquare className="mx-auto size-8 text-muted-foreground" />
            <h3 className="mt-3 font-semibold">No activity yet</h3>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              Activity will appear after prospects are added, campaigns are updated, or outreach begins.
            </p>
          </div>
        ) : (
          <div>
            {dayGroups.map((group, groupIndex) => (
              <section key={group.key} aria-labelledby={`activity-day-${group.key}`}>
                {groupIndex > 0 ? (
                  <div className="border-t border-border bg-muted/30 px-4 py-2 sm:px-5">
                    <h3 id={`activity-day-${group.key}`} className="text-sm font-semibold">
                      {group.label}
                    </h3>
                  </div>
                ) : (
                  <h3 id={`activity-day-${group.key}`} className="sr-only">
                    {group.label}
                  </h3>
                )}
                <ul className="divide-y divide-border">
                  {group.items.map((item) => {
                    const href = item.href ?? "/dashboard/activity";
                    const actionLabel = item.action === "reply" ? "Reply" : "View";
                    return (
                      <li key={item.id}>
                        <div className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
                          <ActivityMark item={item} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-onboarding-ink dark:text-onboarding-neutral-0">
                              {formatSocialMediaNames(item.title)}
                            </p>
                            <p className="mt-0.5 truncate text-sm text-onboarding-neutral-600 dark:text-onboarding-neutral-400">
                              {formatSocialMediaNames(item.detail)}
                            </p>
                          </div>
                          <time
                            dateTime={item.occurredAt}
                            className="hidden shrink-0 text-xs text-onboarding-neutral-500 sm:block dark:text-onboarding-neutral-400"
                          >
                            {relativeTime(item.occurredAt)}
                          </time>
                          <Button asChild variant="outline" size="sm" className="shrink-0">
                            <Link href={href}>{actionLabel}</Link>
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3 text-xs text-muted-foreground sm:px-5">
          <span>
            Showing {total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1} to {Math.min(page * PAGE_SIZE, total)} of{" "}
            {total.toLocaleString()} activities
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              disabled={page <= 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              aria-label="Previous page"
            >
              <ChevronLeft />
            </Button>
            <span className="px-1 font-medium text-foreground">
              {page}/{pageCount}
            </span>
            <Button
              variant="ghost"
              size="icon"
              disabled={page >= pageCount}
              onClick={() => setPage((value) => Math.min(pageCount, value + 1))}
              aria-label="Next page"
            >
              <ChevronRight />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
