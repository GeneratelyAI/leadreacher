import { ArrowDown, ArrowUp, Sparkles, MessageSquare, Reply, CalendarDays, Video } from "@/components/ui/icons";
import { Card, CardContent } from "@/components/ui/Card";
import { cn } from "@/lib/utils";
import { formatNumber } from "../state/analytics-format";
import type { ActivitySummary, ActivityTrend } from "../state/activity-model";

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



export function ActivityKpis({ summary }: { summary: ActivitySummary | null }) {
  return (
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
  );
}
