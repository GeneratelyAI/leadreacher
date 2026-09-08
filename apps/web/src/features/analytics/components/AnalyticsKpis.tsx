import { Send, Reply, CalendarDays, UserPlus } from "@/components/ui/icons";
import { Card, CardContent } from "@/components/ui/Card";
import { formatNumber } from "../state/analytics-format";
import type { AnalyticsSummary, AnalyticsResponse } from "../state/analytics-model";
import { TrendLine } from "./TrendLine";

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


export function AnalyticsKpis({ analytics, isLoading }: { analytics: AnalyticsResponse | null; isLoading: boolean }) {
  return (
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
  );
}
