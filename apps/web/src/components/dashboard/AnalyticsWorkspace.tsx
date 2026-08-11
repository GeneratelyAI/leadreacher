"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  CalendarDays,
  Check,
  ChevronDown,
  Download,
  Info,
  Loader2,
  Reply,
  Send,
  UserPlus,
} from "lucide-react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Area, AreaChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { ChannelFilterMenu } from "@/components/dashboard/ChannelFilterMenu";
import { TruncatedWithTooltip } from "@/components/dashboard/dashboard-menu";
import { channelDisplayName, DashboardChannelLogo, groupEmailChannelMetrics } from "@/components/dashboard/ChannelIdentity";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DataTable, type DataTableColumn } from "@/components/patterns/StatTable";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

type Trend = {
  direction: "up" | "down" | "flat" | "new";
  percent: number | null;
};

type AnalyticsSummary = {
  messagesSent: number;
  repliesReceived: number;
  replyRate: number;
  meetingsBooked: number;
  prospectsReached: number;
  trends: Record<keyof Omit<AnalyticsSummary, "trends">, Trend>;
};

type ActivityPoint = {
  date: string;
  messagesSent: number;
  repliesReceived: number;
  meetingsBooked: number;
  replyRate: number;
};

type ChannelRow = {
  channel: string;
  messagesSent: number;
  replies: number;
  replyRate: number;
  meetingsBooked: number;
};

type CampaignRow = {
  id: string;
  name: string;
  messagesSent: number;
  replies: number;
  replyRate: number;
  meetingsBooked: number;
};

type AnalyticsResponse = {
  summary: AnalyticsSummary;
  activityTrend: ActivityPoint[];
  replyRateTrend: Array<{ date: string; replyRate: number }>;
  channels: ChannelRow[];
  campaigns: CampaignRow[];
  filters: {
    campaigns: Array<{ id: string; name: string }>;
    channels: string[];
  };
  range: { startDate: string; endDate: string };
  granularity: "day" | "week";
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

const ACTIVITY_CHART_CONFIG: ChartConfig = {
  messagesSent: { label: "Messages sent", color: "#5326b7" },
  repliesReceived: { label: "Replies received", color: "#2563eb" },
  meetingsBooked: { label: "Meetings booked", color: "#16a34a" },
};

const REPLY_RATE_CHART_CONFIG: ChartConfig = {
  replyRate: { label: "Reply rate", color: "#5326b7" },
};

const KPI_CARDS: Array<{
  key: keyof Omit<AnalyticsSummary, "trends">;
  label: string;
  icon: typeof Send;
  format?: "percent";
  ratePoints?: boolean;
}> = [
  { key: "messagesSent", label: "Messages sent", icon: Send },
  { key: "repliesReceived", label: "Replies received", icon: Reply },
  { key: "replyRate", label: "Reply rate", icon: Reply, format: "percent", ratePoints: true },
  { key: "meetingsBooked", label: "Meetings booked", icon: CalendarDays },
  { key: "prospectsReached", label: "Prospects reached", icon: UserPlus },
];

function formatNumber(value: number): string {
  return new Intl.NumberFormat().format(value);
}

function formatChartDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", timeZone: "UTC" }).format(
    new Date(`${value}T00:00:00.000Z`),
  );
}

function TrendLine({ trend, ratePoints }: { trend?: Trend; ratePoints?: boolean }) {
  if (!trend) return null;
  const label =
    trend.direction === "new"
      ? "New vs last period"
      : trend.direction === "flat"
        ? "No change vs last period"
        : ratePoints
          ? `${trend.percent ?? 0}pp vs last period`
          : `${trend.percent ?? 0}% vs last period`;

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

function MiniBar({ value, max, tone }: { value: number; max: number; tone: "green" | "purple" }) {
  const width = max > 0 ? Math.max(8, Math.round((value / max) * 100)) : 0;
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="w-8 shrink-0 text-right text-sm font-medium">{formatNumber(value)}</span>
      <span className="h-2 min-w-16 flex-1 overflow-hidden rounded-full bg-onboarding-neutral-100 dark:bg-onboarding-neutral-800">
        <span
          className={cn(
            "block h-full rounded-full",
            tone === "green" ? "bg-onboarding-success-500" : "bg-onboarding-purple-500",
          )}
          style={{ width: `${width}%` }}
        />
      </span>
    </div>
  );
}

function ChannelPerformanceTable({ rows, totals, maxMeetings }: { rows: ChannelRow[]; totals: Omit<ChannelRow, "channel">; maxMeetings: number }) {
  const grouped = useMemo(() => groupEmailChannelMetrics(rows), [rows]);
  return (
    <>
      <div className="hidden flex-1 overflow-x-auto lg:block lg:[&>[data-slot=table-container]]:h-full">
        <Table className="h-full">
          <TableHeader><TableRow><TableHead>Channel</TableHead><TableHead className="text-right">Messages sent</TableHead><TableHead className="text-right">Replies</TableHead><TableHead className="text-right">Reply rate</TableHead><TableHead>Meetings booked</TableHead></TableRow></TableHeader>
          {grouped.rows.map((row) => {
            const expandable = row.channel === "email" && grouped.emailProviders.length > 0;
            return (
              <TableBody key={row.channel} className={cn(expandable && "group/email")}>
                <TableRow tabIndex={expandable ? 0 : undefined} className={cn(expandable && "cursor-default focus-visible:bg-muted/50 focus-visible:outline-none")}>
                  <TableCell><span className="flex items-center gap-2 font-medium"><DashboardChannelLogo platform={row.channel} className="size-8" />{channelDisplayName(row.channel)}{expandable ? <ChevronDown className="ml-1 size-3.5 text-muted-foreground transition-transform duration-300 group-hover/email:rotate-180 group-focus-within/email:rotate-180" aria-hidden /> : null}</span></TableCell>
                  <TableCell className="text-right">{formatNumber(row.messagesSent)}</TableCell><TableCell className="text-right">{formatNumber(row.replies)}</TableCell><TableCell className="text-right">{row.replyRate}%</TableCell><TableCell><MiniBar value={row.meetingsBooked} max={maxMeetings} tone="green" /></TableCell>
                </TableRow>
                {expandable ? (
                  <TableRow className="border-0 hover:bg-transparent"><TableCell colSpan={5} className="p-0"><div className="max-h-0 overflow-hidden bg-muted/20 opacity-0 transition-[max-height,opacity] duration-300 ease-out group-hover/email:max-h-32 group-hover/email:opacity-100 group-focus-within/email:max-h-32 group-focus-within/email:opacity-100">{grouped.emailProviders.map((provider) => <div key={provider.channel} className="grid grid-cols-[minmax(10rem,1fr)_7rem_5rem_6rem_minmax(8rem,1fr)] items-center border-t border-app-border px-2 py-2 text-sm"><span className="flex items-center gap-2 pl-5 font-medium"><DashboardChannelLogo platform={provider.channel} className="size-6" />{channelDisplayName(provider.channel)}</span><span className="text-right">{formatNumber(provider.messagesSent)}</span><span className="text-right">{formatNumber(provider.replies)}</span><span className="text-right">{provider.replyRate}%</span><MiniBar value={provider.meetingsBooked} max={maxMeetings} tone="green" /></div>)}</div></TableCell></TableRow>
                ) : null}
              </TableBody>
            );
          })}
          <TableFooter><TableRow><TableCell>Total</TableCell><TableCell className="text-right">{formatNumber(totals.messagesSent)}</TableCell><TableCell className="text-right">{formatNumber(totals.replies)}</TableCell><TableCell className="text-right">{totals.replyRate}%</TableCell><TableCell><MiniBar value={totals.meetingsBooked} max={maxMeetings} tone="green" /></TableCell></TableRow></TableFooter>
        </Table>
      </div>
      <ul className="divide-y divide-border lg:hidden">{grouped.rows.map((row) => <li key={row.channel} className="px-4 py-3.5"><div className="flex items-center gap-2 font-medium"><DashboardChannelLogo platform={row.channel} />{channelDisplayName(row.channel)}</div><dl className="mt-2 grid grid-cols-2 gap-2 text-sm"><div><dt className="text-muted-foreground">Sent</dt><dd>{formatNumber(row.messagesSent)}</dd></div><div><dt className="text-muted-foreground">Replies</dt><dd>{formatNumber(row.replies)}</dd></div><div><dt className="text-muted-foreground">Reply rate</dt><dd>{row.replyRate}%</dd></div><div><dt className="text-muted-foreground">Meetings</dt><dd>{formatNumber(row.meetingsBooked)}</dd></div></dl>{row.channel === "email" ? <div className="mt-3 grid grid-cols-2 gap-2">{grouped.emailProviders.map((provider) => <div key={provider.channel} className="rounded-md bg-muted/40 p-2 text-xs"><span className="flex items-center gap-1.5 font-medium"><DashboardChannelLogo platform={provider.channel} className="size-4" />{channelDisplayName(provider.channel)}</span><span className="mt-1 block text-muted-foreground">{provider.messagesSent} sent · {provider.replies} replies</span></div>)}</div> : null}</li>)}</ul>
    </>
  );
}

function InsightPanel({ title, items, empty }: { title: string; items: ReactNode[]; empty: string }) {
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-border px-5 py-4">
        <h3 className="font-semibold">{title}</h3>
      </div>
      {items.length === 0 ? (
        <div className="px-5 py-8 text-sm text-muted-foreground">{empty}</div>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((item, index) => (
            <li key={index} className="px-5 py-4">
              {item}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function downloadCsv(filename: string, rows: string[][]) {
  const content = rows
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function AnalyticsWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const startDate = searchParams.get("startDate") ?? "";
  const endDate = searchParams.get("endDate") ?? "";
  const channelsParam = searchParams.get("channels") ?? "";
  const campaignIdParam = searchParams.get("campaignId") ?? "";

  const selectedChannels = useMemo(
    () =>
      [...new Set(channelsParam.split(",").map((value) => value.trim()).filter(Boolean))],
    [channelsParam],
  );

  const [campaignFilter, setCampaignFilter] = useState(campaignIdParam);
  const [granularity, setGranularity] = useState<"day" | "week">("day");

  useEffect(() => {
    setCampaignFilter(campaignIdParam);
  }, [campaignIdParam]);

  const setSelectedChannels = useCallback(
    (next: string[]) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next.length === 0) params.delete("channels");
      else params.set("channels", next.join(","));
      const query = params.toString();
      router.replace(query ? `/dashboard/analytics?${query}` : "/dashboard/analytics");
    },
    [router, searchParams],
  );

  const setCampaignFilterAndUrl = useCallback(
    (next: string) => {
      setCampaignFilter(next);
      const params = new URLSearchParams(searchParams.toString());
      if (!next) params.delete("campaignId");
      else params.set("campaignId", next);
      const query = params.toString();
      router.replace(query ? `/dashboard/analytics?${query}` : "/dashboard/analytics");
    },
    [router, searchParams],
  );

  const analyticsParams = useMemo(() => {
    const params = new URLSearchParams({ granularity });
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    if (campaignFilter) params.set("campaignId", campaignFilter);
    if (selectedChannels.length === 1) params.set("channels", selectedChannels[0] ?? "");
    else if (selectedChannels.length > 1) params.set("channels", selectedChannels.join(","));
    return params.toString();
  }, [campaignFilter, endDate, granularity, selectedChannels, startDate]);
  const analyticsQuery = useQuery({
    queryKey: ["dashboard", "analytics", analyticsParams],
    queryFn: () => apiFetch<AnalyticsResponse>(`/dashboard/analytics?${analyticsParams}`),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
  const insightsQuery = useQuery({
    queryKey: ["dashboard", "analytics-insights"],
    queryFn: () => apiFetch<AnalyticsInsights>("/dashboard/analytics/insights"),
    staleTime: 30_000,
    refetchInterval: (query) => query.state.data?.status === "aggregating" ? 2_500 : false,
  });
  const analytics = analyticsQuery.data ?? null;
  const insights = insightsQuery.data ?? null;
  const isLoading = analyticsQuery.isLoading && !analyticsQuery.data;
  const isRefreshing = analyticsQuery.isFetching && !!analyticsQuery.data;
  const error = analyticsQuery.error instanceof Error ? analyticsQuery.error.message : null;

  const maxChannelMeetings = useMemo(
    () => Math.max(0, ...(analytics?.channels.map((row) => row.meetingsBooked) ?? [0])),
    [analytics],
  );
  const maxCampaignMeetings = useMemo(
    () => Math.max(0, ...(analytics?.campaigns.map((row) => row.meetingsBooked) ?? [0])),
    [analytics],
  );

  const channelTotals = useMemo(() => {
    const rows = analytics?.channels ?? [];
    const messagesSent = rows.reduce((sum, row) => sum + row.messagesSent, 0);
    const replies = rows.reduce((sum, row) => sum + row.replies, 0);
    const meetingsBooked = rows.reduce((sum, row) => sum + row.meetingsBooked, 0);
    return {
      messagesSent,
      replies,
      replyRate: messagesSent === 0 ? 0 : Math.round((replies / messagesSent) * 1000) / 10,
      meetingsBooked,
    };
  }, [analytics]);

  const campaignColumns: DataTableColumn<CampaignRow>[] = [
    {
      key: "name",
      header: "Campaign",
      isLabel: true,
      className: "max-w-48 truncate",
      render: (row) => row.name,
    },
    { key: "messagesSent", header: "Messages sent", align: "right", render: (row) => formatNumber(row.messagesSent) },
    { key: "replies", header: "Replies", align: "right", render: (row) => formatNumber(row.replies) },
    { key: "replyRate", header: "Reply rate", align: "right", render: (row) => `${row.replyRate}%` },
    {
      key: "meetingsBooked",
      header: "Meetings booked",
      render: (row) => <MiniBar value={row.meetingsBooked} max={maxCampaignMeetings} tone="purple" />,
    },
  ];

  function exportReport() {
    if (!analytics) return;
    const rows: string[][] = [
      ["Metric", "Value"],
      ["Messages sent", String(analytics.summary.messagesSent)],
      ["Replies received", String(analytics.summary.repliesReceived)],
      ["Reply rate", `${analytics.summary.replyRate}%`],
      ["Meetings booked", String(analytics.summary.meetingsBooked)],
      ["Prospects reached", String(analytics.summary.prospectsReached)],
      [],
      ["Channel", "Messages sent", "Replies", "Reply rate", "Meetings booked"],
      ...analytics.channels.map((row) => [
        row.channel,
        String(row.messagesSent),
        String(row.replies),
        `${row.replyRate}%`,
        String(row.meetingsBooked),
      ]),
      [],
      ["Campaign", "Messages sent", "Replies", "Reply rate", "Meetings booked"],
      ...analytics.campaigns.map((row) => [
        row.name,
        String(row.messagesSent),
        String(row.replies),
        `${row.replyRate}%`,
        String(row.meetingsBooked),
      ]),
    ];
    downloadCsv(`leadreacher-analytics-${analytics.range.startDate}-to-${analytics.range.endDate}.csv`, rows);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-semibold tracking-tight">Analytics</h1>
            <Tooltip>
              <TooltipTrigger render={<span className="size-2 rounded-full bg-onboarding-success-500" aria-label="Live analytics" />} />
              <TooltipContent>Based on persisted messages and lead lifecycle data</TooltipContent>
            </Tooltip>
          </div>
          <p className="mt-2 max-w-2xl text-sm text-onboarding-neutral-600 dark:text-onboarding-neutral-400">
            Factual delivery and reply totals based on persisted messages and lead lifecycle data.
          </p>
        </div>
        <Button variant="secondary" onClick={exportReport} disabled={!analytics || isLoading}>
          <Download /> Export report
        </Button>
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
        {KPI_CARDS.map(({ key, label, icon: Icon, format, ratePoints }) => {
          const value = analytics?.summary[key] ?? 0;
          const display = format === "percent" ? `${value}%` : formatNumber(value);
          return (
            <Card key={key}>
              <CardContent className="flex items-center gap-3.5 p-4 sm:gap-4 sm:p-5">
                <Icon
                  className="size-5 shrink-0 text-onboarding-purple-600 sm:size-6 dark:text-onboarding-purple-200"
                  strokeWidth={1.75}
                  aria-hidden
                />
                <div className="min-w-0">
                  <p className="text-2xl font-semibold tracking-tight">{isLoading ? "-" : display}</p>
                  <p className="mt-1 text-sm text-onboarding-neutral-600 dark:text-onboarding-neutral-400">{label}</p>
                  <TrendLine trend={analytics?.summary.trends[key]} ratePoints={ratePoints} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <div className="flex flex-wrap items-end gap-3">
        {isRefreshing ? <span className="text-xs text-muted-foreground" aria-live="polite">Updating analytics…</span> : null}
        <div className="flex min-w-44 flex-col gap-1.5">
          <span className="text-xs font-medium text-onboarding-neutral-600 dark:text-onboarding-neutral-400">
            Campaign
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="outline"
                  className="h-9 w-full min-w-44 justify-between gap-2 px-3 font-normal"
                  aria-label="Filter by campaign"
                />
              }
            >
              <span className="min-w-0 truncate">
                {campaignFilter
                  ? analytics?.filters.campaigns.find((campaign) => campaign.id === campaignFilter)?.name ?? "All campaigns"
                  : "All campaigns"}
              </span>
              <ChevronDown className="size-4 shrink-0 opacity-70" aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-56">
              <DropdownMenuItem onClick={() => setCampaignFilterAndUrl("")}>
                All campaigns
                {!campaignFilter ? <Check className="ml-auto size-3.5 shrink-0" aria-hidden /> : null}
              </DropdownMenuItem>
              {(analytics?.filters.campaigns ?? []).map((campaign) => (
                <DropdownMenuItem
                  key={campaign.id}
                  onClick={() => setCampaignFilterAndUrl(campaign.id)}
                >
                  <TruncatedWithTooltip text={campaign.name} />
                  {campaignFilter === campaign.id ? <Check className="ml-auto size-3.5 shrink-0" aria-hidden /> : null}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex min-w-40 flex-col gap-1.5">
          <span className="text-xs font-medium text-onboarding-neutral-600 dark:text-onboarding-neutral-400">
            Channels
          </span>
          <ChannelFilterMenu
            options={analytics?.filters.channels ?? []}
            value={selectedChannels}
            onChange={setSelectedChannels}
          />
        </div>

        <div className="flex min-w-36 flex-col gap-1.5">
          <span className="text-xs font-medium text-onboarding-neutral-600 dark:text-onboarding-neutral-400">
            Time duration
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="outline"
                  className="h-9 w-full min-w-36 justify-between gap-2 px-3 font-normal"
                  aria-label="Chart time duration"
                />
              }
            >
              <span>{granularity === "week" ? "Weekly" : "Daily"}</span>
              <ChevronDown className="size-4 shrink-0 opacity-70" aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-36">
              <DropdownMenuItem onClick={() => setGranularity("day")}>
                Daily
                {granularity === "day" ? <Check className="ml-auto size-3.5 shrink-0" aria-hidden /> : null}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setGranularity("week")}>
                Weekly
                {granularity === "week" ? <Check className="ml-auto size-3.5 shrink-0" aria-hidden /> : null}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {isLoading && !analytics ? (
        <Card>
          <CardContent className="flex min-h-48 items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 size-4 animate-spin" /> Loading analytics
          </CardContent>
        </Card>
      ) : analytics ? (
        <>
          <div className="grid gap-5 xl:grid-cols-2">
            <Card className="overflow-hidden">
              <div className="border-b border-border px-5 py-4">
                <h2 className="font-semibold">Activity over time</h2>
                <p className="mt-1 text-sm text-muted-foreground">Messages, replies, and meetings in the selected range.</p>
              </div>
              <CardContent className="px-3 pt-4 pb-5 sm:px-5">
                <ChartContainer config={ACTIVITY_CHART_CONFIG} className="h-64 w-full aspect-auto">
                  <LineChart data={analytics.activityTrend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      minTickGap={24}
                      tickFormatter={(value) => formatChartDate(String(value))}
                    />
                    <YAxis tickLine={false} axisLine={false} width={36} />
                    <ChartTooltip
                      cursor={false}
                      content={<ChartTooltipContent indicator="line" labelFormatter={(value) => formatChartDate(String(value))} />}
                    />
                    <Line type="monotone" dataKey="messagesSent" stroke="var(--color-messagesSent)" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="repliesReceived" stroke="var(--color-repliesReceived)" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="meetingsBooked" stroke="var(--color-meetingsBooked)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card className="overflow-hidden">
              <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
                <div>
                  <h2 className="font-semibold">Reply rate</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Inbound replies as a share of outbound messages.</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-semibold">{analytics.summary.replyRate}%</p>
                  <TrendLine trend={analytics.summary.trends.replyRate} ratePoints />
                </div>
              </div>
              <CardContent className="px-3 pt-4 pb-5 sm:px-5">
                <ChartContainer config={REPLY_RATE_CHART_CONFIG} className="h-64 w-full aspect-auto">
                  <AreaChart data={analytics.replyRateTrend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="analytics-reply-rate-fill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--color-replyRate)" stopOpacity={0.22} />
                        <stop offset="100%" stopColor="var(--color-replyRate)" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      minTickGap={24}
                      tickFormatter={(value) => formatChartDate(String(value))}
                    />
                    <YAxis tickLine={false} axisLine={false} width={36} domain={[0, "auto"]} tickFormatter={(value) => `${value}%`} />
                    <ChartTooltip
                      cursor={false}
                      content={<ChartTooltipContent indicator="line" labelFormatter={(value) => formatChartDate(String(value))} />}
                    />
                    <Area type="monotone" dataKey="replyRate" stroke="var(--color-replyRate)" fill="url(#analytics-reply-rate-fill)" strokeWidth={2} dot={false} />
                  </AreaChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <Card className="flex h-full flex-col overflow-hidden">
              <div className="border-b border-border px-5 py-4">
                <h2 className="font-semibold">Performance by channel</h2>
              </div>
              {analytics.channels.length === 0 ? (
                <div className="px-5 py-10 text-sm text-muted-foreground">No delivery data in this range.</div>
              ) : (
                <ChannelPerformanceTable rows={analytics.channels} totals={channelTotals} maxMeetings={maxChannelMeetings} />
              )}
            </Card>

            <Card className="overflow-hidden">
              <div className="border-b border-border px-5 py-4">
                <h2 className="font-semibold">Top campaigns</h2>
              </div>
              {analytics.campaigns.length === 0 ? (
                <div className="px-5 py-10 text-sm text-muted-foreground">No campaign activity in this range.</div>
              ) : (
                <>
                  <DataTable
                    columns={campaignColumns}
                    data={analytics.campaigns}
                    getRowKey={(row) => row.id}
                  />
                  <div className="border-t border-border px-5 py-3">
                    <Link
                      href="/dashboard/campaigns"
                      className="inline-flex items-center gap-1.5 text-sm font-semibold text-onboarding-purple-600 hover:text-onboarding-purple-700 dark:text-onboarding-purple-200"
                    >
                      View all campaigns <ArrowRight className="size-3.5" aria-hidden />
                    </Link>
                  </div>
                </>
              )}
            </Card>
          </div>

          <section aria-labelledby="analytics-insights-heading" className="space-y-3">
            <div>
              <h2 id="analytics-insights-heading" className="text-xl font-semibold">Insights</h2>
              <p className="mt-1 text-sm text-onboarding-neutral-600 dark:text-onboarding-neutral-400">
                Narrated only from recorded outreach performance.
              </p>
            </div>
            {insights?.status === "no_data" ? (
              <Card>
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                  Once you have sent some outreach, insights will appear here.
                </CardContent>
              </Card>
            ) : insights?.status === "aggregating" || !insights ? (
              <Card>
                <CardContent className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" /> Still gathering data
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-5 xl:grid-cols-3">
                <InsightPanel
                  title="What’s working"
                  empty="No positive patterns are available from the recorded data yet."
                  items={insights.whatsWorking.map((item) => (
                    <div key={`${item.campaignId}:${item.text}`}>
                      <p className="text-sm leading-6">{item.text}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{item.campaignName}</p>
                    </div>
                  ))}
                />
                <InsightPanel
                  title="What’s not working"
                  empty="No underperforming pattern is available from the recorded data yet."
                  items={insights.whatsNotWorking.map((item) => (
                    <div key={`${item.campaignId}:${item.text}`}>
                      <p className="text-sm leading-6">{item.text}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{item.campaignName}</p>
                    </div>
                  ))}
                />
                <InsightPanel
                  title="What to do next"
                  empty="No next action is available from the recorded data yet."
                  items={insights.whatToDoNext.map((item) => (
                    <div key={`${item.campaignId}:${item.action}`}>
                      <p className="text-sm font-medium leading-6">{item.action}</p>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.reason}</p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Priority {item.priority} · {item.campaignName}
                      </p>
                    </div>
                  ))}
                />
              </div>
            )}
          </section>
        </>
      ) : null}

      <div className="flex flex-col gap-2 rounded-xl border border-onboarding-purple-200 bg-onboarding-purple-50 px-4 py-3 text-sm text-onboarding-purple-800 sm:flex-row sm:items-center sm:justify-between dark:border-onboarding-purple-400/30 dark:bg-onboarding-purple-500/15 dark:text-onboarding-purple-100">
        <p className="inline-flex items-start gap-2 sm:items-center">
          <Info className="mt-0.5 size-4 shrink-0 text-onboarding-purple-600 dark:text-onboarding-purple-300 sm:mt-0" aria-hidden />
          Analytics only reflect persisted outreach and lead outcomes, with no forecasts or projected rates.
        </p>
      </div>
    </div>
  );
}
