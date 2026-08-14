"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import {
  Archive,
  BarChart3,
  CalendarDays,
  Check,
  Clock3,
  Copy,
  Ellipsis,
  Eye,
  MessageCircle,
  MessageSquare,
  Pause,
  Pencil,
  Play,
  Plus,
  Search,
  Send,
  Trophy,
  Users,
  Video,
} from "@/components/ui/icons";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import type { CampaignDetail } from "@/components/dashboard/CampaignDetails";
import { defaultSequenceDraft, SequenceBuilder, type SequenceStepDraft } from "@/components/dashboard/SequenceBuilder";
import { MetricCard } from "@/components/patterns/MetricCard";
import { SelectionToolbar, SelectionToolbarAction } from "@/components/patterns/SelectionToolbar";
import type { CampaignVideoSummary } from "@/components/dashboard/CampaignVideo";
import { channelDisplayName, DashboardChannelLogo } from "@/components/dashboard/ChannelIdentity";
import { Filter, type FilterGroup } from "@/components/dashboard/Filter";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/Input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApiError, apiFetch } from "@/lib/api";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { cn } from "@/lib/utils";

const CampaignDetails = dynamic(
  () => import("@/components/dashboard/CampaignDetails").then((module) => module.CampaignDetails),
  { ssr: false, loading: () => null },
);

type CampaignStatus = "draft" | "review" | "active" | "paused" | "completed";
type FilterStatus = "all" | "drafts" | "running" | "paused" | "completed" | "archived";

type CampaignRow = {
  id: string;
  name: string;
  status: CampaignStatus;
  channels: string[];
  createdAt: string;
  updatedAt: string;
  prospectCount: number;
  archived?: boolean;
  senderAccount?: { id: string; platform: string; accountName: string; status: string } | null;
  video?: CampaignVideoSummary | null;
  metrics: {
    sent: number;
    replies: number;
    meetings: number;
    replyRate: number | null;
    meetingRate: number | null;
  };
};

type CampaignResponse = {
  campaigns: CampaignRow[];
  summary: {
    total: number;
    running: number;
    drafts: number;
    paused: number;
    completed: number;
    archived?: number;
    meetings: number;
    deltas: {
      running: { current: number; previous: number };
      meetings: { current: number; previous: number };
    };
  };
};

type SocialAccount = {
  id: string;
  platform: string;
  accountName: string;
  status: string;
};

function relativeTime(value: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function titleCase(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function channelLabel(channel: string): string {
  return titleCase(channel);
}

function campaignChannelLabel(channels: string[]): string {
  return channels.length === 1 ? channelLabel(channels[0]) : "Multi-channel";
}

function campaignNamePreview(audience: string, channels: string[], goal: string): string {
  const parts = [audience.trim(), campaignChannelLabel(channels), goal.trim()].filter(Boolean);
  return parts.length === 3 ? parts.join(" · ") : "Audience · Channel · Goal";
}

function percentChange(current: number, previous: number): string {
  if (previous === 0) return current > 0 ? "New activity" : "No activity yet";
  const percent = Math.round(Math.abs(((current - previous) / previous) * 100));
  if (percent === 0) return "No change vs last 30 days";
  return `${current > previous ? "↑" : "↓"} ${percent}% vs last 30 days`;
}

function trendDetailClass(detail: string): string | undefined {
  if (detail.startsWith("↑") || detail.startsWith("New")) {
    return "text-onboarding-success-600 dark:text-onboarding-success-400";
  }
  return undefined;
}

function analyticsHref(campaignId: string): string {
  return `/dashboard/analytics?campaignId=${encodeURIComponent(campaignId)}`;
}

function enrollHref(campaignId: string): string {
  return `/dashboard/prospects?enrollCampaignId=${encodeURIComponent(campaignId)}`;
}

function messagesHref(campaignId: string): string {
  return `/dashboard/messages?campaignId=${encodeURIComponent(campaignId)}`;
}

function activityHref(campaignId: string): string {
  return `/dashboard/activity?kind=campaign&campaignId=${encodeURIComponent(campaignId)}`;
}

function StatusIcon({ status }: { status: CampaignStatus }) {
  const Icon = status === "active" ? Play : status === "completed" ? Check : status === "paused" ? Pause : Pencil;
  return (
    <Icon
      className={cn(
        "mt-0.5 size-5 shrink-0 sm:size-6",
        status === "active" && "text-onboarding-success-500 dark:text-onboarding-success-300",
        status === "completed" && "text-onboarding-warning-500 dark:text-onboarding-warning-500",
        ["draft", "review", "paused"].includes(status) && "text-onboarding-neutral-500 dark:text-onboarding-neutral-400",
      )}
      strokeWidth={1.75}
      aria-hidden
    />
  );
}

function StatusBadge({ status }: { status: CampaignStatus }) {
  const label = status === "active" ? "Running" : status === "review" ? "Draft" : titleCase(status);
  return (
    <Badge
      variant="outline"
      className={cn(
        "border-transparent font-semibold",
        status === "active" && "bg-onboarding-success-50 text-onboarding-success-700 dark:bg-onboarding-success-900/50 dark:text-onboarding-success-300",
        ["draft", "review"].includes(status) && "bg-onboarding-purple-50 text-onboarding-purple-700 dark:bg-onboarding-purple-900/50 dark:text-onboarding-purple-100",
        status === "completed" && "bg-onboarding-warning-50 text-onboarding-warning-700 dark:bg-onboarding-warning-900/50 dark:text-onboarding-warning-150",
        status === "paused" && "bg-onboarding-neutral-100 text-onboarding-neutral-600 dark:bg-white/10 dark:text-onboarding-neutral-100",
      )}
    >
      {label}
    </Badge>
  );
}

function ChannelMarks({ channels }: { channels: string[] }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm text-app-fg-muted">
      {channels.map((channel) => (
        <span key={channel} className="inline-flex items-center gap-1.5">
          <DashboardChannelLogo platform={channel} className="size-5" />
          {channelDisplayName(channel)}
        </span>
      ))}
    </div>
  );
}

function VideoChip({ video }: { video?: CampaignVideoSummary | null }) {
  if (!video || video.status === "unused") return null;
  const label =
    video.needsReview
      ? "Review required"
      : video.status === "pending" || video.status === "generating"
      ? "Generating"
      : video.status === "failed" || video.status === "rejected"
        ? "Failed"
        : video.paused
          ? "Paused"
          : `${video.videosSent} sent`;
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-onboarding-neutral-100 px-2 py-0.5 text-[11px] font-semibold text-onboarding-neutral-700 dark:bg-app-hover dark:text-app-fg-muted">
      <Video className="size-3" aria-hidden />
      {label}
    </span>
  );
}

type ReadinessState = "ready" | "working" | "attention" | "not-used";

const readinessStateClass: Record<ReadinessState, string> = {
  ready: "bg-onboarding-success-500",
  working: "bg-onboarding-purple-500 animate-pulse",
  attention: "bg-onboarding-warning-500",
  "not-used": "bg-onboarding-neutral-300 dark:bg-onboarding-neutral-750",
};

function getVideoReadiness(video: CampaignVideoSummary | null | undefined): ReadinessState {
  if (!video || video.status === "unused") return "not-used";
  if (video.needsReview || ["failed", "rejected"].includes(video.status)) return "attention";
  if (["pending", "generating"].includes(video.status)) return "working";
  return "ready";
}

function CampaignReadiness({ campaign }: { campaign: CampaignRow }) {
  const items: Array<{ label: string; state: ReadinessState }> = [
    { label: "Audience", state: campaign.prospectCount > 0 ? "ready" : "attention" },
    {
      label: "Sender",
      state: campaign.senderAccount?.status === "active" ? "ready" : "attention",
    },
    { label: "Video", state: getVideoReadiness(campaign.video) },
  ];

  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5" aria-label="Campaign readiness" role="list">
      <span className="text-[11px] font-semibold tracking-wide text-app-fg-subtle uppercase">Readiness</span>
      {items.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-1.5 text-xs text-app-fg-muted" role="listitem">
          <span className={cn("size-1.5 rounded-full", readinessStateClass[item.state])} aria-hidden />
          {item.label}
        </span>
      ))}
    </div>
  );
}

function Metric({ icon: Icon, value, label, rate }: { icon: typeof Send; value: number; label: string; rate?: number | null }) {
  return (
    <div className="min-w-20 border-l border-app-border pl-5 first:border-l-0 first:pl-0">
      <div className="flex items-center gap-2 text-xl font-semibold tracking-tight">
        <Icon className="size-4 text-onboarding-purple-600 sm:size-[1.125rem] dark:text-onboarding-purple-300" strokeWidth={1.75} aria-hidden />
        {value}
      </div>
      <p className="mt-1 text-sm text-app-fg-muted">{label}</p>
      {rate !== undefined && rate !== null ? (
        <p className="mt-1 text-xs font-semibold text-onboarding-success-600 dark:text-onboarding-success-400">{rate}%</p>
      ) : null}
    </div>
  );
}

type ActionHandlers = {
  onOpen: (campaign: CampaignRow) => void;
  onPause: (campaign: CampaignRow) => void;
  onResume: (campaign: CampaignRow) => void;
  onDuplicate: (campaign: CampaignRow) => void;
  onArchive: (campaign: CampaignRow) => void;
  onComplete: (campaign: CampaignRow) => void;
};

function isInteractiveTarget(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest("a, button, input, select, textarea, [role='checkbox']"));
}

function CampaignActions({ campaign, handlers }: { campaign: CampaignRow; handlers: ActionHandlers }) {
  const needsProspects = ["draft", "review"].includes(campaign.status) && campaign.prospectCount === 0;

  return (
    <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
      {needsProspects ? (
        <Button variant="primary" size="sm" asChild>
          <Link href={enrollHref(campaign.id)}>
            <Users /> Add prospects
          </Link>
        </Button>
      ) : null}
      {campaign.status === "paused" ? (
        <Button variant="primary" size="sm" leftIcon={<Play />} onClick={() => handlers.onResume(campaign)}>
          Resume
        </Button>
      ) : null}
      {campaign.status === "active" ? (
        <Button variant="outline" size="sm" asChild>
          <Link href={analyticsHref(campaign.id)}>
            <BarChart3 /> Analytics
          </Link>
        </Button>
      ) : null}
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label={`More actions for ${campaign.name}`} />}>
          <Ellipsis />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => handlers.onOpen(campaign)}>
            <Eye className="size-4" /> View campaign
          </DropdownMenuItem>
          {campaign.status === "active" ? (
            <DropdownMenuItem onClick={() => handlers.onPause(campaign)}>
              <Pause className="size-4" /> Pause
            </DropdownMenuItem>
          ) : null}
          {campaign.status === "paused" ? (
            <DropdownMenuItem onClick={() => handlers.onResume(campaign)}>
              <Play className="size-4" /> Resume
            </DropdownMenuItem>
          ) : null}
          {["active", "paused", "draft", "review"].includes(campaign.status) ? (
            <DropdownMenuItem render={<Link href={enrollHref(campaign.id)} />}>
              <Users className="size-4" /> Add prospects
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem render={<Link href={messagesHref(campaign.id)} />}>
            <MessageSquare className="size-4" /> Messages
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link href={activityHref(campaign.id)} />}>
            <Clock3 className="size-4" /> Open activity
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link href={analyticsHref(campaign.id)} />}>
            <BarChart3 className="size-4" /> Analytics
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => handlers.onDuplicate(campaign)}>
            <Copy className="size-4" /> Duplicate
          </DropdownMenuItem>
          {["active", "paused"].includes(campaign.status) ? (
            <DropdownMenuItem onClick={() => handlers.onComplete(campaign)}>
              <Check className="size-4" /> Complete
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem onClick={() => handlers.onArchive(campaign)}>
            <Archive className="size-4" /> {campaign.archived ? "Restore" : "Archive"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function CampaignRowView({
  campaign,
  selected,
  onToggleSelect,
  onPrefetch,
  handlers,
}: {
  campaign: CampaignRow;
  selected: boolean;
  onToggleSelect: (id: string, checked: boolean) => void;
  onPrefetch: (id: string) => void;
  handlers: ActionHandlers;
}) {
  return (
    <li
      data-selected={selected ? "true" : undefined}
      className={cn(
        "app-list-row relative cursor-pointer px-5 py-5 transition-colors sm:px-6",
        selected && "bg-onboarding-purple-50/70 dark:bg-onboarding-purple-900/25",
      )}
      onClick={(event) => {
        if (!isInteractiveTarget(event.target)) handlers.onOpen(campaign);
      }}
      onMouseEnter={() => onPrefetch(campaign.id)}
      onFocusCapture={() => onPrefetch(campaign.id)}
    >
      <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <Checkbox
            checked={selected}
            onCheckedChange={(checked) => onToggleSelect(campaign.id, checked === true)}
            aria-label={`Select ${campaign.name}`}
            className="mt-1.5"
          />
          <StatusIcon status={campaign.status} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-lg font-semibold">{campaign.name}</h3>
              <StatusBadge status={campaign.status} />
              <VideoChip video={campaign.video} />
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-app-fg-muted">
              <ChannelMarks channels={campaign.channels} />
              <span aria-hidden>·</span>
              <span>
                {campaign.status === "active" ? "Started" : campaign.status === "completed" ? "Completed" : "Created"}{" "}
                {formatDate(campaign.createdAt)}
              </span>
              {campaign.senderAccount ? (
                <>
                  <span aria-hidden>·</span>
                  <span className={cn(campaign.senderAccount.status !== "active" && "text-onboarding-error-600 dark:text-onboarding-error-100")}>
                    {campaign.senderAccount.accountName}
                    {campaign.senderAccount.status !== "active" ? ` (${campaign.senderAccount.status})` : ""}
                  </span>
                </>
              ) : null}
            </div>
            <p className="mt-2 text-sm text-app-fg-muted">
              {campaign.prospectCount.toLocaleString()} prospects
              {["draft", "review"].includes(campaign.status) && campaign.prospectCount === 0
                ? " · Add prospects before launch"
                : ""}
            </p>
            <CampaignReadiness campaign={campaign} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-5 xl:min-w-[25rem] xl:grid-cols-3">
          <Metric icon={Send} value={campaign.metrics.sent} label="Sent" />
          <Metric icon={MessageCircle} value={campaign.metrics.replies} label="Replies" rate={campaign.metrics.replyRate} />
          <Metric icon={CalendarDays} value={campaign.metrics.meetings} label="Meetings" rate={campaign.metrics.meetingRate} />
        </div>
        <div className="flex flex-col items-stretch gap-3 xl:items-end">
          <span className="text-xs text-app-fg-subtle">
            Updated {relativeTime(campaign.updatedAt)}
          </span>
          <CampaignActions campaign={campaign} handlers={handlers} />
        </div>
      </div>
    </li>
  );
}

function CampaignCreateDialog({ accounts, onCreated }: { accounts: SocialAccount[]; onCreated: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [audience, setAudience] = useState("");
  const [goal, setGoal] = useState("Start conversations");
  const [sequence, setSequence] = useState<SequenceStepDraft[]>(() => defaultSequenceDraft());
  const [channelAccounts, setChannelAccounts] = useState<Record<string, string>>({});
  const [personalizeByChannel, setPersonalizeByChannel] = useState(true);
  const [personalizationValue, setPersonalizationValue] = useState("");
  const [personalizationAngle, setPersonalizationAngle] = useState("");
  const [personalizationCta, setPersonalizationCta] = useState("");
  const [proofPoints, setProofPoints] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeAccounts = useMemo(() => accounts.filter((account) => account.status === "active"), [accounts]);
  const availableSequenceChannels = useMemo(
    () => [...new Set(activeAccounts.map((account) => account.platform))],
    [activeAccounts],
  );
  const sequenceChannels = useMemo(() => [...new Set(sequence.map((step) => {
    if (step.type.startsWith("linkedin_")) return "linkedin";
    if (step.type === "email") return "email";
    return step.type.replace(/_message$/, "");
  }))], [sequence]);
  const namePreview = campaignNamePreview(audience, sequenceChannels, goal);

  useEffect(() => {
    setChannelAccounts((current) => {
      const next = { ...current };
      let changed = false;
      for (const channel of sequenceChannels) {
        const selected = activeAccounts.find((account) => account.id === next[channel] && account.platform === channel);
        if (!selected) {
          const fallback = activeAccounts.find((account) => account.platform === channel)?.id ?? "";
          if (next[channel] !== fallback) {
            next[channel] = fallback;
            changed = true;
          }
        }
      }
      return changed ? next : current;
    });
  }, [activeAccounts, sequenceChannels]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sequence.some((step) => !step.message.trim())) {
      setError("Every sequence step needs a message.");
      return;
    }
    if (!audience.trim() || !goal.trim()) {
      setError("Add the audience and goal for this campaign.");
      return;
    }
    const missingChannel = sequenceChannels.find((channel) => !channelAccounts[channel]);
    if (missingChannel) {
      setError(`Connect and select an active ${channelLabel(missingChannel)} sender before creating this campaign.`);
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      await apiFetch("/campaigns", {
        method: "POST",
        body: JSON.stringify({
          naming: {
            audience: audience.trim(),
            channelLabel: campaignChannelLabel(sequenceChannels),
            goal: goal.trim(),
          },
          channels: sequenceChannels,
          socialAccountId: channelAccounts.linkedin || undefined,
          channelAccounts,
          personalizeByChannel,
          ...(personalizeByChannel ? {
            personalization: {
              ...(personalizationValue.trim() ? { valueProposition: personalizationValue.trim() } : {}),
              ...(personalizationAngle.trim() ? { angle: personalizationAngle.trim() } : {}),
              ...(personalizationCta.trim() ? { cta: personalizationCta.trim() } : {}),
              proofPoints: proofPoints.split("\n").map((point) => point.trim()).filter(Boolean).slice(0, 3),
            },
          } : {}),
          sequence: sequence.map((step, index) => ({
            type: step.type,
            message: step.message.trim(),
            delayHours: index === 0 ? 0 : step.delayHours,
            ...(step.subject?.trim() ? { subject: step.subject.trim() } : {}),
          })),
        }),
      });
      setAudience("");
      setGoal("Start conversations");
      setSequence(defaultSequenceDraft());
      setChannelAccounts({});
      setPersonalizeByChannel(true);
      setPersonalizationValue("");
      setPersonalizationAngle("");
      setPersonalizationCta("");
      setProofPoints("");
      setOpen(false);
      toast.success("Campaign draft created");
      await onCreated();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to create campaign.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="primary" leftIcon={<Plus />} onClick={() => setOpen(true)}>
        New Campaign
      </Button>
      <DialogContent className="max-h-[min(90dvh,48rem)] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create a campaign draft</DialogTitle>
          <DialogDescription>
            Build the sequence and pick a sender. Creating a draft never sends outreach.
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <p className="rounded-lg bg-onboarding-error-50 p-3 text-sm text-onboarding-error-900 dark:bg-onboarding-error-500/15 dark:text-onboarding-error-100">
            {error}
          </p>
        ) : null}
        <form onSubmit={(event) => void submit(event)} className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium">
              Audience
              <Input required value={audience} onChange={(event) => setAudience(event.target.value)} placeholder="Revenue leaders" />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Goal
              <Input required value={goal} onChange={(event) => setGoal(event.target.value)} placeholder="Book discovery calls" />
            </label>
          </div>
          <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Campaign name</p>
            <p className="mt-1 truncate text-sm font-medium" title={namePreview}>{namePreview}</p>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Sequence</p>
            <SequenceBuilder
              value={sequence}
              onChange={setSequence}
              availableChannels={availableSequenceChannels}
            />
          </div>
          <label className="flex items-start gap-3 rounded-lg border border-border p-3">
            <Checkbox
              checked={personalizeByChannel}
              onCheckedChange={(checked) => setPersonalizeByChannel(checked === true)}
              aria-label="Personalize every campaign step"
              className="mt-0.5"
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium">Personalize every step</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Adapt each message to the prospect and channel using recorded business data. WhatsApp prospects must have a valid phone number.
              </span>
            </span>
          </label>
          {personalizeByChannel ? (
            <div className="grid gap-3 border-l-2 border-primary/20 pl-4">
              <p className="text-sm font-medium">Personalization guidance</p>
              <label className="grid gap-2 text-sm font-medium">
                Value proposition
                <Input value={personalizationValue} onChange={(event) => setPersonalizationValue(event.target.value)} placeholder="What value is approved for this audience?" maxLength={280} />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-medium">
                  Preferred angle
                  <Input value={personalizationAngle} onChange={(event) => setPersonalizationAngle(event.target.value)} placeholder="Operational efficiency" maxLength={120} />
                </label>
                <label className="grid gap-2 text-sm font-medium">
                  Preferred CTA
                  <Input value={personalizationCta} onChange={(event) => setPersonalizationCta(event.target.value)} placeholder="Ask to share an overview" maxLength={120} />
                </label>
              </div>
              <label className="grid gap-2 text-sm font-medium">
                Approved proof points
                <textarea value={proofPoints} onChange={(event) => setProofPoints(event.target.value)} placeholder={"One proof point per line, up to three"} rows={3} maxLength={542} className="min-h-20 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring" />
              </label>
              <p className="text-xs text-muted-foreground">Messages cite recorded prospect facts and fall back to your sequence when a check cannot verify them.</p>
            </div>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            {sequenceChannels.map((channel) => {
              const options = activeAccounts.filter((account) => account.platform === channel);
              return (
                <label key={channel} className="grid gap-2 text-sm font-medium">
                  {channelLabel(channel)} sender
                  <Select value={channelAccounts[channel] || null} onValueChange={(value) => setChannelAccounts((current) => ({ ...current, [channel]: value ?? "" }))} required>
                    <SelectTrigger className="w-full"><SelectValue placeholder={`Select a connected ${channelLabel(channel)} account`} /></SelectTrigger>
                    <SelectContent>
                      {options.map((account) => <SelectItem key={account.id} value={account.id}>{account.accountName}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {!options.length ? <span className="text-xs font-normal text-amber-700 dark:text-amber-300">No active sender. Connect one in Channels first.</span> : null}
                </label>
              );
            })}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isSaving} disabled={sequenceChannels.some((channel) => !channelAccounts[channel])}>
              Create draft
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CampaignSelectionActionBar({
  count,
  isActing,
  onPause,
  onResume,
  onArchive,
  onClear,
}: {
  count: number;
  isActing: boolean;
  onPause: () => void;
  onResume: () => void;
  onArchive: () => void;
  onClear: () => void;
}) {
  return (
    <SelectionToolbar
      count={count}
      entityName="Campaign"
      ariaLabel="Selected campaign actions"
      onClear={onClear}
    >
      <SelectionToolbarAction leftIcon={<Pause />} disabled={isActing} onClick={onPause}>
        Pause
      </SelectionToolbarAction>
      <SelectionToolbarAction leftIcon={<Play />} disabled={isActing} onClick={onResume}>
        Resume
      </SelectionToolbarAction>
      <SelectionToolbarAction leftIcon={<Archive />} disabled={isActing} onClick={onArchive}>
        Archive
      </SelectionToolbarAction>
    </SelectionToolbar>
  );
}

export function Campaigns() {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<FilterStatus>("all");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  const [channel, setChannel] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isActing, setIsActing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<{
    campaignIds: string[];
    body: { status?: "paused" | "active" | "completed"; archived?: boolean };
    title: string;
    description: string;
    success: string;
  } | null>(null);

  const campaignParams = useMemo(() => new URLSearchParams({
    status,
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    ...(channel !== "all" ? { channel } : {}),
  }).toString(), [channel, debouncedSearch, status]);
  const campaignQuery = useQuery({
    queryKey: ["dashboard", "campaigns", campaignParams],
    queryFn: () => apiFetch<CampaignResponse>(`/dashboard/campaigns?${campaignParams}`),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
  const accountsQuery = useQuery({
    queryKey: ["social-accounts"],
    queryFn: () => apiFetch<{ accounts: SocialAccount[] }>("/social-accounts"),
    staleTime: 60_000,
  });
  const data = campaignQuery.data ?? null;
  const accounts = accountsQuery.data?.accounts ?? [];
  const isLoading = campaignQuery.isLoading && !campaignQuery.data;
  const isRefreshing = campaignQuery.isFetching && !!campaignQuery.data;
  const error = actionError ?? (campaignQuery.error instanceof Error ? campaignQuery.error.message : accountsQuery.error instanceof Error ? accountsQuery.error.message : null);
  const load = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["dashboard", "campaigns"] }),
      queryClient.invalidateQueries({ queryKey: ["social-accounts"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard", "chrome"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard", "overview"] }),
    ]);
  }, [queryClient]);

  useEffect(() => {
    const reviewCampaignId = searchParams.get("reviewCampaignId");
    if (reviewCampaignId) setSelectedId(reviewCampaignId);
  }, [searchParams]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [status, debouncedSearch, channel]);

  async function patchCampaign(id: string, body: Record<string, unknown>, success: string) {
    setIsActing(true);
    const previous = queryClient.getQueriesData<CampaignResponse>({ queryKey: ["dashboard", "campaigns"] });
    queryClient.setQueriesData<CampaignResponse>({ queryKey: ["dashboard", "campaigns"] }, (current) => {
      if (!current) return current;
      return {
        ...current,
        campaigns: current.campaigns.map((campaign) => campaign.id === id
          ? {
              ...campaign,
              ...(typeof body.status === "string" ? { status: body.status as CampaignStatus } : {}),
              ...(typeof body.archived === "boolean" ? { archived: body.archived } : {}),
              updatedAt: new Date().toISOString(),
            }
          : campaign),
      };
    });
    try {
      await apiFetch(`/campaigns/${id}`, { method: "PATCH", body: JSON.stringify(body) });
      toast.success(success);
      await load();
    } catch (requestError) {
      previous.forEach(([queryKey, data]) => queryClient.setQueryData(queryKey, data));
      const message = requestError instanceof ApiError ? requestError.message : "Unable to update campaign.";
      setActionError(message);
      toast.error(message);
    } finally {
      setIsActing(false);
    }
  }

  const handlers: ActionHandlers = {
    onOpen: (campaign) => setSelectedId(campaign.id),
    onPause: (campaign) => setPendingAction({ campaignIds: [campaign.id], body: { status: "paused" }, title: "Pause this campaign?", description: "Pending outreach will stop until you explicitly resume the campaign.", success: "Campaign paused" }),
    onResume: (campaign) => void patchCampaign(campaign.id, { status: "active" }, "Campaign resumed"),
    onComplete: (campaign) => setPendingAction({ campaignIds: [campaign.id], body: { status: "completed" }, title: "Complete this campaign?", description: "The campaign will be closed and no additional sequence steps will be sent.", success: "Campaign completed" }),
    onArchive: (campaign) => campaign.archived
      ? void patchCampaign(campaign.id, { archived: false }, "Campaign restored")
      : setPendingAction({ campaignIds: [campaign.id], body: { archived: true }, title: "Archive this campaign?", description: "The campaign will be hidden from active views. Its persisted history remains available.", success: "Campaign archived" }),
    onDuplicate: (campaign) => {
      void (async () => {
        setIsActing(true);
        try {
          await apiFetch(`/campaigns/${campaign.id}/duplicate`, { method: "POST", body: JSON.stringify({}) });
          toast.success("Campaign duplicated as draft");
          await load();
        } catch (requestError) {
          toast.error(requestError instanceof Error ? requestError.message : "Unable to duplicate campaign.");
        } finally {
          setIsActing(false);
        }
      })();
    },
  };

  const prefetchCampaignDetail = useCallback((campaignId: string) => {
    void queryClient.prefetchQuery({
      queryKey: ["dashboard", "campaign", campaignId],
      queryFn: () => apiFetch<CampaignDetail>(`/campaigns/${campaignId}`),
      staleTime: 10_000,
    });
  }, [queryClient]);

  async function bulkPatch(body: { status?: "paused" | "active" | "completed"; archived?: boolean }, success: string) {
    if (selectedIds.size === 0) return;
    setIsActing(true);
    try {
      await apiFetch("/campaigns/bulk", {
        method: "PATCH",
        body: JSON.stringify({ campaignIds: [...selectedIds], ...body }),
      });
      toast.success(success);
      setSelectedIds(new Set());
      await load();
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "Bulk update failed.");
    } finally {
      setIsActing(false);
    }
  }

  async function confirmPendingAction() {
    if (!pendingAction) return;
    const action = pendingAction;
    setPendingAction(null);
    if (action.campaignIds.length === 1) {
      await patchCampaign(action.campaignIds[0], action.body, action.success);
      return;
    }
    await bulkPatch(action.body, action.success);
  }

  const groups = useMemo(() => {
    const campaigns = data?.campaigns ?? [];
    if (status !== "all") {
      return [
        {
          key: status,
          label:
            status === "drafts"
              ? "Drafts"
              : status === "running"
                ? "Running Campaigns"
                : status === "archived"
                  ? "Archived"
                  : titleCase(status),
          campaigns,
        },
      ];
    }
    return [
      { key: "drafts", label: "Drafts", campaigns: campaigns.filter((campaign) => ["draft", "review"].includes(campaign.status)) },
      { key: "running", label: "Running Campaigns", campaigns: campaigns.filter((campaign) => campaign.status === "active") },
      { key: "paused", label: "Paused Campaigns", campaigns: campaigns.filter((campaign) => campaign.status === "paused") },
      { key: "completed", label: "Completed", campaigns: campaigns.filter((campaign) => campaign.status === "completed") },
    ].filter((group) => group.campaigns.length > 0);
  }, [data?.campaigns, status]);

  const availableChannels = useMemo(
    () => [...new Set((data?.campaigns ?? []).flatMap((campaign) => campaign.channels))],
    [data?.campaigns],
  );
  const summary = data?.summary;
  const runningDetail = summary
    ? percentChange(summary.deltas.running.current, summary.deltas.running.previous)
    : "Loading";
  const meetingsDetail = summary
    ? percentChange(summary.deltas.meetings.current, summary.deltas.meetings.previous)
    : "Loading";
  const allVisibleIds = useMemo(() => (data?.campaigns ?? []).map((campaign) => campaign.id), [data?.campaigns]);
  const allSelected = allVisibleIds.length > 0 && allVisibleIds.every((id) => selectedIds.has(id));

  return (
    <div className={cn("space-y-7", selectedIds.size > 0 && "pb-28 sm:pb-32")}>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Campaigns</h1>
          <p className="mt-2 text-sm text-app-fg-muted">
            Create, review, launch, and control outreach campaigns.
          </p>
        </div>
        <CampaignCreateDialog accounts={accounts} onCreated={load} />
      </header>

      {error ? (
        <p className="rounded-lg border border-onboarding-error-500/30 bg-onboarding-error-50 p-4 text-sm text-onboarding-error-900 dark:bg-onboarding-error-500/15 dark:text-onboarding-error-100">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={Send} value={summary?.total ?? 0} label="Total Campaigns" detail="All time" tone="purple" />
        <MetricCard
          icon={Play}
          value={summary?.running ?? 0}
          label="Running Campaigns"
          detail={runningDetail}
          tone="green"
          detailClassName={trendDetailClass(runningDetail)}
        />
        <MetricCard icon={Pencil} value={summary?.drafts ?? 0} label="Drafts" detail="Ready to launch" tone="gray" />
        <MetricCard
          icon={Trophy}
          value={summary?.meetings ?? 0}
          label="Meetings Booked"
          detail={meetingsDetail}
          tone="yellow"
          detailClassName={trendDetailClass(meetingsDetail)}
        />
      </div>

      <div>
      <Tabs value={status} onValueChange={(value) => setStatus(value as FilterStatus)} className="gap-4">
        <div className="flex flex-col gap-3 border-b border-app-border pb-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="lg:hidden">
            <Filter
              value={status === "all" ? "" : status}
              groups={[{ label: "Campaign status", options: [
                { value: "drafts", label: `Drafts (${summary?.drafts ?? 0})` },
                { value: "running", label: `Running (${summary?.running ?? 0})` },
                { value: "paused", label: `Paused (${summary?.paused ?? 0})` },
                { value: "completed", label: `Completed (${summary?.completed ?? 0})` },
                { value: "archived", label: `Archived (${summary?.archived ?? 0})` },
              ] }]}
              onValueChange={(value) => setStatus((value || "all") as FilterStatus)}
              allLabel="All Campaigns"
              className="w-full"
              aria-label="Campaign status filter"
            />
          </div>
          <TabsList variant="line" className="hidden w-full flex-wrap justify-start lg:flex lg:w-auto">
            <TabsTrigger value="all">All Campaigns</TabsTrigger>
            <TabsTrigger value="drafts">
              Drafts <Badge variant="secondary">{summary?.drafts ?? 0}</Badge>
            </TabsTrigger>
            <TabsTrigger value="running">
              Running <Badge variant="secondary">{summary?.running ?? 0}</Badge>
            </TabsTrigger>
            <TabsTrigger value="paused">
              Paused <Badge variant="secondary">{summary?.paused ?? 0}</Badge>
            </TabsTrigger>
            <TabsTrigger value="completed">
              Completed <Badge variant="secondary">{summary?.completed ?? 0}</Badge>
            </TabsTrigger>
            <TabsTrigger value="archived">
              Archived <Badge variant="secondary">{summary?.archived ?? 0}</Badge>
            </TabsTrigger>
          </TabsList>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-onboarding-neutral-500" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search campaigns..."
                className="h-9 pl-9 sm:w-64"
              />
            </label>
            <Filter
              value={channel === "all" ? "" : channel}
              groups={[{ label: "Channels", options: availableChannels.map((value) => ({
                value,
                label: channelLabel(value),
                icon: <DashboardChannelLogo platform={value} className="size-5" />,
              })) }] as FilterGroup[]}
              onValueChange={(value) => setChannel(value || "all")}
              allLabel="All channels"
              allIcon={<DashboardChannelLogo platform="linkedin" className="size-5" />}
              className="h-9 min-w-36 text-sm font-normal"
              aria-label="Campaign channel filter"
            />
            {isRefreshing ? <span className="self-center text-xs text-muted-foreground" aria-live="polite">Updating…</span> : null}
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Checkbox
            checked={allSelected}
            onCheckedChange={(checked) => setSelectedIds(checked === true ? new Set(allVisibleIds) : new Set())}
            aria-label="Select all visible campaigns"
          />
          Select all visible
        </div>

        <div className="space-y-6 pt-1">
          {isLoading ? (
            <Card>
              <CardContent className="space-y-3 py-5">
                <div className="h-5 w-40 animate-pulse rounded bg-muted" />
                <div className="h-24 animate-pulse rounded-lg bg-muted" />
                <div className="h-24 animate-pulse rounded-lg bg-muted" />
              </CardContent>
            </Card>
          ) : groups.length === 0 ? (
            <Card>
              <CardContent className="py-14 text-center">
                <p className="font-semibold">No campaigns match these filters</p>
                <p className="mt-2 text-sm text-app-fg-muted">
                  {debouncedSearch || channel !== "all" || status !== "all" ? "No campaigns match the current filters." : "Create a draft to begin building outreach."}
                </p>
                {debouncedSearch || channel !== "all" || status !== "all" ? <Button variant="secondary" className="mt-4" onClick={() => { setSearch(""); setChannel("all"); setStatus("all"); }}>Clear filters</Button> : null}
              </CardContent>
            </Card>
          ) : (
            groups.map((group) => (
              <section key={group.key} aria-labelledby={`${group.key}-heading`}>
                <h2 id={`${group.key}-heading`} className="mb-3 text-xl font-semibold">
                  {group.label} <span className="text-app-fg-subtle">({group.campaigns.length})</span>
                </h2>
                <Card className="overflow-hidden">
                  <CardContent className="p-0">
                    <ul className="divide-y divide-app-border">
                      {group.campaigns.map((campaign) => (
                        <CampaignRowView
                          key={campaign.id}
                          campaign={campaign}
                          selected={selectedIds.has(campaign.id)}
                          onToggleSelect={(id, checked) => {
                            setSelectedIds((current) => {
                              const next = new Set(current);
                              if (checked) next.add(id);
                              else next.delete(id);
                              return next;
                            });
                          }}
                          onPrefetch={prefetchCampaignDetail}
                          handlers={handlers}
                        />
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </section>
            ))
          )}
        </div>
      </Tabs>
      </div>

      <CampaignSelectionActionBar
        count={selectedIds.size}
        isActing={isActing}
        onPause={() => setPendingAction({ campaignIds: [...selectedIds], body: { status: "paused" }, title: `Pause ${selectedIds.size} campaigns?`, description: "Pending outreach for every selected campaign will stop until resumed.", success: "Selected campaigns paused" })}
        onResume={() => void bulkPatch({ status: "active" }, "Selected campaigns resumed")}
        onArchive={() => setPendingAction({ campaignIds: [...selectedIds], body: { archived: true }, title: `Archive ${selectedIds.size} campaigns?`, description: "Selected campaigns will be hidden from active views while their history remains available.", success: "Selected campaigns archived" })}
        onClear={() => setSelectedIds(new Set())}
      />

      <CampaignDetails
        campaignId={selectedId}
        accounts={accounts}
        onClose={() => setSelectedId(null)}
        onChanged={load}
      />
      <Dialog open={Boolean(pendingAction)} onOpenChange={(open) => { if (!open) setPendingAction(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{pendingAction?.title}</DialogTitle>
            <DialogDescription>{pendingAction?.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingAction(null)}>Cancel</Button>
            <Button variant="brand" disabled={isActing} onClick={() => void confirmPendingAction()}>{pendingAction?.body.archived ? <Archive /> : <Pause />} Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
