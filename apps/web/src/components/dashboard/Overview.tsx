"use client";

import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import {
  ArrowRight,
  ArrowUp,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Clock3,
  Megaphone,
  MessageSquare,
  Send,
  ShieldCheck,
  Users,
} from "@/components/ui/icons";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type ComponentType, type CSSProperties } from "react";
import { ChannelLogo } from "@/components/onboarding/ChannelLogo";
import { channelDisplayName, DashboardChannelLogo, groupEmailChannelMetrics } from "@/components/dashboard/ChannelIdentity";
import { PageFrame } from "@/components/dashboard/PageFrame";
import { useDashboardShell } from "@/components/dashboard/DashboardShell";
import { AdvancedMetrics } from "@/components/dashboard/AdvancedMetrics";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ApiError, apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

type OverviewMode = "casual" | "advanced";
type Trend = { direction: "up" | "down" | "flat" | "new"; percent: number | null };

type DashboardOverview = {
  organization: { name: string; plan: string; subscriptionStatus: string | null; hasBillingPortal: boolean };
  engine: { status: "running" | "ready" | "needs_attention"; label: string; detail: string };
  metrics: { prospects: number; outreachInProgress: number; replies: number; meetingsBooked: number; outreachSent: number; customers?: number };
  trends?: Partial<Record<"prospects" | "outreachInProgress" | "replies" | "meetingsBooked" | "outreachSent" | "customers", Trend>>;
  dateRange?: { startDate: string; endDate: string };
  primaryCampaign: {
    id: string;
    name: string;
    status: string;
    channels: string[];
    prospectCount: number;
    stats?: { prospects: number; contacted: number; replies: number; meetings: number; customers: number };
    channelSendCounts?: Record<string, number>;
  } | null;
  channels: Array<{ id: string; platform: string; accountName: string; avatarUrl: string | null; status: string }>;
  actions?: {
    needsReply: Array<{
      campaignLeadId: string;
      prospectName: string;
      company: string | null;
      avatarUrl: string | null;
      campaignName: string;
      preview: string;
      occurredAt: string;
    }>;
    needsReplyCount: number;
    reconnectAccounts: Array<{ id: string; platform: string; accountName: string; status: string }>;
    failedSendCount: number;
    stalledCount: number;
  };
};

type AnalyticsResponse = {
  summary: {
    messagesSent: number;
    repliesReceived: number;
    replyRate: number;
    meetingsBooked: number;
    prospectsReached: number;
    trends: Record<"messagesSent" | "repliesReceived" | "replyRate" | "meetingsBooked" | "prospectsReached", Trend>;
  };
  activityTrend: Array<{ date: string; messagesSent: number; repliesReceived: number; meetingsBooked: number; prospectsReached: number; replyRate: number }>;
  channels: Array<{ channel: string; messagesSent: number; replies: number; replyRate: number; meetingsBooked: number }>;
  campaigns: Array<{ id: string; name: string; messagesSent: number; replies: number; replyRate: number; meetingsBooked: number }>;
};

const MODE_STORAGE_KEY = "leadreacher.overview-mode";

const CONNECT_CHANNELS = [
  { id: "linkedin", label: "LinkedIn", detail: "Professional outreach and follow-up sequences.", image: "/dashboard/linkedin-logo.png" },
  { id: "whatsapp", label: "WhatsApp", detail: "Direct, mobile-first prospect conversations.", image: null },
  { id: "instagram", label: "Instagram", detail: "Professional outreach in social inboxes.", image: "/dashboard/instagram-logo.png" },
  { id: "gmail", label: "Gmail", detail: "Approved email outreach from Google inboxes.", image: "/dashboard/gmail-logo.png" },
  { id: "outlook", label: "Outlook", detail: "Approved email outreach from Microsoft inboxes.", image: "/dashboard/outlook-logo.png" },
] as const;

function formatNumber(value: number): string {
  return new Intl.NumberFormat().format(value);
}

function relativeTime(value: string): string {
  const elapsed = Math.max(0, Date.now() - new Date(value).getTime());
  const minutes = Math.round(elapsed / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours}h ago` : `${Math.round(hours / 24)}d ago`;
}

function initials(value: string): string {
  return value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "LR";
}

function accountFirstName(overview: DashboardOverview | null, fallback: string): string {
  const linkedinAccount = overview?.channels.find(
    (channel) => channel.status === "active" && channel.platform.toLowerCase() === "linkedin",
  );
  const accountName = linkedinAccount?.accountName.trim() || fallback.trim();
  return accountName.split(/\s+/)[0] || "there";
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function OverviewModeSwitcher({ mode, onChange }: { mode: OverviewMode; onChange: (mode: OverviewMode) => void }) {
  return (
    <Tabs value={mode} onValueChange={(value) => onChange(value as OverviewMode)} className="items-center gap-0">
      <TabsList className="h-10 w-full rounded-full bg-onboarding-neutral-100 p-1 sm:w-64 dark:bg-onboarding-neutral-800" aria-label="Overview detail level">
        <TabsTrigger value="casual" className="rounded-full px-6 data-active:text-onboarding-purple-700 dark:data-active:text-onboarding-purple-100">Casual</TabsTrigger>
        <TabsTrigger value="advanced" className="rounded-full px-6 data-active:text-onboarding-purple-700 dark:data-active:text-onboarding-purple-100">Advanced</TabsTrigger>
      </TabsList>
    </Tabs>
  );
}

function WorkingMetric({
  icon: Icon,
  label,
  value,
  detail,
  active,
  highlighted,
  reducedMotion,
}: {
  icon: ComponentType<{ className?: string; style?: CSSProperties; "aria-hidden"?: boolean; "data-slot"?: string }>;
  label: string;
  value: number;
  detail: string;
  active: boolean;
  highlighted: boolean;
  reducedMotion: boolean;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div className="flex min-w-0 flex-col items-center px-4 py-4 text-center">
      <div
        data-slot="overview-feature-icon"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          position: "relative",
          display: "flex",
          width: "7rem",
          height: "7rem",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "9999px",
          opacity: active ? 1 : 0.65,
        }}
        aria-hidden
      >
        <span
          data-slot="overview-feature-ring"
          style={{
            position: "absolute",
            inset: 0,
            border: "2px dashed var(--onboarding-purple-500)",
            borderRadius: "inherit",
            animation: reducedMotion
              ? "none"
              : `overview-feature-spin-inline ${hovered ? "3s" : "20s"} linear infinite`,
            boxShadow: highlighted && !hovered ? "0 0 0 7px rgba(83, 38, 183, 0.12)" : "none",
            transition: "box-shadow 500ms ease",
          }}
          aria-hidden
        />
        <span
          data-slot="overview-feature-core"
          style={{
            position: "relative",
            zIndex: 1,
            display: "flex",
            width: "5.5rem",
            height: "5.5rem",
            alignItems: "center",
            justifyContent: "center",
            border: "1.5px solid var(--onboarding-purple-500)",
            borderRadius: "inherit",
            background: hovered ? "var(--onboarding-purple-500)" : "var(--app-elevated)",
            boxShadow: hovered ? "0 10px 32px rgba(83, 38, 183, 0.28)" : "none",
            transform: hovered ? "translateY(-4px)" : "translateY(0)",
            transition: reducedMotion ? "none" : "background 250ms ease, box-shadow 250ms ease, transform 250ms ease",
          }}
          aria-hidden
        >
          <Icon
            data-slot="overview-feature-glyph"
            style={{
              width: "2rem",
              height: "2rem",
              color: hovered ? "white" : "var(--onboarding-purple-500)",
              transition: reducedMotion ? "none" : "color 250ms ease",
            }}
          />
        </span>
      </div>
      <p className="mt-3 text-sm font-medium">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-onboarding-purple-700 dark:text-onboarding-purple-100">{formatNumber(value)}</p>
      <p className="text-xs text-muted-foreground">{detail}</p>
      <Badge variant="outline" className="mt-3 gap-1.5 rounded-full font-normal">
        <span className={cn("size-1.5 rounded-full", active ? "bg-onboarding-success-500" : "bg-onboarding-neutral-400")} />
        {active ? "Working" : "Waiting"}
      </Badge>
    </div>
  );
}

function AutomationStatusCard({ overview }: { overview: DashboardOverview }) {
  const campaign = overview.primaryCampaign;
  const stats = campaign?.stats;
  const active = campaign?.status === "active";
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotionPreference = () => setReducedMotion(mediaQuery.matches);
    updateMotionPreference();
    mediaQuery.addEventListener("change", updateMotionPreference);
    return () => mediaQuery.removeEventListener("change", updateMotionPreference);
  }, []);

  useEffect(() => {
    if (reducedMotion) return;
    const interval = window.setInterval(() => {
      setHighlightedIndex((current) => (current + 1) % 3);
    }, 1_600);
    return () => window.clearInterval(interval);
  }, [reducedMotion]);

  return (
    <Card className="h-full overflow-hidden">
      <style>{`@keyframes overview-feature-spin-inline { to { transform: rotate(360deg); } }`}</style>
      <CardHeader className="flex-row items-center justify-between gap-3 border-b border-app-border py-4">
        <div>
          <CardTitle>LeadReacher is working</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">Finding prospects, delivering outreach, and monitoring replies.</p>
        </div>
        <Badge variant="outline" className="hidden max-w-64 gap-2 sm:inline-flex">
          <Megaphone className="size-3.5" aria-hidden />
          <span className="truncate">{campaign?.name ?? "No campaign selected"}</span>
        </Badge>
      </CardHeader>
      <CardContent className="grid px-0 sm:grid-cols-3 sm:divide-x sm:divide-app-border">
        <WorkingMetric highlighted={highlightedIndex === 0} reducedMotion={reducedMotion} icon={Users} label="Finding prospects" value={stats?.prospects ?? campaign?.prospectCount ?? 0} detail="prospects enrolled" active={active} />
        <WorkingMetric highlighted={highlightedIndex === 1} reducedMotion={reducedMotion} icon={Send} label="Sending outreach" value={stats?.contacted ?? overview.metrics.outreachSent} detail="prospects contacted" active={active} />
        <WorkingMetric highlighted={highlightedIndex === 2} reducedMotion={reducedMotion} icon={MessageSquare} label="Tracking replies" value={stats?.replies ?? overview.metrics.replies} detail="replies received" active={active} />
      </CardContent>
    </Card>
  );
}

function AtAGlance({ overview, analytics }: { overview: DashboardOverview; analytics: AnalyticsResponse | null }) {
  const rows = [
    { label: "Replies received", value: overview.metrics.replies, detail: analytics ? `${analytics.summary.replyRate}% reply rate` : "Recorded replies", icon: MessageSquare, href: "/dashboard/messages" },
    { label: "Meetings booked", value: overview.metrics.meetingsBooked, detail: "Recorded meetings", icon: CalendarDays, href: "/dashboard/prospects?reviewStatus=booked" },
    { label: "Customers", value: overview.metrics.customers ?? 0, detail: "Converted prospects", icon: CheckCircle2, href: "/dashboard/prospects" },
    { label: "Prospects reached", value: analytics?.summary.prospectsReached ?? overview.metrics.prospects, detail: "Distinct prospects", icon: Users, href: "/dashboard/analytics" },
  ];
  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-app-border py-4"><CardTitle>At a glance</CardTitle></CardHeader>
      <div className="px-4">
        {rows.map(({ label, value, detail, icon: Icon, href }, index) => (
          <Link key={label} href={href} className={cn("flex items-center gap-3 px-1 py-4 transition-colors hover:bg-app-hover", index > 0 && "border-t border-app-border")}>
            <span className="inline-flex size-8 items-center justify-center text-onboarding-purple-600 dark:text-onboarding-purple-200"><Icon className="size-5" aria-hidden /></span>
            <span className="w-16 text-xl font-semibold">{formatNumber(value)}</span>
            <span className="min-w-0 flex-1"><span className="block text-sm font-medium">{label}</span><span className="block truncate text-xs text-muted-foreground">{detail}</span></span>
            <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
          </Link>
        ))}
      </div>
    </Card>
  );
}

function RecentMessagesCard({ overview }: { overview: DashboardOverview }) {
  const messages = overview.actions?.needsReply ?? [];
  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <CardHeader className="flex-row items-center justify-between gap-3 border-b border-app-border py-4">
        <CardTitle>Messages {overview.actions?.needsReplyCount ? <Badge className="ml-1.5">{overview.actions.needsReplyCount}</Badge> : null}</CardTitle>
        <Link href="/dashboard/messages" className="inline-flex items-center gap-1 text-xs font-semibold text-onboarding-purple-600 hover:underline dark:text-onboarding-purple-200">View conversations <ArrowRight className="size-3" /></Link>
      </CardHeader>
      {messages.length ? (
        <ul className="grid flex-1 auto-rows-fr px-4">
          {messages.slice(0, 3).map((message, index) => (
            <li key={message.campaignLeadId} className={cn("flex items-center gap-3 py-3.5", index > 0 && "border-t border-app-border")}>
              <Avatar className="size-10"><AvatarImage src={message.avatarUrl ?? undefined} alt="" /><AvatarFallback>{initials(message.prospectName)}</AvatarFallback></Avatar>
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{message.prospectName}</p><p className="truncate text-xs text-muted-foreground">{message.preview}</p></div>
              <time className="text-xs text-muted-foreground" dateTime={message.occurredAt}>{relativeTime(message.occurredAt)}</time>
              <Button asChild variant="ghost" size="icon" aria-label={`Reply to ${message.prospectName}`}><Link href={`/dashboard/messages/${message.campaignLeadId}`}><ArrowRight /></Link></Button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="px-5 py-10 text-center"><CheckCircle2 className="mx-auto size-6 text-onboarding-success-500" /><p className="mt-3 text-sm font-medium">Inbox is clear</p><p className="mt-1 text-xs text-muted-foreground">New inbound replies will appear here.</p></div>
      )}
    </Card>
  );
}

function ChannelPerformanceCard({ analytics }: { analytics: AnalyticsResponse | null }) {
  const totals = useMemo(() => {
    const messagesSent = analytics?.channels.reduce((sum, row) => sum + row.messagesSent, 0) ?? 0;
    const replies = analytics?.channels.reduce((sum, row) => sum + row.replies, 0) ?? 0;
    return { messagesSent, replies, replyRate: messagesSent ? Math.round((replies / messagesSent) * 1000) / 10 : 0 };
  }, [analytics]);
  const channelRows = useMemo(() => {
    return groupEmailChannelMetrics(analytics?.channels ?? []);
  }, [analytics]);
  const best = channelRows.rows.filter((row) => row.messagesSent > 0).sort((a, b) => b.replyRate - a.replyRate)[0];
  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <CardHeader className="flex-row items-center justify-between gap-3 border-b border-app-border py-4"><CardTitle>Channel performance</CardTitle><Link href="/dashboard/analytics" className="text-xs font-semibold text-onboarding-purple-600 hover:underline dark:text-onboarding-purple-200">View report</Link></CardHeader>
      {analytics?.channels.length ? (
        <>
          <div className="flex-1 overflow-x-auto">
            <Table className="h-full">
              <TableHeader><TableRow><TableHead>Channel</TableHead><TableHead className="text-right">Sent</TableHead><TableHead className="text-right">Reply rate</TableHead><TableHead className="text-right">Replies</TableHead></TableRow></TableHeader>
              {channelRows.rows.map((row) => {
                const expandable = row.channel === "email" && channelRows.emailProviders.length > 0;
                return (
                  <TableBody key={row.channel} className={cn(expandable && "group/email")}>
                    <TableRow tabIndex={expandable ? 0 : undefined} className={cn(expandable && "cursor-default focus-visible:bg-muted/50 focus-visible:outline-none")}>
                      <TableCell><span className="flex items-center gap-2 font-medium"><DashboardChannelLogo platform={row.channel} className="size-6" />{channelDisplayName(row.channel)}{expandable ? <ChevronDown className="ml-1 size-3.5 text-muted-foreground transition-transform duration-300 group-hover/email:rotate-180 group-focus-within/email:rotate-180" aria-hidden /> : null}</span></TableCell>
                      <TableCell className="text-right">{formatNumber(row.messagesSent)}</TableCell><TableCell className="text-right">{row.replyRate}%</TableCell><TableCell className="text-right">{formatNumber(row.replies)}</TableCell>
                    </TableRow>
                    {expandable ? (
                      <TableRow className="border-0 hover:bg-transparent">
                        <TableCell colSpan={4} className="p-0">
                          <div className="max-h-0 overflow-hidden bg-muted/20 opacity-0 transition-[max-height,opacity] duration-300 ease-out group-hover/email:max-h-28 group-hover/email:opacity-100 group-focus-within/email:max-h-28 group-focus-within/email:opacity-100">
                            {channelRows.emailProviders.map((provider) => (
                              <div key={provider.channel} className="grid grid-cols-[minmax(10rem,1fr)_4rem_5rem_4rem] items-center border-t border-app-border px-2 py-2 text-sm">
                                <span className="flex items-center gap-2 pl-5 font-medium"><DashboardChannelLogo platform={provider.channel} className="size-5" />{channelDisplayName(provider.channel)}</span>
                                <span className="text-right">{formatNumber(provider.messagesSent)}</span><span className="text-right">{provider.replyRate}%</span><span className="text-right">{formatNumber(provider.replies)}</span>
                              </div>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                );
              })}
              <TableFooter><TableRow><TableCell>Total</TableCell><TableCell className="text-right">{formatNumber(totals.messagesSent)}</TableCell><TableCell className="text-right">{totals.replyRate}%</TableCell><TableCell className="text-right">{formatNumber(totals.replies)}</TableCell></TableRow></TableFooter>
            </Table>
          </div>
          {best ? <div className="mx-4 mb-4 flex items-center gap-3 rounded-lg bg-onboarding-purple-50 px-3 py-2.5 text-xs dark:bg-onboarding-purple-900/40"><ArrowUp className="size-4 text-onboarding-purple-600 dark:text-onboarding-purple-200" /><span><strong>{channelDisplayName(best.channel)}</strong> has the highest recorded reply rate.</span></div> : null}
        </>
      ) : <div className="px-5 py-10 text-center text-sm text-muted-foreground">Channel performance appears after outreach is sent.</div>}
    </Card>
  );
}

function CampaignPerformanceCard({ analytics }: { analytics: AnalyticsResponse | null }) {
  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <CardHeader className="flex-row items-center justify-between gap-3 border-b border-app-border py-4"><CardTitle>Campaign performance</CardTitle><Link href="/dashboard/campaigns" className="text-xs font-semibold text-onboarding-purple-600 hover:underline dark:text-onboarding-purple-200">View campaigns</Link></CardHeader>
      {analytics?.campaigns.length ? <div className="flex-1 overflow-x-auto [&>[data-slot=table-container]]:h-full"><Table className="h-full"><TableHeader><TableRow><TableHead>Campaign</TableHead><TableHead className="text-right">Sent</TableHead><TableHead className="text-right">Replies</TableHead><TableHead className="text-right">Rate</TableHead></TableRow></TableHeader><TableBody>{analytics.campaigns.slice(0, 5).map((row) => <TableRow key={row.id}><TableCell className="max-w-52 truncate font-medium">{row.name}</TableCell><TableCell className="text-right">{formatNumber(row.messagesSent)}</TableCell><TableCell className="text-right">{formatNumber(row.replies)}</TableCell><TableCell className="text-right">{row.replyRate}%</TableCell></TableRow>)}</TableBody></Table></div> : <div className="px-5 py-10 text-center text-sm text-muted-foreground">Campaign performance appears after outreach is sent.</div>}
    </Card>
  );
}

function ConnectChannels({ overview }: { overview: DashboardOverview }) {
  const active = new Set(overview.channels.filter((channel) => channel.status === "active").map((channel) => channel.platform.toLowerCase()));
  return (
    <Card className="overflow-hidden">
      <CardContent className="flex min-h-16 items-center gap-4 px-4 py-3 sm:px-5">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold">Expand your reach</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Manage your channels and add more for future campaigns.</p>
          <Link href="/dashboard/channels" className="mt-1 inline-flex text-xs font-semibold text-onboarding-purple-600 hover:underline dark:text-onboarding-purple-200">
            View channels <ArrowRight className="ml-1 size-3" />
          </Link>
        </div>
        <div className="flex max-w-[58%] shrink-0 items-center gap-3 overflow-x-auto touch-pan-x overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:max-w-none">
          {CONNECT_CHANNELS.map((channel) => {
            const isConnected = channel.id === "gmail" || channel.id === "outlook"
              ? ["email", "google", "microsoft", "outlook", "imap"].some((key) => active.has(key))
              : active.has(channel.id);
            const label = `${channel.label}${isConnected ? " connected" : " channel settings"}`;

            return (
              <Tooltip key={channel.id}>
                <TooltipTrigger
                  render={
                    <Link
                      href="/dashboard/channels"
                      aria-label={label}
                      className="inline-flex size-9 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-app-hover focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-onboarding-purple-300"
                    />
                  }
                >
                  {channel.image ? <Image src={channel.image} width={24} height={24} alt="" unoptimized className="size-6 object-contain" /> : <ChannelLogo name="whatsapp-mark" className="size-6" />}
                </TooltipTrigger>
                <TooltipContent side="top">{label}</TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function OverviewSkeleton() {
  return <div className="space-y-4"><div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(20rem,0.9fr)]"><Skeleton className="h-[25rem] rounded-lg" /><Skeleton className="h-[25rem] rounded-lg" /></div><div className="grid gap-4 xl:grid-cols-2"><Skeleton className="h-72 rounded-lg" /><Skeleton className="h-72 rounded-lg" /></div><Skeleton className="h-64 rounded-lg" /></div>;
}

function CasualOverview({ overview, analytics }: { overview: DashboardOverview; analytics: AnalyticsResponse | null }) {
  return <div className="space-y-4"><div className="grid items-stretch gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(20rem,0.9fr)]"><AutomationStatusCard overview={overview} /><AtAGlance overview={overview} analytics={analytics} /></div><div className="grid items-stretch gap-4 xl:grid-cols-2"><RecentMessagesCard overview={overview} /><ChannelPerformanceCard analytics={analytics} /></div><ConnectChannels overview={overview} /></div>;
}

function AdvancedOverview({ overview, analytics }: { overview: DashboardOverview; analytics: AnalyticsResponse | null }) {
  return <div className="space-y-4"><div className="grid items-stretch gap-4 2xl:grid-cols-[minmax(26rem,0.95fr)_minmax(0,1.35fr)]"><AutomationStatusCard overview={overview} />{analytics ? <AdvancedMetrics analytics={analytics} /> : <Skeleton className="h-full min-h-[20rem] rounded-lg" />}</div><div className="grid items-stretch gap-4 2xl:grid-cols-3"><RecentMessagesCard overview={overview} /><CampaignPerformanceCard analytics={analytics} /><ChannelPerformanceCard analytics={analytics} /></div><ConnectChannels overview={overview} /></div>;
}

export function Overview() {
  const { memberName } = useDashboardShell();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<OverviewMode>("casual");
  const rangeQuery = useMemo(() => {
    const query = new URLSearchParams();
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    if (startDate && endDate) { query.set("startDate", startDate); query.set("endDate", endDate); }
    return query.toString();
  }, [searchParams]);

  useEffect(() => {
    const saved = window.localStorage.getItem(MODE_STORAGE_KEY);
    if (saved === "advanced") setMode("advanced");
  }, []);

  function updateMode(next: OverviewMode) {
    setMode(next);
    window.localStorage.setItem(MODE_STORAGE_KEY, next);
  }

  const overviewQuery = useQuery({ queryKey: ["dashboard", "overview", rangeQuery], queryFn: () => apiFetch<DashboardOverview>(`/dashboard/overview?${rangeQuery}`), placeholderData: keepPreviousData, staleTime: 30_000 });
  const analyticsQuery = useQuery({ queryKey: ["dashboard", "analytics", rangeQuery], queryFn: () => apiFetch<AnalyticsResponse>(`/dashboard/analytics?${rangeQuery}`), placeholderData: keepPreviousData, staleTime: 30_000 });
  const overview = overviewQuery.data ?? null;
  const analytics = analyticsQuery.data ?? null;
  const requestError = overviewQuery.error ?? analyticsQuery.error;
  const error = requestError instanceof ApiError && requestError.status === 401 ? "Your session has expired. Please sign in again." : requestError instanceof Error ? requestError.message : null;

  return (
    <PageFrame className="min-w-0">
      <div className="relative mb-5 grid gap-4 lg:min-h-14 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <div className="min-w-0">
          <h1 className="text-[1.35rem] font-semibold leading-tight tracking-tight sm:text-[1.75rem]">{greeting()}, <span className="break-words">{accountFirstName(overview, memberName)}</span> <span aria-hidden>👋</span></h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground"><span className={cn("size-2 rounded-full", overview?.engine.status === "running" ? "bg-onboarding-success-500" : overview?.engine.status === "needs_attention" ? "bg-onboarding-warning-500" : "bg-onboarding-purple-500")} />{overview?.engine.detail ?? "Loading your workspace status."}</p>
        </div>
        <div className="lg:absolute lg:left-1/2 lg:-translate-x-1/2"><OverviewModeSwitcher mode={mode} onChange={updateMode} /></div>
        <div className="hidden justify-self-end lg:block"><Badge variant="outline" className="h-9 gap-2 px-3"><Clock3 className="size-3.5" />{overviewQuery.isFetching || analyticsQuery.isFetching ? "Refreshing" : "Data up to date"}</Badge></div>
      </div>

      {error ? <div className="mb-4 flex items-start gap-3 rounded-lg border border-onboarding-error-500/30 bg-onboarding-error-50 p-4 text-sm text-onboarding-error-900 dark:bg-onboarding-error-900 dark:text-onboarding-error-50" role="alert"><CircleAlert className="mt-0.5 size-4 shrink-0" /><div><p className="font-semibold">Unable to load overview</p><p className="mt-1">{error}</p></div></div> : null}
      {!overview && overviewQuery.isLoading ? <OverviewSkeleton /> : overview ? mode === "casual" ? <CasualOverview overview={overview} analytics={analytics} /> : <AdvancedOverview overview={overview} analytics={analytics} /> : null}

      {overview ? <footer className="mt-4 flex flex-col gap-2 rounded-lg border border-app-border bg-app-chrome px-4 py-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between"><span className="inline-flex items-center gap-2"><ShieldCheck className="size-4 text-onboarding-success-500" />{overview.engine.label}</span><span>{overviewQuery.isFetching || analyticsQuery.isFetching ? "Updating workspace data" : "Workspace data synchronized"}</span></footer> : null}
    </PageFrame>
  );
}
