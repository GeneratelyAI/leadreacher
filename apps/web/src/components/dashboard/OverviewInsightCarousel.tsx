"use client";

import Link from "next/link";
import {
  ArrowRight,
  CircleAlert,
  Link2,
  MessageSquare,
  Plus,
  TrendingUp,
} from "lucide-react";
import { useEffect, useId, useState } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { type SocialMediaIconName } from "@/components/ui/SocialMediaIcon";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type InsightSlideOverview = {
  metrics: {
    outreachSent: number;
    replies: number;
    meetingsBooked: number;
  };
  activityTrend?: Array<{ date: string; sent: number; replies: number }>;
  channels?: Array<{
    id: string;
    platform: string;
    accountName: string;
    status: string;
  }>;
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

const UPSELL_CHANNELS = [
  { id: "linkedin" as const, label: "LinkedIn", detail: "Connection notes + sequences" },
  { id: "whatsapp" as const, label: "WhatsApp", detail: "Direct follow-ups" },
  { id: "instagram" as const, label: "Instagram", detail: "Social outreach" },
  { id: "facebook" as const, label: "Facebook", detail: "Messenger outreach" },
] satisfies Array<{
  id: SocialMediaIconName;
  label: string;
  detail: string;
}>;

type UpsellChannelId = (typeof UPSELL_CHANNELS)[number]["id"];

function clusterItemClass(index: number, total: number): string {
  if (total <= 1) return "z-30";
  if (total === 2) {
    return index === 0 ? "z-20 -rotate-[14deg]" : "z-30 -ml-3 rotate-[14deg]";
  }
  // Instagram left, WhatsApp center (on top), Facebook right — tight fan like the reference
  if (index === 0) return "z-10 -rotate-[14deg]";
  if (index === 1) return "z-30 -ml-3";
  return "z-20 -ml-3 rotate-[14deg]";
}

function ChannelStickerMark({ name }: { name: UpsellChannelId }) {
  const reactId = useId().replace(/:/g, "");

  if (name === "instagram" || name === "facebook" || name === "linkedin") {
    const src =
      name === "instagram"
        ? "/dashboard/instagram-logo.png"
        : name === "facebook"
          ? "/dashboard/facebook-logo.png"
          : "/dashboard/linkedin-logo.png";
    return (
      // eslint-disable-next-line @next/next/no-img-element -- static brand sticker assets
      <img
        src={src}
        alt=""
        draggable={false}
        className="size-full object-contain drop-shadow-[0_4px_10px_rgba(15,23,42,0.18)]"
      />
    );
  }

  return (
    <svg viewBox="0 0 80 80" className="size-full" aria-hidden>
      <defs>
        <filter id={`wa-shadow-${reactId}`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="4" stdDeviation="3.5" floodColor="#0f172a" floodOpacity="0.18" />
        </filter>
      </defs>
      <g filter={`url(#wa-shadow-${reactId})`}>
        <path
          fill="white"
          d="M40.1 5.2C21.6 5.2 6.6 20.2 6.6 38.7c0 6.1 1.6 11.8 4.4 16.8L6 74.2l19.3-5.1c4.8 2.6 10.2 4 15.8 4h.1c18.5 0 33.5-15 33.5-33.5S58.6 5.2 40.1 5.2Z"
        />
        <path
          fill="#25D366"
          d="M40.1 11.2C24.9 11.2 12.6 23.5 12.6 38.7c0 5.1 1.3 9.9 3.7 14.1l-2.4 14 14.4-3.8a26.7 26.7 0 0 0 11.8 2.7h.1c15.2 0 27.5-12.3 27.5-27.5S55.3 11.2 40.1 11.2Z"
        />
        <path
          fill="white"
          d="M54.2 47.4c-.8-.4-4.8-2.4-5.5-2.6-.7-.3-1.3-.4-1.8.4-.5.7-2 2.5-2.5 3-.4.5-1 .6-1.8.2-4.7-2.3-7.8-4.2-10.9-9.5-.8-1.4.8-1.3 2.3-4.2.3-.5.1-1-.1-1.4-.3-.4-1.8-4.4-2.5-6-.7-1.6-1.4-1.4-1.9-1.4h-1.6c-.5 0-1.4.2-2.1 1-.7.8-2.8 2.8-2.8 6.8s2.9 7.9 3.3 8.4c.4.6 5.7 8.8 13.9 12.3 1.9.8 3.4 1.3 4.6 1.7 1.9.6 3.7.5 5.1.3 1.5-.2 4.8-2 5.4-3.9.7-1.9.7-3.5.5-3.8-.2-.4-.8-.6-1.6-1Z"
        />
      </g>
    </svg>
  );
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
  const connectedPlatforms = new Set(
    (overview.channels ?? [])
      .filter((channel) => channel.status === "active")
      .map((channel) => channel.platform.toLowerCase()),
  );
  const connectedCount = UPSELL_CHANNELS.filter((channel) => connectedPlatforms.has(channel.id)).length;
  const missingChannels = UPSELL_CHANNELS.filter((channel) => !connectedPlatforms.has(channel.id));
  const stickerOrder: UpsellChannelId[] = ["instagram", "whatsapp", "facebook", "linkedin"];
  const clusterChannels = [...missingChannels]
    .sort((a, b) => stickerOrder.indexOf(a.id) - stickerOrder.indexOf(b.id))
    .slice(0, 3);
  const allConnected = missingChannels.length === 0;
  const missingLabels = missingChannels.map((channel) => channel.label);
  const missingSummary =
    missingLabels.length === 0
      ? null
      : missingLabels.length === 1
        ? missingLabels[0]
        : missingLabels.length === 2
          ? `${missingLabels[0]} and ${missingLabels[1]}`
          : `${missingLabels.slice(0, -1).join(", ")}, and ${missingLabels.at(-1)}`;

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
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
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
            <SlideShell
              footerHref="/dashboard/channels"
              footerLabel={allConnected ? "Manage channels" : "Connect channels"}
            >
              <div className="flex items-center gap-2">
                <Plus className="size-4 text-onboarding-purple-600 dark:text-onboarding-purple-200" aria-hidden />
                <h2 className="font-semibold">
                  {allConnected ? "Channels connected" : "Connect more channels"}
                </h2>
              </div>
              <p className="mt-3 text-sm font-semibold leading-5">
                {allConnected
                  ? "All channels connected"
                  : connectedCount === 0
                    ? "Add your first outreach channel"
                    : `${connectedCount} of ${UPSELL_CHANNELS.length} channels live`}
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {allConnected
                  ? "LinkedIn, WhatsApp, Instagram, and Facebook are live in your operator workspace."
                  : missingSummary
                    ? `Add ${missingSummary} to reach the same ICP across every channel from one workspace.`
                    : "Reach the same ICP across LinkedIn, WhatsApp, Instagram, and Facebook from one operator workspace."}
              </p>

              {clusterChannels.length > 0 ? (
                <div className="mt-8 flex flex-1 items-center justify-center pb-1 pt-4">
                  <div className="flex items-center justify-center py-2">
                    {clusterChannels.map((channel, index) => (
                      <Tooltip key={channel.id}>
                        <TooltipTrigger
                          render={
                            <Link
                              href="/dashboard/channels"
                              aria-label={`Connect ${channel.label}`}
                              className={cn(
                                "relative shrink-0 transition duration-200 ease-out will-change-transform hover:-translate-y-2.5 hover:scale-110 hover:z-40 focus-visible:-translate-y-2.5 focus-visible:scale-110 focus-visible:z-40 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-onboarding-purple-300",
                                channel.id === "whatsapp" ? "size-[5.85rem]" : "size-[5rem]",
                                clusterItemClass(index, clusterChannels.length),
                              )}
                            />
                          }
                        >
                          <ChannelStickerMark name={channel.id} />
                        </TooltipTrigger>
                        <TooltipContent side="top" sideOffset={12}>
                          Connect {channel.label}
                        </TooltipContent>
                      </Tooltip>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="mt-8 flex flex-1 items-center justify-center pb-1 pt-4">
                  <p className="text-center text-sm text-muted-foreground">
                    Nothing left to connect — you&apos;re fully multi-channel.
                  </p>
                </div>
              )}
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
        </CarouselContent>
      </Carousel>

      <div className="flex items-center justify-center gap-1 pb-3" role="tablist" aria-label="Insight slides">
        {Array.from({ length: slideCount }).map((_, index) => (
          <button
            key={index}
            type="button"
            role="tab"
            aria-selected={index === current}
            className="inline-flex size-10 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-onboarding-purple-300"
            onClick={() => api?.scrollTo(index)}
            aria-label={`Go to slide ${index + 1}`}
          >
            <span
              className={cn(
                "size-2.5 rounded-full transition-colors",
                index === current ? "bg-onboarding-purple-500" : "bg-onboarding-neutral-300 dark:bg-onboarding-neutral-700",
              )}
            />
          </button>
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
