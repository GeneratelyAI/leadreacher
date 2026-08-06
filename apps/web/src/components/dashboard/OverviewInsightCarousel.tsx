"use client";

import Link from "next/link";
import {
  ArrowRight,
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
import { LINKEDIN_BRAND_LOGO_SRC } from "@/components/ui/SocialMediaIcon";
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
  {
    id: "linkedin" as const,
    label: "LinkedIn",
    detail: "Reach decision-makers with connection notes and follow-up sequences.",
    accent: "text-[#0A66C2]",
  },
  {
    id: "whatsapp" as const,
    label: "WhatsApp",
    detail: "Continue conversations with direct, mobile-first follow-ups.",
    accent: "text-[#25D366]",
  },
  {
    id: "instagram" as const,
    label: "Instagram",
    detail: "Meet prospects in their social inbox with professional outreach.",
    accent: "text-[#E1306C]",
  },
  {
    id: "gmail" as const,
    label: "Gmail",
    detail: "Send approved email outreach from a connected Google inbox.",
    accent: "text-[#EA4335]",
  },
  {
    id: "outlook" as const,
    label: "Outlook",
    detail: "Send approved email outreach from a connected Microsoft inbox.",
    accent: "text-[#0078D4]",
  },
] as const;

type UpsellChannelId = (typeof UPSELL_CHANNELS)[number]["id"];

function isUpsellConnected(id: UpsellChannelId, platforms: Set<string>): boolean {
  if (id === "gmail" || id === "outlook") {
    return ["email", "google", "outlook", "microsoft", "imap", "mail"].some((platform) => platforms.has(platform));
  }
  return platforms.has(id);
}

function ChannelStickerMark({ name }: { name: UpsellChannelId }) {
  const reactId = useId().replace(/:/g, "");

  if (name === "instagram" || name === "linkedin" || name === "gmail" || name === "outlook") {
    const src =
      name === "instagram"
        ? "/dashboard/instagram-logo.png"
        : name === "gmail"
          ? "/dashboard/gmail-logo.png"
          : name === "outlook"
            ? "/dashboard/outlook-logo.png"
          : LINKEDIN_BRAND_LOGO_SRC;
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

export function OverviewChannelUpsellCarousel({
  channels,
}: {
  channels: InsightSlideOverview["channels"];
}) {
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const connectedPlatforms = new Set(
    (channels ?? [])
      .filter((channel) => channel.status === "active")
      .map((channel) => channel.platform.toLowerCase()),
  );
  const connectedCount = (channels ?? []).filter((channel) => channel.status === "active").length;
  const slides = UPSELL_CHANNELS.filter(
    (channel) => !isUpsellConnected(channel.id, connectedPlatforms),
  );

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
    if (!api || paused || slides.length < 2) return;
    const timer = window.setInterval(() => {
      if (api.canScrollNext()) api.scrollNext();
      else api.scrollTo(0);
    }, 4_000);
    return () => window.clearInterval(timer);
  }, [api, paused, slides.length]);

  if (slides.length === 0) return null;

  return (
    <section
      className="flex min-w-0 flex-col gap-1.5"
      aria-label="Channel connection options"
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPaused(false);
      }}
    >
      <Carousel
        setApi={setApi}
        opts={{ loop: slides.length > 1, align: "start" }}
        className="w-full min-w-0 max-w-full overflow-hidden rounded-onboarding border border-onboarding-neutral-150 bg-onboarding-neutral-0 shadow-onboarding-small dark:border-onboarding-neutral-750 dark:bg-onboarding-neutral-900"
      >
        <CarouselContent className="-ml-0">
          {slides.map((channel) => {
            return (
              <CarouselItem key={channel.id} className="pl-0">
                <div className="flex min-h-[13.5rem] flex-col px-4 py-3.5">
                  <div className="flex items-center gap-2">
                    <Plus className={cn("size-4", channel.accent)} aria-hidden />
                    <h2 className="font-semibold">Add {channel.label}</h2>
                  </div>
                  <p className="mt-2.5 text-sm font-semibold leading-5">
                    {connectedCount} {connectedCount === 1 ? "channel" : "channels"} live
                  </p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {channel.detail}
                  </p>
                  <div className="flex min-h-24 flex-1 items-center justify-center py-3">
                    <Link
                      href="/dashboard/channels"
                      aria-label={`Connect ${channel.label}`}
                      className={cn(
                        channel.id === "whatsapp" ? "size-25 translate-y-1" : "size-20",
                        "transition-transform duration-200 ease-out hover:translate-y-0 hover:scale-110 focus-visible:translate-y-0 focus-visible:scale-110 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-onboarding-purple-300 motion-reduce:transition-none motion-reduce:hover:scale-100",
                      )}
                    >
                      <ChannelStickerMark name={channel.id} />
                    </Link>
                  </div>
                  <div className="flex justify-end">
                    <Link
                      href="/dashboard/channels"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-onboarding-purple-600 hover:text-onboarding-purple-700 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-onboarding-purple-300 dark:text-onboarding-purple-200"
                    >
                      Connect <ArrowRight className="size-3" aria-hidden />
                    </Link>
                  </div>
                </div>
              </CarouselItem>
            );
          })}
        </CarouselContent>
        <div className="flex justify-center gap-0.5 pb-1" role="tablist" aria-label="Channel connection slides">
          {slides.map((channel, index) => (
            <button
              key={channel.id}
              type="button"
              role="tab"
              aria-selected={index === current}
              aria-label={`Show ${channel.label} channel option`}
              className="inline-flex size-7 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-onboarding-purple-300"
              onClick={() => api?.scrollTo(index)}
            >
              <span className={cn("size-1.5 rounded-full", index === current ? "bg-onboarding-purple-500" : "bg-onboarding-neutral-300 dark:bg-onboarding-neutral-700")} />
            </button>
          ))}
        </div>
      </Carousel>
    </section>
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
    <div className="flex h-full min-w-0 max-w-full min-h-[22rem] flex-col">
      <div className="min-w-0 flex-1 px-4 pt-4">{children}</div>
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
  const activityTrend = overview.activityTrend ?? [];
  const hasActivityTrend = activityTrend.some((item) => item.sent > 0 || item.replies > 0);

  return (
    <section
      className="min-w-0 max-w-full overflow-hidden rounded-onboarding border border-onboarding-neutral-150 bg-onboarding-neutral-0 shadow-onboarding-small dark:border-onboarding-neutral-750 dark:bg-onboarding-neutral-900"
      aria-labelledby="today-insight-heading"
    >
      <SlideShell footerHref="/dashboard/analytics" footerLabel="View full report">
        <div className="flex items-center gap-2">
          <TrendingUp className="size-4 text-onboarding-purple-600 dark:text-onboarding-purple-200" aria-hidden />
          <h2 id="today-insight-heading" className="font-semibold">Today&apos;s insight</h2>
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
          <ChartContainer config={CHART_CONFIG} className="h-36 w-full min-w-0 max-w-full aspect-auto">
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
                content={<ChartTooltipContent indicator="line" labelFormatter={(value) => formatChartDate(String(value))} />}
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
    </section>
  );
}
