"use client";

import { type ComponentType } from "react";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import { ArrowDown, ArrowUp, CalendarDays, MessageSquare, Send, Users } from "lucide-react";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";

type Trend = { direction: "up" | "down" | "flat" | "new"; percent: number | null };

type AnalyticsResponse = {
  summary: {
    messagesSent: number;
    repliesReceived: number;
    replyRate: number;
    meetingsBooked: number;
    prospectsReached: number;
    trends: Record<"messagesSent" | "repliesReceived" | "replyRate" | "meetingsBooked" | "prospectsReached", Trend>;
  };
  activityTrend: Array<{ date: string; messagesSent: number; repliesReceived: number; meetingsBooked: number; prospectsReached: number }>;
};

type ChartMetric = {
  label: string;
  value: string;
  detail: string;
  trend?: Trend;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
};

const DUAL_CHART_CONFIG = {
  primary: { label: "Primary", color: "var(--onboarding-purple-500)" },
  secondary: { label: "Secondary", color: "var(--onboarding-success-500)" },
} satisfies ChartConfig;

function formatNumber(value: number): string {
  return new Intl.NumberFormat().format(value);
}

function TrendText({ trend }: { trend?: Trend }) {
  if (!trend) return <span className="text-muted-foreground">No comparison available</span>;
  const positive = trend.direction === "up" || trend.direction === "new";
  const negative = trend.direction === "down";
  return (
    <span className={cn("inline-flex items-center gap-1", positive && "text-onboarding-success-500", negative && "text-onboarding-error-500", trend.direction === "flat" && "text-muted-foreground")}>
      {trend.direction === "up" ? <ArrowUp className="size-3" /> : trend.direction === "down" ? <ArrowDown className="size-3" /> : null}
      {trend.direction === "new" ? "New activity" : trend.direction === "flat" ? "No change" : `${trend.percent ?? 0}% vs prior period`}
    </span>
  );
}

function DualMetricChart({ metrics, data }: { metrics: [ChartMetric, ChartMetric]; data: Array<{ date: string; primary: number; secondary: number }> }) {
  const [primaryMetric, secondaryMetric] = metrics;
  const chartConfig = {
    ...DUAL_CHART_CONFIG,
    primary: { ...DUAL_CHART_CONFIG.primary, label: primaryMetric.label },
    secondary: { ...DUAL_CHART_CONFIG.secondary, label: secondaryMetric.label },
  } satisfies ChartConfig;

  return (
    <div className="flex h-full min-w-0 flex-col px-6 py-5 lg:px-8">
      <div className="grid grid-cols-2 gap-5">
        {metrics.map(({ label, value, detail, trend, icon: Icon }, index) => (
          <div key={label} className={cn("min-w-0", index === 1 && "border-l border-app-border pl-5")}>
            <div className="flex items-center gap-3">
              <Icon className={cn("size-4 shrink-0", index === 0 ? "text-onboarding-purple-600 dark:text-onboarding-purple-200" : "text-onboarding-success-500")} aria-hidden />
              <div className="min-w-0"><p className="text-xl font-semibold">{value}</p><p className="truncate text-xs font-medium">{label}</p></div>
            </div>
            <p className="mt-2 truncate text-xs text-muted-foreground">{detail}</p>
            <p className="mt-1.5 text-[11px]"><TrendText trend={trend} /></p>
          </div>
        ))}
      </div>
      <ChartContainer config={chartConfig} className="mt-auto h-32 w-full pt-5 aspect-auto" aria-label={`${primaryMetric.label} and ${secondaryMetric.label} trends`}>
        <AreaChart data={data} margin={{ top: 4, right: 2, left: 2, bottom: 0 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="date" hide />
          <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" labelFormatter={(date) => String(date)} />} />
          <Area type="monotone" dataKey="primary" stroke="var(--color-primary)" fill="var(--color-primary)" fillOpacity={0.08} strokeWidth={2} dot={false} activeDot={{ r: 3 }} />
          <Area type="monotone" dataKey="secondary" stroke="var(--color-secondary)" fill="var(--color-secondary)" fillOpacity={0.05} strokeWidth={2} dot={false} activeDot={{ r: 3 }} />
        </AreaChart>
      </ChartContainer>
    </div>
  );
}

export function AdvancedMetrics({ analytics }: { analytics: AnalyticsResponse }) {
  const activityMetrics: [ChartMetric, ChartMetric] = [
    { label: "Messages sent", value: formatNumber(analytics.summary.messagesSent), detail: "Recorded outbound messages", trend: analytics.summary.trends.messagesSent, icon: Send },
    { label: "Prospects reached", value: formatNumber(analytics.summary.prospectsReached), detail: "Distinct prospects", trend: analytics.summary.trends.prospectsReached, icon: Users },
  ];
  const outcomeMetrics: [ChartMetric, ChartMetric] = [
    { label: "Replies", value: formatNumber(analytics.summary.repliesReceived), detail: `${analytics.summary.replyRate}% reply rate`, trend: analytics.summary.trends.repliesReceived, icon: MessageSquare },
    { label: "Meetings booked", value: formatNumber(analytics.summary.meetingsBooked), detail: "Recorded meetings", trend: analytics.summary.trends.meetingsBooked, icon: CalendarDays },
  ];

  return (
    <Card className="h-full overflow-hidden">
      <div className="grid h-full sm:grid-cols-2 sm:divide-x sm:divide-app-border">
        <DualMetricChart metrics={activityMetrics} data={analytics.activityTrend.map((point) => ({ date: point.date, primary: point.messagesSent, secondary: point.prospectsReached }))} />
        <DualMetricChart metrics={outcomeMetrics} data={analytics.activityTrend.map((point) => ({ date: point.date, primary: point.repliesReceived, secondary: point.meetingsBooked }))} />
      </div>
    </Card>
  );
}
