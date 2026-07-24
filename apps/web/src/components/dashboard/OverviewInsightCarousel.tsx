"use client";

import Link from "next/link";
import {
  ArrowRight,
  CircleAlert,
  Link2,
  MessageSquare,
  TrendingUp,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { cn } from "@/lib/utils";

type InsightSlideOverview = {
  metrics: {
    outreachSent: number;
    replies: number;
    meetingsBooked: number;
  };
  activityTrend?: Array<{ date: string; sent: number; replies: number }>;
  primaryCampaign: {
    id: string;
    name: string;
    status: string;
    prospectCount: number;
    stats?: { prospects: number; contacted: number; replies: number; meetings: number; customers: number };
  } | null;
  actions?: {
    needsReplyCount: number;
    stalledCount: number;
    failedSendCount: number;
    reconnectAccounts: Array<{ accountName: string; status: string }>;
  };
  sendingHealth?: {
    senders: Array<{
      accountName: string;
      invite: { limit: number; remaining: number };
      message: { limit: number; remaining: number };
    }>;
    unhealthyAccounts: Array<{ accountName: string; status: string }>;
    failedSendCount: number;
    pendingInviteAcceptances: number;
  };
};

type FeaturedInsight = { title: string; detail: string } | null;

const CHART_CONFIG = {
  sent: { label: "Sent", color: "var(--onboarding-purple-500)" },
  replies: { label: "Replies", color: "var(--onboarding-success-500)" },
} satisfies ChartConfig;

function formatNumber(value: number): string {
  return new Intl.NumberFormat().format(value);
}

function formatChartDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(value));
}

function titleCase(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function SlideShell({
  children,
  footerHref,
  footerLabel,
}: {
  children: React.ReactNode;
  footerHref: string;
  footerLabel: string;
}) {
  return (
    <div className="flex h-full min-h-[22rem] flex-col">
      <div className="flex-1 px-4 pt-4">{children}</div>
      <div className="mt-auto flex justify-center border-t border-onboarding-neutral-150 px-4 py-2.5 dark:border-onboarding-neutral-750">
        <Link
          href={footerHref}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-onboarding-purple-600 hover:text-onboarding-purple-700 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-onboarding-purple-300 dark:text-onboarding-purple-200"
        >
          {footerLabel} <ArrowRight className="size-3" aria-hidden />
        </Link>
      </div>
    </div>
  );
}

export function OverviewInsightCarousel({
  overview,
  featuredInsight,
}: {
  overview: InsightSlideOverview;
  featuredInsight: FeaturedInsight;
}) {
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);

  const activityTrend = overview.activityTrend ?? [];
  const hasActivityTrend = activityTrend.some((item) => item.sent > 0 || item.replies > 0);
  const actions = overview.actions;
  const health = overview.sendingHealth;
  const sender = health?.senders[0];
  const campaign = overview.primaryCampaign;

  useEffect(() => {
    if (!api) return;
    const onSelect = () => setCurrent(api.selectedScrollSnap());
    onSelect();
    api.on("select", onSelect);
    return () => {
      api.off("select", onSelect);
    };
  }, [api]);

  useEffect(() => {
    if (!api || paused) return;
    const timer = window.setInterval(() => {
      if (api.canScrollNext()) api.scrollNext();
      else api.scrollTo(0);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [api, paused]);

  const slideCount = 4;

  return (
    <section
      className="overflow-hidden rounded-onboarding border border-onboarding-neutral-150 bg-onboarding-neutral-0 shadow-onboarding-small dark:border-onboarding-neutral-750 dark:bg-onboarding-neutral-900"
      aria-roledescription="carousel"
      aria-label="Workspace insight cards"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setPaused(false);
        }
      }}
    >
      <Carousel setApi={setApi} opts={{ loop: true, align: "start" }} className="w-full">
        <CarouselContent className="-ml-0">
          <CarouselItem className="pl-0">
            <SlideShell footerHref="/dashboard/analytics" footerLabel="View full report">
              <div className="flex items-center gap-2">
                <TrendingUp className="size-4 text-onboarding-purple-600 dark:text-onboarding-purple-200" aria-hidden />
                <h2 className="font-semibold">Today&apos;s insight</h2>
              </div>
              {featuredInsight ? (
                <>
                  <p className="mt-3 text-sm font-semibold leading-5">{featuredInsight.title}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{featuredInsight.detail}</p>
                </>
              ) : (
                <>
                  <p className="mt-3 text-sm font-semibold">Recorded campaign activity</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Once outreach is sent, evidence-based insights will appear here.
                  </p>
                </>
              )}
              <div className="pt-3">
                <ChartContainer config={CHART_CONFIG} className="h-36 w-full aspect-auto">
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
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      minTickGap={22}
                      tickFormatter={(value) => formatChartDate(String(value))}
                    />
                    <YAxis hide domain={[0, "auto"]} />
                    <ChartTooltip
                      cursor={false}
                      content={
                        <ChartTooltipContent
                          indicator="line"
                          labelFormatter={(value) => formatChartDate(String(value))}
                        />
                      }
                    />
                    <Area type="monotone" dataKey="sent" stroke="var(--color-sent)" fill="url(#insight-sent-fill)" strokeWidth={2} dot={false} />
                    <Area type="monotone" dataKey="replies" stroke="var(--color-replies)" fill="url(#insight-replies-fill)" strokeWidth={2} dot={false} />
                  </AreaChart>
                </ChartContainer>
                {!hasActivityTrend ? (
                  <p className="pb-2 text-center text-xs text-muted-foreground">No sent messages or replies in this period.</p>
                ) : null}
                <div className="grid grid-cols-3 gap-2 border-t border-onboarding-neutral-150 py-3 dark:border-onboarding-neutral-750">
                  {[
                    { label: "Sent", value: overview.metrics.outreachSent },
                    { label: "Replies", value: overview.metrics.replies },
                    { label: "Meetings", value: overview.metrics.meetingsBooked },
                  ].map((item) => (
                    <div key={item.label} className="min-w-0">
                      <p className="text-[11px] text-muted-foreground">{item.label}</p>
                      <p className="mt-0.5 text-base font-semibold">{formatNumber(item.value)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </SlideShell>
          </CarouselItem>

          <CarouselItem className="pl-0">
            <SlideShell footerHref="/dashboard/messages?state=needs_reply" footerLabel="Go to inbox">
              <div className="flex items-center gap-2">
                <MessageSquare className="size-4 text-onboarding-purple-600 dark:text-onboarding-purple-200" aria-hidden />
                <h2 className="font-semibold">Action queue</h2>
              </div>
              <p className="mt-3 text-sm font-semibold leading-5">What needs attention now</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Prioritized replies, stalled invites, and failed sends from your live workspace.
              </p>
              <ul className="mt-4 space-y-3">
                {[
                  {
                    label: "Needs reply",
                    value: actions?.needsReplyCount ?? 0,
                    detail: "Inbound conversations waiting",
                  },
                  {
                    label: "Awaiting accept",
                    value: actions?.stalledCount ?? 0,
                    detail: "Invites still pending",
                  },
                  {
                    label: "Failed sends",
                    value: actions?.failedSendCount ?? 0,
                    detail: "Failed or unknown deliveries",
                  },
                ].map((row) => (
                  <li key={row.label} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{row.label}</p>
                      <p className="text-xs text-muted-foreground">{row.detail}</p>
                    </div>
                    <p className="text-lg font-semibold tabular-nums">{formatNumber(row.value)}</p>
                  </li>
                ))}
              </ul>
            </SlideShell>
          </CarouselItem>

          <CarouselItem className="pl-0">
            <SlideShell footerHref="/dashboard/channels" footerLabel="View sending health">
              <div className="flex items-center gap-2">
                <Link2 className="size-4 text-onboarding-purple-600 dark:text-onboarding-purple-200" aria-hidden />
                <h2 className="font-semibold">Sending health</h2>
              </div>
              <p className="mt-3 text-sm font-semibold leading-5">
                {sender ? sender.accountName : "No LinkedIn sender connected"}
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Daily caps and channel status so you know why outreach might pause.
              </p>
              <div className="mt-4 space-y-3">
                <LimitBar
                  label="Messages left today"
                  remaining={sender?.message.remaining ?? 0}
                  limit={sender?.message.limit ?? 50}
                />
                <LimitBar
                  label="Invites left today"
                  remaining={sender?.invite.remaining ?? 0}
                  limit={sender?.invite.limit ?? 20}
                />
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-border px-3 py-2.5">
                    <p className="text-[11px] text-muted-foreground">Awaiting accept</p>
                    <p className="mt-1 text-lg font-semibold">{formatNumber(health?.pendingInviteAcceptances ?? 0)}</p>
                  </div>
                  <div className="rounded-lg border border-border px-3 py-2.5">
                    <p className="text-[11px] text-muted-foreground">Unhealthy channels</p>
                    <p className="mt-1 text-lg font-semibold">{formatNumber(health?.unhealthyAccounts.length ?? 0)}</p>
                  </div>
                </div>
                {(health?.unhealthyAccounts.length ?? 0) > 0 ? (
                  <p className="inline-flex items-start gap-1.5 text-xs text-onboarding-warning-900 dark:text-onboarding-warning-150">
                    <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                    {health!.unhealthyAccounts[0]!.accountName} needs reconnect
                  </p>
                ) : null}
              </div>
            </SlideShell>
          </CarouselItem>

          <CarouselItem className="pl-0">
            <SlideShell
              footerHref={campaign ? "/dashboard/campaigns" : "/dashboard/prospects"}
              footerLabel={campaign ? "Open campaigns" : "Find prospects"}
            >
              <div className="flex items-center gap-2">
                <Users className="size-4 text-onboarding-purple-600 dark:text-onboarding-purple-200" aria-hidden />
                <h2 className="font-semibold">{campaign ? "Primary campaign" : "Grow your pipeline"}</h2>
              </div>
              {campaign ? (
                <>
                  <p className="mt-3 text-sm font-semibold leading-5">{campaign.name}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {titleCase(campaign.status)} · {formatNumber(campaign.prospectCount)} prospect
                    {campaign.prospectCount === 1 ? "" : "s"} enrolled
                  </p>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    {[
                      { label: "Contacted", value: campaign.stats?.contacted ?? 0 },
                      { label: "Replies", value: campaign.stats?.replies ?? 0 },
                      { label: "Meetings", value: campaign.stats?.meetings ?? 0 },
                      { label: "Customers", value: campaign.stats?.customers ?? 0 },
                    ].map((item) => (
                      <div key={item.label} className="rounded-lg border border-border px-3 py-2.5">
                        <p className="text-[11px] text-muted-foreground">{item.label}</p>
                        <p className="mt-1 text-lg font-semibold">{formatNumber(item.value)}</p>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <p className="mt-3 text-sm font-semibold leading-5">No active campaign yet</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Import a CSV or run an ICP search, approve prospects, then launch your first sequence.
                  </p>
                  <ul className="mt-4 space-y-2 text-sm">
                    <li className="rounded-lg border border-border px-3 py-2.5">1. Find or import prospects</li>
                    <li className="rounded-lg border border-border px-3 py-2.5">2. Approve and enroll them</li>
                    <li className="rounded-lg border border-border px-3 py-2.5">3. Launch a campaign sequence</li>
                  </ul>
                </>
              )}
            </SlideShell>
          </CarouselItem>
        </CarouselContent>
      </Carousel>

      <div className="flex items-center justify-center gap-1.5 pb-3" aria-hidden>
        {Array.from({ length: slideCount }).map((_, index) => (
          <button
            key={index}
            type="button"
            className={cn(
              "size-1.5 rounded-full transition-colors",
              index === current ? "bg-onboarding-purple-500" : "bg-onboarding-neutral-300 dark:bg-onboarding-neutral-700",
            )}
            onClick={() => api?.scrollTo(index)}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>
      <p className="sr-only">{paused ? "Carousel paused" : "Carousel playing"}</p>
    </section>
  );
}

function LimitBar({
  label,
  remaining,
  limit,
}: {
  label: string;
  remaining: number;
  limit: number;
}) {
  const used = Math.max(0, limit - remaining);
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2 text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold tabular-nums">
          {remaining}/{limit}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-onboarding-neutral-150 dark:bg-onboarding-neutral-750">
        <div
          className="h-full rounded-full bg-onboarding-purple-500 transition-[width]"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
