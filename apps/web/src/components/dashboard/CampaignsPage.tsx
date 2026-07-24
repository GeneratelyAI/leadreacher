"use client";

import Link from "next/link";
import {
  Archive,
  BarChart3,
  CalendarDays,
  Check,
  Clock3,
  Copy,
  Ellipsis,
  Eye,
  Filter,
  Loader2,
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
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { CampaignDetailSheet } from "@/components/dashboard/CampaignDetailSheet";
import { defaultSequenceDraft, SequenceBuilder, type SequenceStepDraft } from "@/components/dashboard/SequenceBuilder";
import { MetricCard } from "@/components/patterns/MetricCard";
import { SelectionToolbar, SelectionToolbarAction } from "@/components/patterns/SelectionToolbar";
import type { CampaignVideoSummary } from "@/components/dashboard/CampaignVideoView";
import { ChannelLogo } from "@/components/onboarding/ChannelLogo";
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
import { cn } from "@/lib/utils";

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
          {channel === "linkedin" || channel === "whatsapp" ? <ChannelLogo name={channel} className="size-4" /> : null}
          {channelLabel(channel)}
        </span>
      ))}
    </div>
  );
}

function VideoChip({ video }: { video?: CampaignVideoSummary | null }) {
  if (!video || video.status === "unused") return null;
  const label =
    video.status === "pending" || video.status === "generating"
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

function CampaignActions({ campaign, handlers }: { campaign: CampaignRow; handlers: ActionHandlers }) {
  const primaryLabel = campaign.status === "completed" ? "View report" : campaign.status === "active" ? "View" : campaign.status === "paused" ? "View" : "Review";
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
      <Button
        variant={campaign.status === "active" || needsProspects ? "outline" : "primary"}
        size="sm"
        onClick={() => handlers.onOpen(campaign)}
      >
        {primaryLabel}
      </Button>
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
  handlers,
}: {
  campaign: CampaignRow;
  selected: boolean;
  onToggleSelect: (id: string, checked: boolean) => void;
  handlers: ActionHandlers;
}) {
  return (
    <li
      data-selected={selected ? "true" : undefined}
      className={cn(
        "app-list-row relative px-5 py-5 transition-colors sm:px-6",
        selected && "bg-onboarding-purple-50/70 dark:bg-onboarding-purple-900/25",
      )}
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
                  <span className={cn(campaign.senderAccount.status !== "active" && "text-onboarding-error-600")}>
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
          </div>
        </div>
        <div className="grid grid-cols-3 gap-5 xl:min-w-[28rem] xl:grid-cols-3">
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
  const [name, setName] = useState("");
  const [sequence, setSequence] = useState<SequenceStepDraft[]>(() => defaultSequenceDraft());
  const [senderAccountId, setSenderAccountId] = useState("");
  const [includeWhatsapp, setIncludeWhatsapp] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeAccounts = accounts.filter((account) => account.platform === "linkedin" && account.status === "active");

  useEffect(() => {
    if (!senderAccountId) setSenderAccountId(activeAccounts[0]?.id ?? "");
  }, [activeAccounts, senderAccountId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sequence.some((step) => !step.message.trim())) {
      setError("Every sequence step needs a message.");
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const channels = includeWhatsapp ? ["linkedin", "whatsapp"] : ["linkedin"];
      await apiFetch("/campaigns", {
        method: "POST",
        body: JSON.stringify({
          name,
          channels,
          socialAccountId: senderAccountId,
          sequence: sequence.map((step, index) => ({
            type: index === 0 ? "linkedin_invite" : "linkedin_message",
            message: step.message.trim(),
            delayHours: index === 0 ? 0 : step.delayHours,
          })),
        }),
      });
      setName("");
      setSequence(defaultSequenceDraft());
      setIncludeWhatsapp(false);
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
              Campaign name
              <Input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Q3 founder outreach" />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              LinkedIn sender
              <Select value={senderAccountId || null} onValueChange={(value) => setSenderAccountId(value ?? "")} required>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a connected account" />
                </SelectTrigger>
                <SelectContent>
                  {activeAccounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.accountName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          </div>
          <label className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
            <Checkbox checked={includeWhatsapp} onCheckedChange={(checked) => setIncludeWhatsapp(checked === true)} />
            <span>
              Also target WhatsApp
              <span className="mt-0.5 block text-xs text-muted-foreground">Stored on the campaign; LinkedIn remains the live send path today.</span>
            </span>
          </label>
          <div className="space-y-2">
            <p className="text-sm font-medium">Sequence</p>
            <SequenceBuilder value={sequence} onChange={setSequence} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isSaving} disabled={!senderAccountId}>
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

export function CampaignsPage() {
  const [data, setData] = useState<CampaignResponse | null>(null);
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [status, setStatus] = useState<FilterStatus>("all");
  const [search, setSearch] = useState("");
  const [channel, setChannel] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isActing, setIsActing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        status,
        ...(search ? { search } : {}),
        ...(channel !== "all" ? { channel } : {}),
      });
      const [campaignResponse, accountResponse] = await Promise.all([
        apiFetch<CampaignResponse>(`/dashboard/campaigns?${params.toString()}`),
        apiFetch<{ accounts: SocialAccount[] }>("/social-accounts"),
      ]);
      setData(campaignResponse);
      setAccounts(accountResponse.accounts);
      setError(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load campaigns.");
    } finally {
      setIsLoading(false);
    }
  }, [channel, search, status]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [status, search, channel]);

  async function patchCampaign(id: string, body: Record<string, unknown>, success: string) {
    setIsActing(true);
    try {
      await apiFetch(`/campaigns/${id}`, { method: "PATCH", body: JSON.stringify(body) });
      toast.success(success);
      await load();
    } catch (requestError) {
      const message = requestError instanceof ApiError ? requestError.message : "Unable to update campaign.";
      setError(message);
      toast.error(message);
    } finally {
      setIsActing(false);
    }
  }

  const handlers: ActionHandlers = {
    onOpen: (campaign) => setSelectedId(campaign.id),
    onPause: (campaign) => void patchCampaign(campaign.id, { status: "paused" }, "Campaign paused"),
    onResume: (campaign) => void patchCampaign(campaign.id, { status: "active" }, "Campaign resumed"),
    onComplete: (campaign) => void patchCampaign(campaign.id, { status: "completed" }, "Campaign completed"),
    onArchive: (campaign) =>
      void patchCampaign(campaign.id, { archived: !campaign.archived }, campaign.archived ? "Campaign restored" : "Campaign archived"),
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
          <TabsList variant="line" className="w-full flex-wrap justify-start lg:w-auto">
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
            <Select value={channel} onValueChange={(value) => setChannel(value ?? "all")}>
              <SelectTrigger className="h-9 min-w-36">
                <Filter className="size-4" />
                <SelectValue placeholder="All Channels" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Channels</SelectItem>
                {availableChannels.map((value) => (
                  <SelectItem key={value} value={value}>
                    {channelLabel(value)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
              <CardContent className="flex min-h-48 items-center justify-center text-sm text-onboarding-neutral-500">
                <Loader2 className="mr-2 size-4 animate-spin" />
                Loading campaigns
              </CardContent>
            </Card>
          ) : groups.length === 0 ? (
            <Card>
              <CardContent className="py-14 text-center">
                <p className="font-semibold">No campaigns match these filters</p>
                <p className="mt-2 text-sm text-app-fg-muted">
                  Create a draft or adjust the status, channel, and search filters.
                </p>
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
        onPause={() => void bulkPatch({ status: "paused" }, "Selected campaigns paused")}
        onResume={() => void bulkPatch({ status: "active" }, "Selected campaigns resumed")}
        onArchive={() => void bulkPatch({ archived: true }, "Selected campaigns archived")}
        onClear={() => setSelectedIds(new Set())}
      />

      <CampaignDetailSheet
        campaignId={selectedId}
        accounts={accounts}
        onClose={() => setSelectedId(null)}
        onChanged={load}
      />
    </div>
  );
}
