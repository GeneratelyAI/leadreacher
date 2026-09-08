import { Area, AreaChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { Card, CardContent } from "@/components/ui/Card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { formatChartDate } from "../state/analytics-format";
import type { AnalyticsResponse } from "../state/analytics-model";
import { TrendLine } from "./TrendLine";

const ACTIVITY_CHART_CONFIG: ChartConfig = {
  messagesSent: { label: "Messages sent", color: "#5326b7" },
  repliesReceived: { label: "Replies received", color: "#2563eb" },
  meetingsBooked: { label: "Meetings booked", color: "#16a34a" },
};

const REPLY_RATE_CHART_CONFIG: ChartConfig = {
  replyRate: { label: "Reply rate", color: "#5326b7" },
};


export function AnalyticsCharts({ analytics }: { analytics: AnalyticsResponse }) {
  return (
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
  );
}
