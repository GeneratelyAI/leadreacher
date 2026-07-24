"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Filter,
  Loader2,
  Megaphone,
  MessageSquare,
  Reply,
  Sparkles,
  Trophy,
  Users,
  Video,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { TruncatedWithTooltip } from "@/components/dashboard/dashboard-menu";
import { ChannelLogo } from "@/components/onboarding/ChannelLogo";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

function isChannelLogoName(value: string | undefined): value is "linkedin" | "whatsapp" {
  return value === "linkedin" || value === "whatsapp";
}

function ChannelMark({
  name,
  size = "default",
  className,
}: {
  name: "linkedin" | "whatsapp";
  size?: "default" | "badge";
  className?: string;
}) {
  const isLinkedIn = name === "linkedin";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-[0.3rem] text-white",
        size === "badge" ? "size-4" : "size-8",
        isLinkedIn ? "bg-[#0A66C2]" : "bg-[#25D366]",
        className,
      )}
      aria-hidden
    >
      <ChannelLogo name={name} className={size === "badge" ? "size-2.5" : "size-[62%]"} />
    </span>
  );
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
        {isChannelLogoName(item.channel) ? (
          <ChannelMark
            name={item.channel}
            size="badge"
            className="absolute -right-0.5 -bottom-0.5 border-2 border-onboarding-neutral-0 dark:border-onboarding-neutral-900"
          />
        ) : null}
      </span>
    );
  }

  if (isChannelLogoName(item.channel)) return <ChannelMark name={item.channel} />;

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

export function ActivityWorkspace() {
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
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<ActivitySummary | null>(null);
  const [campaigns, setCampaigns] = useState<Array<{ id: string; name: string }>>([]);
  const [channels, setChannels] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    const params = new URLSearchParams({
      kind,
      limit: String(PAGE_SIZE),
      offset: String((page - 1) * PAGE_SIZE),
    });
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    if (channelFilter) params.set("channel", channelFilter);
    if (campaignFilter) params.set("campaignId", campaignFilter);

    try {
      const result = await apiFetch<ActivityResponse>(`/dashboard/activity?${params.toString()}`);
      setActivity(result.activity);
      setTotal(result.total);
      setSummary(result.summary);
      setCampaigns(result.filters.campaigns);
      setChannels(result.filters.channels);
      setError(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load activity.");
    } finally {
      setIsLoading(false);
    }
  }, [campaignFilter, channelFilter, endDate, kind, page, startDate]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [kind, channelFilter, campaignFilter, startDate, endDate]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const dayGroups = useMemo(() => groupByDay(activity), [activity]);
  const filterLabel = campaignFilter
    ? campaigns.find((campaign) => campaign.id === campaignFilter)?.name ?? "Campaign"
    : channelFilter
      ? channelFilter
      : "Filter";

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
          <h2 className="text-sm font-semibold">{dayGroups[0]?.label ?? "Activity"}</h2>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button size="sm" variant="ghost" className="h-8 gap-1.5 px-2.5" />}>
              <Filter className="size-3.5" />
              <span className="max-w-40 truncate">{filterLabel}</span>
              <ChevronDown className="size-3.5 opacity-70" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-56">
              <DropdownMenuItem
                onClick={() => {
                  setChannelFilter("");
                  setCampaignFilter("");
                }}
              >
                All activity
                {!channelFilter && !campaignFilter ? <Check className="ml-auto size-3.5 shrink-0" aria-hidden /> : null}
              </DropdownMenuItem>
              {channels.map((channel) => (
                <DropdownMenuItem
                  key={channel}
                  onClick={() => {
                    setChannelFilter(channel);
                    setCampaignFilter("");
                  }}
                >
                  Channel: {channel}
                  {channelFilter === channel ? <Check className="ml-auto size-3.5 shrink-0" aria-hidden /> : null}
                </DropdownMenuItem>
              ))}
              {campaigns.map((campaign) => (
                <DropdownMenuItem
                  key={campaign.id}
                  onClick={() => {
                    setCampaignFilter(campaign.id);
                    setChannelFilter("");
                  }}
                >
                  <TruncatedWithTooltip text={campaign.name} />
                  {campaignFilter === campaign.id ? <Check className="ml-auto size-3.5 shrink-0" aria-hidden /> : null}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {isLoading ? (
          <div className="flex min-h-44 items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 size-4 animate-spin" /> Loading activity
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
                              {item.title}
                            </p>
                            <p className="mt-0.5 truncate text-sm text-onboarding-neutral-600 dark:text-onboarding-neutral-400">
                              {item.detail}
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
