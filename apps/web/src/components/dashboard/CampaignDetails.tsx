"use client";

import Link from "next/link";
import {
  CheckCircle2,
  CircleHelp,
  Clock,
  Info,
  Loader2,
  LayoutDashboard,
  MessageSquare,
  Pause,
  Pencil,
  Play,
  RefreshCw,
  Send,
  UserCheck,
  UserPlus,
  Users,
  Video,
} from "@/components/ui/icons";
import { useQueryClient } from "@tanstack/react-query";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { CampaignVideo, type CampaignVideoSummary } from "@/components/dashboard/CampaignVideo";
import { SequenceBuilder } from "@/components/dashboard/SequenceBuilder";
import { channelDisplayName, DashboardChannelLogo, formatSocialMediaNames } from "@/components/dashboard/ChannelIdentity";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDashboardEvents } from "@/components/providers/DashboardDataProvider";
import { ApiError, apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

type SequenceStep = { type: string; message: string; delayHours: number };
type OnboardingDiscovery = {
  status: "queued" | "running" | "completed" | "failed";
  prospectCount: number;
  error?: string;
  updatedAt: string;
};

export type CampaignDetail = {
  id: string;
  name: string;
  naming: { audience: string; channelLabel: string; goal: string } | null;
  status: string;
  channels: string[];
  sequence: SequenceStep[] | unknown;
  archived: boolean;
  onboardingDiscovery: OnboardingDiscovery | null;
  socialAccountId: string | null;
  senderAccount: {
    id: string;
    platform: string;
    accountName: string;
    status: string;
    avatarUrl: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
  prospectCount: number;
  reviewSummary: {
    pending: number;
    approved: number;
    excluded: number;
  };
  metrics: {
    sent: number;
    replies: number;
    meetings: number;
    replyRate: number | null;
    meetingRate: number | null;
  };
  video: CampaignVideoSummary;
  leads: Array<{
    id: string;
    leadId: string;
    name: string;
    company: string;
    leadStatus: string;
    campaignLeadStatus: string;
    currentStep: number;
    linkedinRelationship: "unknown" | "connected" | "invite_required" | "unresolved";
    relationshipCheckedAt: string | null;
    avatarUrl: string | null;
  }>;
  launchReady: {
    hasLeads: boolean;
    hasApprovedAudience: boolean;
    hasSequenceReview: boolean;
    hasSender: boolean;
    reasons: string[];
  };
  audienceRouting: {
    total: number;
    directMessage: number;
    inviteRequired: number;
    unresolved: number;
    unknown: number;
    checked: number;
  };
};

type CampaignDetailsProps = {
  campaignId: string | null;
  accounts: Array<{ id: string; platform: string; accountName: string; status: string }>;
  onClose: () => void;
  onChanged: () => Promise<void> | void;
};

type ChannelPreflight = {
  instagram?: {
    total: number; reachable: number; unresolved: number; invalid: number; errors: number; suppressed: number;
    capacity: { stage: string; dailyLimit: number; dailyRemaining: number; hourlyLimit: number; hourlyRemaining: number; pacingRemainingMs: number; resetAt: string };
  };
  whatsapp?: { total: number; reachable: number; invalidPhone: number; missingConsent: number; suppressed: number };
};

function titleCase(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function campaignChannelLabel(channels: string[]): string {
  return channels.length === 1 ? channelDisplayName(channels[0]) : "Multi-channel";
}

function asSequence(value: unknown): SequenceStep[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (step): step is SequenceStep =>
      Boolean(step) &&
      typeof step === "object" &&
      typeof (step as SequenceStep).type === "string" &&
      typeof (step as SequenceStep).message === "string" &&
      typeof (step as SequenceStep).delayHours === "number",
  );
}

function sequenceStepChannel(type: string): string | null {
  const normalized = type.trim().toLowerCase();
  if (normalized.includes("linkedin")) return "linkedin";
  if (normalized.includes("whatsapp")) return "whatsapp";
  if (normalized.includes("instagram")) return "instagram";
  if (normalized.includes("facebook") || normalized.includes("messenger")) return "facebook";
  if (normalized.includes("email")) return "email";
  return null;
}

function sequenceStepLabel(type: string, index: number): string {
  const normalized = type.trim().toLowerCase();
  if (normalized === "linkedin_invite") return "LinkedIn introduction";
  if (normalized === "linkedin_message") return index === 0 ? "LinkedIn introduction" : "LinkedIn follow-up";
  if (normalized === "whatsapp_message") return "WhatsApp message";
  if (normalized === "instagram_message") return "Instagram message";
  if (normalized === "facebook_message") return "Facebook message";
  if (normalized === "email") return "Email follow-up";
  if (normalized.includes("video")) return "Personalized video";
  return titleCase(type);
}

function formatWaitTime(hours: number): string {
  if (hours === 24) return "Wait 1 day";
  if (hours > 24 && hours % 24 === 0) return `Wait ${hours / 24} days`;
  if (hours === 1) return "Wait 1 hour";
  return `Wait ${hours} hours`;
}

function sequenceDay(steps: SequenceStep[], index: number): number {
  const elapsedHours = steps.slice(0, index + 1).reduce((sum, step) => sum + Math.max(0, step.delayHours), 0);
  return Math.floor(elapsedHours / 24) + 1;
}

export function CampaignDetails({
  campaignId,
  accounts,
  onClose,
  onChanged,
}: CampaignDetailsProps) {
  const queryClient = useQueryClient();
  const [detail, setDetail] = useState<CampaignDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [namingAudience, setNamingAudience] = useState("");
  const [namingGoal, setNamingGoal] = useState("");
  const [sequence, setSequence] = useState<SequenceStep[]>([]);
  const [senderAccountId, setSenderAccountId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmLaunchOpen, setConfirmLaunchOpen] = useState(false);
  const [isRefreshingRelationships, setIsRefreshingRelationships] = useState(false);
  const [relationshipCursor, setRelationshipCursor] = useState<string | null>(null);
  const [channelPreflight, setChannelPreflight] = useState<ChannelPreflight | null>(null);
  const [isCheckingChannels, setIsCheckingChannels] = useState(false);
  const [isRetryingDiscovery, setIsRetryingDiscovery] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const sequenceSectionRef = useRef<HTMLElement>(null);
  const launchReadinessRef = useRef<HTMLElement>(null);

  const checkChannels = useCallback(async (id: string) => {
    setIsCheckingChannels(true);
    try {
      setChannelPreflight(await apiFetch<ChannelPreflight>(`/campaigns/${id}/channel-preflight`, { method: "POST", body: JSON.stringify({}) }));
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : "Unable to check channel readiness.");
    } finally {
      setIsCheckingChannels(false);
    }
  }, []);

  const applyCampaignDetail = useCallback((next: CampaignDetail, id: string) => {
    setDetail(next);
    setName(next.name);
    setNamingAudience(next.naming?.audience ?? "");
    setNamingGoal(next.naming?.goal ?? "");
    setSequence(asSequence(next.sequence));
    setSenderAccountId(next.socialAccountId ?? "");
    setRelationshipCursor(null);
    setEditing(false);
    if (["draft", "review"].includes(next.status) && next.channels.some((channel) => channel === "instagram" || channel === "whatsapp")) {
      void checkChannels(id);
    } else {
      setChannelPreflight(null);
    }
  }, [checkChannels]);

  const load = useCallback(async (id: string) => {
    const queryKey = ["dashboard", "campaign", id] as const;
    const cached = queryClient.getQueryData<CampaignDetail>(queryKey);
    setIsLoading(!cached);
    setError(null);
    if (cached) applyCampaignDetail(cached, id);
    try {
      const next = await queryClient.fetchQuery({
        queryKey,
        queryFn: () => apiFetch<CampaignDetail>(`/campaigns/${id}`),
        staleTime: 10_000,
      });
      applyCampaignDetail(next, id);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load campaign.");
    } finally {
      setIsLoading(false);
    }
  }, [applyCampaignDetail, queryClient]);

  useEffect(() => {
    if (!campaignId) {
      setDetail(null);
      return;
    }
    setActiveTab("overview");
    void load(campaignId);
  }, [campaignId, load]);

  useDashboardEvents(useCallback((event) => {
    if (!campaignId || event.resources.campaignId !== campaignId) return;
    if (["campaign.updated", "campaign.metrics.updated", "video.updated"].includes(event.type)) {
      void load(campaignId);
    }
  }, [campaignId, load]));

  useEffect(() => {
    const discoveryStatus = detail?.onboardingDiscovery?.status;
    if (!campaignId || (discoveryStatus !== "queued" && discoveryStatus !== "running")) {
      return undefined;
    }
    const timer = window.setTimeout(() => void load(campaignId), 2_500);
    return () => window.clearTimeout(timer);
  }, [campaignId, detail?.onboardingDiscovery?.status, load]);

  async function patch(body: Record<string, unknown>, successMessage: string) {
    if (!campaignId) return;
    setIsSaving(true);
    setError(null);
    try {
      await apiFetch(`/campaigns/${campaignId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      toast.success(successMessage);
      await load(campaignId);
      await onChanged();
    } catch (requestError) {
      const message = requestError instanceof ApiError ? requestError.message : "Unable to update campaign.";
      setError(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  }

  async function launch() {
    if (!campaignId) return;
    setIsSaving(true);
    try {
      const result = await apiFetch<{
        channelReachability?: {
          instagram?: { reachable: number; unresolved: number; suppressed: number };
        };
      }>(`/campaigns/${campaignId}/launch`, { method: "POST", body: JSON.stringify({}) });
      const instagram = result.channelReachability?.instagram;
      toast.success(
        instagram
          ? `Campaign launched for ${instagram.reachable} Instagram prospect${instagram.reachable === 1 ? "" : "s"}${instagram.unresolved || instagram.suppressed ? `; ${instagram.unresolved + instagram.suppressed} skipped` : ""}`
          : "Campaign launched",
      );
      await load(campaignId);
      await onChanged();
    } catch (requestError) {
      const message = requestError instanceof ApiError ? requestError.message : "Unable to launch campaign.";
      setError(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  }

  async function refreshRelationships() {
    if (!campaignId || isRefreshingRelationships) return;
    setIsRefreshingRelationships(true);
    setError(null);
    try {
      const result = await apiFetch<CampaignDetail["audienceRouting"] & {
        processed: number;
        hasMore: boolean;
        nextCursor: string | null;
      }>(`/campaigns/${campaignId}/relationships/refresh`, {
        method: "POST",
        body: JSON.stringify(relationshipCursor ? { cursor: relationshipCursor } : {}),
      });
      setDetail((current) => current ? { ...current, audienceRouting: result } : current);
      setRelationshipCursor(result.hasMore ? result.nextCursor : null);
      toast.success(
        result.hasMore
          ? `Checked ${result.processed} prospects. Continue to check the remaining audience.`
          : `Checked ${result.processed} prospect${result.processed === 1 ? "" : "s"}`,
      );
    } catch (requestError) {
      const message = requestError instanceof ApiError
        ? requestError.message
        : "Unable to check LinkedIn relationships.";
      setError(message);
      toast.error(message);
    } finally {
      setIsRefreshingRelationships(false);
    }
  }

  async function saveEdits() {
    await patch(
      {
        ...(namingAudience.trim() && namingGoal.trim()
          ? { naming: { audience: namingAudience.trim(), channelLabel: campaignChannelLabel(detail?.channels ?? []), goal: namingGoal.trim() } }
          : { name }),
        sequence,
        ...(senderAccountId ? { socialAccountId: senderAccountId } : {}),
      },
      "Campaign updated",
    );
    setEditing(false);
  }

  async function retryDiscovery() {
    if (!campaignId || isRetryingDiscovery) return;
    setIsRetryingDiscovery(true);
    setError(null);
    try {
      await apiFetch(`/onboarding/campaigns/${campaignId}/discovery/retry`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      toast.success("Prospect discovery restarted");
      await load(campaignId);
      await onChanged();
    } catch (requestError) {
      const message = requestError instanceof ApiError
        ? requestError.message
        : "Unable to restart prospect discovery.";
      setError(message);
      toast.error(message);
    } finally {
      setIsRetryingDiscovery(false);
    }
  }

  const open = Boolean(campaignId);
  const activeSenders = accounts.filter((account) => account.platform === "linkedin" && account.status === "active");
  const availableSequenceChannels = useMemo(
    () => [...new Set(accounts.filter((account) => account.status === "active").map((account) => account.platform))],
    [accounts],
  );
  const canLaunch =
    detail &&
    ["draft", "review"].includes(detail.status) &&
    detail.launchReady.hasLeads &&
    detail.launchReady.hasApprovedAudience &&
    detail.launchReady.hasSequenceReview &&
    detail.launchReady.hasSender;
  const sequenceEditable = detail ? ["draft", "review", "paused"].includes(detail.status) : false;
  const sequenceLocked = detail?.status === "active";
  const launchChecklist = detail
    ? [
      {
        key: "prospects",
        complete: detail.launchReady.hasLeads,
        label: "Prospects added",
        description: detail.launchReady.hasLeads
          ? `${detail.prospectCount} enrolled`
          : "Add at least one prospect to this campaign.",
        href: `/dashboard/prospects?enrollCampaignId=${detail.id}`,
        action: "Add prospects",
      },
      {
        key: "audience",
        complete: detail.launchReady.hasApprovedAudience,
        label: "Audience approved",
        description: detail.launchReady.hasApprovedAudience
          ? `${detail.reviewSummary.approved} approved`
          : `${detail.reviewSummary.pending} prospect${detail.reviewSummary.pending === 1 ? "" : "s"} still need review.`,
        href: `/dashboard/prospects?campaignId=${detail.id}`,
        action: "Review audience",
      },
      {
        key: "sequence",
        complete: detail.launchReady.hasSequenceReview,
        label: "Messaging reviewed",
        description: detail.launchReady.hasSequenceReview
          ? "Outreach copy is ready."
          : "Review and save your outreach messaging.",
        action: "Review messaging",
      },
      {
        key: "sender",
        complete: detail.launchReady.hasSender,
        label: "Active sender",
        description: detail.launchReady.hasSender
          ? `${detail.senderAccount?.accountName ?? "Sender"} is active.`
          : "Connect and select an active sender.",
        href: "/dashboard/channels",
        action: "Connect sender",
      },
    ]
    : [];

  function reviewConnectionNote() {
    setEditing(true);
    setActiveTab("sequence");
    window.requestAnimationFrame(() => {
      sequenceSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function showLaunchReadiness() {
    setActiveTab("overview");
    window.requestAnimationFrame(() => {
      launchReadinessRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  function handleDialogKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const target = event.target;
    if (target instanceof HTMLElement && target.closest("input, textarea, select, [contenteditable='true']")) return;
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    const tabs = ["overview", "audience", "sequence", "delivery"];
    const index = tabs.indexOf(activeTab);
    const next = event.key === "ArrowRight"
      ? (index + 1) % tabs.length
      : (index - 1 + tabs.length) % tabs.length;
    event.preventDefault();
    setActiveTab(tabs[next]);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent
        onKeyDownCapture={handleDialogKeyDown}
        className="top-0 left-0 flex h-dvh w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-0 p-0 sm:top-1/2 sm:left-1/2 sm:h-[min(92dvh,52rem)] sm:w-[calc(100%_-_2rem)] sm:max-w-5xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl sm:border"
        showCloseButton
      >
        {isLoading ? (
          <div className="space-y-4 p-6">
            <Skeleton className="h-7 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-24 w-full" />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><Skeleton className="h-20" /><Skeleton className="h-20" /><Skeleton className="h-20" /><Skeleton className="h-20" /></div>
            <Skeleton className="h-48 w-full" />
          </div>
        ) : !detail ? (
          <div className="flex min-h-72 items-center justify-center p-6">
            <Alert
              className="w-full max-w-md"
              tone="error"
              title="Campaign details could not load"
              action={
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!campaignId}
                  onClick={() => campaignId && void load(campaignId)}
                >
                  <RefreshCw /> Retry
                </Button>
              }
            >
              {error ?? "Please try again."}
            </Alert>
          </div>
        ) : (
          <>
            <DialogHeader className="shrink-0 px-5 py-5 pr-14 text-left sm:px-6">
              <div className="flex flex-wrap items-center gap-2">
                <DialogTitle className="text-2xl tracking-tight">{formatSocialMediaNames(detail.name)}</DialogTitle>
                <Badge variant="outline">{detail.status === "active" ? "Running" : titleCase(detail.status)}</Badge>
                {detail.archived ? <Badge variant="secondary">Archived</Badge> : null}
              </div>
              <DialogDescription>
                {detail.channels.map((channel) => channelDisplayName(channel)).join(" · ")} · Updated{" "}
                {new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(detail.updatedAt))}
              </DialogDescription>
            </DialogHeader>

            {error ? (
              <p className="mx-5 mt-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive sm:mx-6">{error}</p>
            ) : null}

            <Tabs value={activeTab} onValueChange={setActiveTab} className="min-h-0 flex-1 gap-0">
              <TabsList className="mx-5 grid h-auto w-auto min-w-0 shrink-0 grid-cols-4 overflow-hidden rounded-2xl border border-onboarding-neutral-150 bg-onboarding-neutral-50/80 p-1.5 shadow-[0_1px_2px_rgb(15_23_42/0.05)] group-data-horizontal/tabs:!h-auto dark:border-onboarding-neutral-700 dark:bg-onboarding-neutral-900 sm:mx-6">
                <TabsTrigger value="overview" className="h-[4.5rem] flex-col gap-1.5 rounded-xl px-2.5 py-2 text-sm font-semibold text-onboarding-neutral-500 after:hidden hover:bg-onboarding-neutral-100 hover:text-onboarding-ink data-active:border-onboarding-purple-200 data-active:bg-background data-active:text-onboarding-purple-700 data-active:shadow-[0_2px_8px_rgb(83_38_183/0.1)] dark:text-onboarding-neutral-400 dark:hover:bg-onboarding-neutral-800 dark:hover:text-onboarding-neutral-0 dark:data-active:border-onboarding-purple-700 dark:data-active:bg-onboarding-neutral-800 dark:data-active:text-onboarding-purple-200 [&_svg]:size-5">
                  <LayoutDashboard weight="fill" aria-hidden />
                  Overview
                </TabsTrigger>
                <TabsTrigger value="audience" className="h-[4.5rem] flex-col gap-1.5 rounded-xl px-2.5 py-2 text-sm font-semibold text-onboarding-neutral-500 after:hidden hover:bg-onboarding-neutral-100 hover:text-onboarding-ink data-active:border-onboarding-purple-200 data-active:bg-background data-active:text-onboarding-purple-700 data-active:shadow-[0_2px_8px_rgb(83_38_183/0.1)] dark:text-onboarding-neutral-400 dark:hover:bg-onboarding-neutral-800 dark:hover:text-onboarding-neutral-0 dark:data-active:border-onboarding-purple-700 dark:data-active:bg-onboarding-neutral-800 dark:data-active:text-onboarding-purple-200 [&_svg]:size-5">
                  <Users weight="fill" aria-hidden />
                  Audience
                </TabsTrigger>
                <TabsTrigger value="sequence" className="h-[4.5rem] flex-col gap-1.5 rounded-xl px-2.5 py-2 text-sm font-semibold text-onboarding-neutral-500 after:hidden hover:bg-onboarding-neutral-100 hover:text-onboarding-ink data-active:border-onboarding-purple-200 data-active:bg-background data-active:text-onboarding-purple-700 data-active:shadow-[0_2px_8px_rgb(83_38_183/0.1)] dark:text-onboarding-neutral-400 dark:hover:bg-onboarding-neutral-800 dark:hover:text-onboarding-neutral-0 dark:data-active:border-onboarding-purple-700 dark:data-active:bg-onboarding-neutral-800 dark:data-active:text-onboarding-purple-200 [&_svg]:size-5">
                  <MessageSquare weight="fill" aria-hidden />
                  Messaging
                </TabsTrigger>
                <TabsTrigger value="delivery" className="h-[4.5rem] flex-col gap-1.5 rounded-xl px-2.5 py-2 text-sm font-semibold text-onboarding-neutral-500 after:hidden hover:bg-onboarding-neutral-100 hover:text-onboarding-ink data-active:border-onboarding-purple-200 data-active:bg-background data-active:text-onboarding-purple-700 data-active:shadow-[0_2px_8px_rgb(83_38_183/0.1)] dark:text-onboarding-neutral-400 dark:hover:bg-onboarding-neutral-800 dark:hover:text-onboarding-neutral-0 dark:data-active:border-onboarding-purple-700 dark:data-active:bg-onboarding-neutral-800 dark:data-active:text-onboarding-purple-200 [&_svg]:size-5">
                  <Send weight="fill" aria-hidden />
                  Delivery
                </TabsTrigger>
              </TabsList>
            <TabsContent value="overview" className="min-h-0 overflow-y-auto px-5 py-5 sm:px-6"><div className="space-y-6">
              {detail.onboardingDiscovery ? (
                <Alert
                  tone={detail.onboardingDiscovery.status === "failed" ? "error" : detail.onboardingDiscovery.status === "completed" ? "success" : "info"}
                  title={
                    detail.onboardingDiscovery.status === "queued"
                      ? "Preparing your LinkedIn audience"
                      : detail.onboardingDiscovery.status === "running"
                        ? "Finding prospects in your LinkedIn network"
                        : detail.onboardingDiscovery.status === "completed"
                          ? `${detail.onboardingDiscovery.prospectCount} prospects are ready for review`
                          : "Prospect discovery needs attention"
                  }
                  action={
                    detail.onboardingDiscovery.status === "completed" ? (
                      <Button size="sm" variant="outline" asChild>
                        <Link href={`/dashboard/prospects?campaignId=${detail.id}`}>Review prospects</Link>
                      </Button>
                    ) : detail.onboardingDiscovery.status === "failed" ? (
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" asChild>
                          <Link href="/onboarding?step=strategy&substep=targeting">Edit audience</Link>
                        </Button>
                        <Button size="sm" variant="brand" disabled={isRetryingDiscovery} onClick={() => void retryDiscovery()}>
                          <RefreshCw className={cn(isRetryingDiscovery && "animate-spin")} /> Retry
                        </Button>
                      </div>
                    ) : undefined
                  }
                >
                  {detail.onboardingDiscovery.status === "queued" || detail.onboardingDiscovery.status === "running"
                    ? "This continues in the background. You can keep this review open while the audience is prepared."
                    : detail.onboardingDiscovery.status === "failed"
                      ? detail.onboardingDiscovery.error
                      : "Approve or exclude every prospect, then save the connection note before launch."}
                </Alert>
              ) : null}
              <div className="flex flex-wrap gap-2">
                {detail.status === "active" ? (
                  <Button size="sm" className="min-h-10 sm:min-h-8" variant="outline" disabled={isSaving} onClick={() => void patch({ status: "paused" }, "Campaign paused")}>
                    <Pause /> Pause
                  </Button>
                ) : null}
                {detail.status === "paused" ? (
                  <Button size="sm" className="min-h-10 sm:min-h-8" variant="brand" disabled={isSaving} onClick={() => void patch({ status: "active" }, "Campaign resumed")}>
                    <Play /> Resume
                  </Button>
                ) : null}
                {["draft", "review"].includes(detail.status) ? (
                  <Button
                    size="sm"
                    className="min-h-10 sm:min-h-8"
                    variant="brand"
                    disabled={isSaving}
                    onClick={() => (canLaunch ? setConfirmLaunchOpen(true) : showLaunchReadiness())}
                  >
                    {isSaving ? <Loader2 className="animate-spin" /> : canLaunch ? <Play /> : <CheckCircle2 />}
                    {canLaunch ? "Launch" : "Continue review"}
                  </Button>
                ) : null}
                {["active", "paused"].includes(detail.status) ? (
                  <Button size="sm" className="min-h-10 sm:min-h-8" variant="outline" disabled={isSaving} onClick={() => void patch({ status: "completed" }, "Campaign completed")}>
                    <CheckCircle2 /> Complete
                  </Button>
                ) : null}
                <Button size="sm" className="min-h-10 sm:min-h-8" variant="outline" asChild>
                  <Link href={`/dashboard/prospects?campaignId=${detail.id}`}>
                    <Users /> Audience
                  </Link>
                </Button>
              </div>

              {["draft", "review"].includes(detail.status) ? (
                <section ref={launchReadinessRef} className="rounded-lg border border-border">
                  <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                    <div>
                      <h3 className="text-sm font-semibold">Launch readiness</h3>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {launchChecklist.filter((item) => item.complete).length} of {launchChecklist.length} checks complete
                      </p>
                    </div>
                    {canLaunch ? <Badge className="bg-onboarding-success-700 text-white hover:bg-onboarding-success-700">Ready</Badge> : null}
                  </div>
                  <ul className="divide-y divide-border">
                    {launchChecklist.map((item) => (
                      <li key={item.key} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:flex-nowrap">
                        <CheckCircle2
                          className={cn(
                            "size-4 shrink-0",
                            item.complete ? "text-onboarding-success-500" : "text-muted-foreground",
                          )}
                          aria-hidden
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">{item.label}</p>
                          <p className="text-xs text-muted-foreground">{item.description}</p>
                        </div>
                        {item.complete ? (
                          <span className="text-xs font-medium text-onboarding-success-600">Ready</span>
                        ) : item.href ? (
                          <Button size="sm" variant="outline" asChild>
                            <Link href={item.href}>{item.action}</Link>
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" disabled={isSaving} onClick={reviewConnectionNote}>
                            <Pencil /> {item.action}
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {channelPreflight ? (
                <section className="rounded-lg border border-border text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div className="px-4 py-3">
                      <h3 className="font-semibold">Channel readiness</h3>
                      <p className="mt-0.5 text-xs text-muted-foreground">Delivery checks for this campaign.</p>
                    </div>
                    <Button size="sm" className="mr-2" variant="ghost" disabled={isCheckingChannels} onClick={() => campaignId && void checkChannels(campaignId)}>
                      <RefreshCw className={cn(isCheckingChannels && "animate-spin")} /> Refresh
                    </Button>
                  </div>
                  <div className="divide-y divide-border border-t border-border">
                    {channelPreflight.instagram ? (
                      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                        <span><strong>Instagram</strong> · {channelPreflight.instagram.reachable} ready</span>
                        <span className="text-xs text-muted-foreground">{channelPreflight.instagram.capacity.dailyRemaining}/{channelPreflight.instagram.capacity.dailyLimit} daily actions left</span>
                      </div>
                    ) : null}
                    {channelPreflight.whatsapp ? (
                      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                        <span><strong>WhatsApp</strong> · {channelPreflight.whatsapp.reachable} ready</span>
                        <span className="text-xs text-muted-foreground">{channelPreflight.whatsapp.missingConsent} need consent</span>
                      </div>
                    ) : null}
                  </div>
                </section>
              ) : null}

              <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  ["Prospects", detail.prospectCount],
                  ["Pending review", detail.reviewSummary.pending],
                  ["Approved", detail.reviewSummary.approved],
                  ["Sent", detail.metrics.sent],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg border border-border p-3">
                    <p className="text-xl font-semibold">{value}</p>
                    <p className="text-xs text-muted-foreground">{label}</p>
                  </div>
                ))}
              </section>
              <section className="rounded-lg border border-border bg-muted/20 p-3 text-sm">
                <h3 className="font-semibold">Channel performance</h3>
                <div className="mt-3 grid grid-cols-4 gap-2 text-xs text-muted-foreground">
                  <span>Channel</span><span className="text-right">Sent</span><span className="text-right">Reply rate</span><span className="text-right">Replies</span>
                </div>
                {detail.channels.map((channel) => (
                  <div key={channel} className="mt-2 grid grid-cols-4 gap-2 border-t border-border pt-2 text-sm">
                    <span className="flex items-center gap-1.5"><DashboardChannelLogo platform={channel} className="size-4" />{channelDisplayName(channel)}</span>
                    <span className="text-right">{detail.metrics.sent}</span>
                    <span className="text-right">{detail.metrics.replyRate ?? 0}%</span>
                    <span className="text-right">{detail.metrics.replies}</span>
                  </div>
                ))}
              </section>
            </div></TabsContent>

            <TabsContent value="sequence" className="min-h-0 overflow-y-auto px-5 py-5 sm:px-6"><section ref={sequenceSectionRef} className="space-y-3">
                {editing || sequenceLocked ? (
                  <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">Messaging</h3>
                  {sequenceLocked ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isSaving}
                      onClick={() => void patch({ status: "paused" }, "Campaign paused - you can edit the messaging now")}
                    >
                      <Pause /> Pause to edit
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={!sequenceEditable}
                      onClick={() => setEditing((value) => !value)}
                    >
                      {editing ? "Cancel edit" : "Edit"}
                    </Button>
                  )}
                  </div>
                ) : null}
                {sequenceLocked ? (
                  <p className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                    Messaging is locked while the campaign is running. Pause to change steps, delays, or copy.
                  </p>
                ) : null}
                {editing && sequenceEditable ? (
                  <div className="space-y-3">
                    {detail.naming ? (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="grid gap-1.5 text-sm font-medium">
                          Audience
                          <Input value={namingAudience} onChange={(event) => setNamingAudience(event.target.value)} />
                        </label>
                        <label className="grid gap-1.5 text-sm font-medium">
                          Goal
                          <Input value={namingGoal} onChange={(event) => setNamingGoal(event.target.value)} />
                        </label>
                      </div>
                    ) : (
                      <label className="grid gap-1.5 text-sm font-medium">
                        Name
                        <Input value={name} onChange={(event) => setName(event.target.value)} />
                      </label>
                    )}
                    <label className="grid gap-1.5 text-sm font-medium">
                      LinkedIn sender
                      <select
                        className="h-9 rounded-lg border border-input bg-transparent px-3 text-sm"
                        value={senderAccountId}
                        onChange={(event) => setSenderAccountId(event.target.value)}
                      >
                        <option value="">Select sender</option>
                        {activeSenders.map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.accountName}
                          </option>
                        ))}
                      </select>
                    </label>
                    <SequenceBuilder
                      value={sequence}
                      onChange={setSequence}
                      availableChannels={availableSequenceChannels}
                    />
                    <Button size="sm" variant="brand" disabled={isSaving} onClick={() => void saveEdits()}>
                      {isSaving ? <Loader2 className="animate-spin" /> : null} Save changes
                    </Button>
                  </div>
                ) : (() => {
                  const messageSteps = asSequence(detail.sequence);
                  const finalDay = messageSteps.length ? sequenceDay(messageSteps, messageSteps.length - 1) : 1;

                  return (
                    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_20rem]">
                      <section className="min-w-0">
                        <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-border/70 pb-4">
                          <div>
                            <p className="text-xl font-semibold tracking-[-0.02em]">Message flow</p>
                            <p className="mt-1 text-[0.8125rem] leading-5 text-muted-foreground">
                              The messages each prospect receives, in order.
                            </p>
                          </div>
                          <Badge variant="secondary" className="h-6 rounded-full px-2.5 text-xs font-medium">
                            {messageSteps.length} {messageSteps.length === 1 ? "message" : "messages"} · {finalDay} {finalDay === 1 ? "day" : "days"}
                          </Badge>
                        </div>

                        {messageSteps.length ? (
                          <ol className="relative space-y-4 before:absolute before:top-8 before:bottom-8 before:left-3 before:w-px before:bg-onboarding-purple-200 dark:before:bg-onboarding-purple-800">
                            {messageSteps.map((step, index) => {
                              const channel = sequenceStepChannel(step.type);
                              const isVideo = step.type.toLowerCase().includes("video");
                              const day = sequenceDay(messageSteps, index);

                              return (
                                <Fragment key={`${step.type}-${index}`}>
                                  {index > 0 && step.delayHours > 0 ? (
                                    <li className="relative z-10 flex gap-4 py-0.5 pl-1">
                                      <Clock weight="fill" className="mt-4 size-4 shrink-0 text-onboarding-purple-700 dark:text-onboarding-purple-200" aria-hidden />
                                      <div className="flex min-h-14 flex-1 items-center rounded-xl border border-border bg-muted/15 px-5 py-3">
                                        <div>
                                          <p className="text-sm font-semibold">{formatWaitTime(step.delayHours)}</p>
                                          <p className="text-xs text-muted-foreground">No action required</p>
                                        </div>
                                      </div>
                                    </li>
                                  ) : null}
                                  <li className="relative z-10 flex gap-4 pl-1">
                                    {isVideo ? (
                                      <Video weight="fill" className={cn("mt-4 size-4 shrink-0", index === 0 ? "text-onboarding-purple-700 dark:text-onboarding-purple-200" : "text-muted-foreground")} aria-hidden />
                                    ) : channel ? (
                                      <DashboardChannelLogo platform={channel} className="mt-4 size-4 shrink-0" />
                                    ) : (
                                      <MessageSquare weight="fill" className={cn("mt-4 size-4 shrink-0", index === 0 ? "text-onboarding-purple-700 dark:text-onboarding-purple-200" : "text-muted-foreground")} aria-hidden />
                                    )}
                                    <article className={cn(
                                      "min-w-0 flex-1 rounded-xl border bg-background px-5 py-4 transition-shadow duration-200",
                                      index === 0
                                        ? "border-onboarding-purple-300 shadow-[0_2px_10px_rgb(83_38_183/0.08)] dark:border-onboarding-purple-700"
                                        : "border-border shadow-sm",
                                    )}>
                                      <div className="flex items-start justify-between gap-4">
                                        <div className="min-w-0">
                                          <p className="text-[0.9375rem] font-semibold text-foreground">
                                            Day {day} · {sequenceStepLabel(step.type, index)}
                                          </p>
                                          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground whitespace-pre-wrap">
                                            {step.message || "No message copy has been added yet."}
                                          </p>
                                        </div>
                                        {channel ? (
                                          <Badge variant="outline" className="shrink-0 rounded-full text-[11px] font-medium text-muted-foreground">
                                            {channelDisplayName(channel)}
                                          </Badge>
                                        ) : null}
                                      </div>
                                    </article>
                                  </li>
                                </Fragment>
                              );
                            })}
                          </ol>
                        ) : (
                          <div className="rounded-xl border border-dashed border-onboarding-purple-200 bg-onboarding-purple-50/40 px-5 py-8 text-center dark:border-onboarding-purple-800 dark:bg-onboarding-purple-950/30">
                            <MessageSquare weight="fill" className="mx-auto size-6 text-onboarding-purple-600 dark:text-onboarding-purple-300" aria-hidden />
                            <p className="mt-3 text-sm font-semibold">No messages yet</p>
                            <p className="mt-1 text-sm text-muted-foreground">Add your first message to create the campaign path.</p>
                          </div>
                        )}

                        {sequenceEditable ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="mt-5 h-11 w-full rounded-xl border-dashed border-onboarding-purple-300 text-onboarding-purple-700 hover:border-onboarding-purple-400 hover:bg-onboarding-purple-50 hover:text-onboarding-purple-800 dark:border-onboarding-purple-700 dark:text-onboarding-purple-200 dark:hover:bg-onboarding-purple-950"
                            onClick={() => setEditing(true)}
                          >
                            <Pencil className="size-4" /> Edit messages
                          </Button>
                        ) : null}
                      </section>

                      <aside className="h-fit overflow-hidden rounded-2xl border border-border bg-muted/15 shadow-[0_6px_20px_rgb(15_23_42/0.04)]">
                        <div className="border-b border-border bg-background/80 px-5 py-4">
                          <p className="text-base font-semibold tracking-tight">Campaign delivery</p>
                          <p className="mt-1 text-xs text-muted-foreground">Live context for this message flow.</p>
                        </div>
                        <div className="divide-y divide-border">
                          <div className="flex gap-3 px-5 py-4">
                            <Send weight="fill" className="mt-0.5 size-4 shrink-0 text-onboarding-purple-700 dark:text-onboarding-purple-200" aria-hidden />
                            <div className="min-w-0">
                              <p className="text-sm font-semibold">Sending through</p>
                              <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                                {detail.channels.slice(0, 2).map((channel) => <DashboardChannelLogo key={channel} platform={channel} className="size-4" />)}
                                {campaignChannelLabel(detail.channels)}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-3 px-5 py-4">
                            <UserCheck weight="fill" className="mt-0.5 size-4 shrink-0 text-onboarding-purple-700 dark:text-onboarding-purple-200" aria-hidden />
                            <div className="min-w-0">
                              <p className="text-sm font-semibold">Sender</p>
                              <p className="mt-0.5 truncate text-sm text-muted-foreground">{detail.senderAccount?.accountName ?? "Select a sender before launch"}</p>
                            </div>
                          </div>
                          <div className="flex gap-3 px-5 py-4">
                            <Clock weight="fill" className="mt-0.5 size-4 shrink-0 text-onboarding-purple-700 dark:text-onboarding-purple-200" aria-hidden />
                            <div className="min-w-0">
                              <p className="text-sm font-semibold">Campaign progress</p>
                              <p className="mt-0.5 text-sm text-muted-foreground">{detail.metrics.sent} sent · {detail.metrics.replies} replies</p>
                            </div>
                          </div>
                        </div>
                        <div className="m-4 flex gap-2.5 rounded-xl border border-onboarding-purple-200 bg-onboarding-purple-50/70 p-3 text-xs leading-5 text-onboarding-purple-800 dark:border-onboarding-purple-800 dark:bg-onboarding-purple-950/50 dark:text-onboarding-purple-200">
                          <Info weight="fill" className="mt-0.5 size-4 shrink-0" aria-hidden />
                          <p>Review and approve the audience, sender, and messaging before anything is sent.</p>
                        </div>
                      </aside>
                    </div>
                  );
                })()}
              </section></TabsContent>

            <TabsContent value="audience" className="min-h-0 overflow-y-auto px-5 py-5 sm:px-6"><section className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold">Audience routing</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Checked against {detail.senderAccount?.accountName ?? "the selected sender"}.
                    </p>
                  </div>
                  {detail.channels.includes("linkedin") && ["draft", "review", "paused"].includes(detail.status) ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isRefreshingRelationships || !detail.senderAccount || detail.prospectCount === 0}
                      onClick={() => void refreshRelationships()}
                    >
                      <RefreshCw className={cn(isRefreshingRelationships && "animate-spin")} />
                      {relationshipCursor
                        ? "Continue check"
                        : detail.audienceRouting.checked > 0
                          ? "Refresh"
                          : "Check relationships"}
                    </Button>
                  ) : null}
                </div>
                {detail.channels.includes("linkedin") && detail.prospectCount > 0 ? (
                  <div className="grid overflow-hidden rounded-lg border border-border sm:grid-cols-4">
                    {[
                      { key: "connected", label: "Direct message", value: detail.audienceRouting.directMessage, icon: UserCheck },
                      { key: "invite_required", label: "Invite first", value: detail.audienceRouting.inviteRequired, icon: UserPlus },
                      { key: "unresolved", label: "Unresolved", value: detail.audienceRouting.unresolved, icon: CircleHelp },
                      { key: "unknown", label: "Not checked", value: detail.audienceRouting.unknown, icon: RefreshCw },
                    ].map((item) => (
                      <Link
                        key={item.key}
                        href={`/dashboard/prospects?campaignId=${detail.id}&relationship=${item.key}`}
                        className="flex min-h-20 items-center gap-3 border-b border-border px-3 py-3 transition-colors hover:bg-muted/50 last:border-b-0 sm:border-r sm:border-b-0 sm:last:border-r-0"
                      >
                        <item.icon className="size-4 shrink-0 text-onboarding-purple-600 dark:text-onboarding-purple-300" aria-hidden />
                        <span>
                          <span className="block text-lg font-semibold leading-none">{item.value}</span>
                          <span className="mt-1 block text-xs text-muted-foreground">{item.label}</span>
                        </span>
                      </Link>
                    ))}
                  </div>
                ) : null}
                {detail.prospectCount > 0 ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-3 py-3 text-sm">
                    <span>
                      <span className="font-medium">Audience review:</span>{" "}
                      {detail.reviewSummary.approved} approved · {detail.reviewSummary.pending} pending · {detail.reviewSummary.excluded} excluded
                    </span>
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/dashboard/prospects?campaignId=${detail.id}`}>Review prospects</Link>
                    </Button>
                  </div>
                ) : null}
                {detail.leads.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No prospects enrolled yet.</p>
                ) : (
                  <ul className="divide-y divide-border rounded-lg border border-border">
                    {detail.leads.map((lead) => (
                      <li key={lead.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{lead.name}</p>
                          <p className="truncate text-xs text-muted-foreground">{lead.company}</p>
                        </div>
                        <Badge variant="secondary">
                          {lead.linkedinRelationship === "connected"
                            ? "Direct message"
                            : lead.linkedinRelationship === "invite_required"
                              ? "Invite first"
                              : lead.linkedinRelationship === "unresolved"
                                ? "Unresolved"
                                : titleCase(lead.leadStatus)}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="text-xs text-muted-foreground">{detail.prospectCount} enrolled total</p>
              </section></TabsContent>

            <TabsContent value="delivery" className="min-h-0 overflow-y-auto px-5 py-5 sm:px-6"><div className="space-y-6"><section className="space-y-3">
                <h3 className="text-sm font-semibold">Delivery</h3>
                <div className="rounded-lg border border-border p-3 text-sm">
                  {detail.senderAccount ? (
                    <p>
                      Sender: <span className="font-medium">{detail.senderAccount.accountName}</span>{" "}
                      <Badge
                        variant="outline"
                        className={cn(
                          detail.senderAccount.status === "active"
                            ? "border-transparent bg-onboarding-success-50 text-onboarding-success-700 dark:bg-onboarding-success-500/20 dark:text-onboarding-success-300"
                            : "",
                        )}
                      >
                        {detail.senderAccount.status}
                      </Badge>
                    </p>
                  ) : (
                    <p className="text-muted-foreground">No LinkedIn sender selected.</p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2">
                    {detail.channels.map((channel) => (
                      <span key={channel} className="inline-flex items-center gap-1.5 text-xs font-medium">
                        <DashboardChannelLogo platform={channel} className="size-5" />
                        {channelDisplayName(channel)}
                      </span>
                    ))}
                  </div>
                  {detail.senderAccount && detail.senderAccount.status !== "active" ? (
                    <Button size="sm" variant="ghost" className="mt-2 h-auto px-0" asChild>
                      <Link href="/dashboard/channels">Fix sender in Channels</Link>
                    </Button>
                  ) : null}
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-semibold">Video</h3>
                <CampaignVideo
                  campaignId={detail.id}
                  video={detail.video}
                  onVideoChange={(next) => setDetail((current) => (current ? { ...current, video: next } : current))}
                />
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-semibold">More</h3>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/dashboard/messages?campaignId=${detail.id}`}><MessageSquare /> Messages</Link>
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/dashboard/analytics?campaignId=${detail.id}`}>Analytics</Link>
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/dashboard/activity?kind=campaign&campaignId=${detail.id}`}>Open activity</Link>
                  </Button>
                  {!detail.archived ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isSaving}
                      onClick={() => void patch({ archived: true }, "Campaign archived")}
                    >
                      Archive
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isSaving}
                      onClick={() => void patch({ archived: false }, "Campaign restored")}
                    >
                      Restore
                    </Button>
                  )}
                </div>
              </section></div></TabsContent>
            </Tabs>

            <DialogFooter className="shrink-0 border-t border-border px-5 py-4 pb-[max(1rem,var(--safe-area-bottom))] sm:px-6 sm:pb-4">
              <Button variant="outline" className="min-h-10 w-full sm:min-h-8 sm:w-auto" onClick={onClose}>Close</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
      <Dialog open={confirmLaunchOpen} onOpenChange={setConfirmLaunchOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Launch this campaign?</DialogTitle>
            <DialogDescription>
              This will begin outreach to {detail?.prospectCount ?? 0} enrolled prospect{detail?.prospectCount === 1 ? "" : "s"} using the selected sender. Messages cannot be recalled after they are sent.
            </DialogDescription>
          </DialogHeader>
          {detail?.channels.includes("linkedin") ? (
            <div className="rounded-lg border border-border bg-muted/30 px-3 py-3 text-sm">
              <p className="font-medium">LinkedIn delivery preview</p>
              <p className="mt-1 text-muted-foreground">
                {detail.audienceRouting.directMessage} direct message · {detail.audienceRouting.inviteRequired} invite first
                {detail.audienceRouting.unresolved > 0 ? ` · ${detail.audienceRouting.unresolved} unresolved` : ""}
                {detail.audienceRouting.unknown > 0 ? ` · ${detail.audienceRouting.unknown} checked at send time` : ""}
              </p>
              {detail.audienceRouting.unknown > 0 || detail.audienceRouting.unresolved > 0 ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className="mt-2 h-auto px-0"
                  disabled={isRefreshingRelationships}
                  onClick={() => void refreshRelationships()}
                >
                  <RefreshCw className={cn(isRefreshingRelationships && "animate-spin")} /> Check relationships now
                </Button>
              ) : null}
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmLaunchOpen(false)}>Cancel</Button>
            <Button
              variant="brand"
              disabled={isSaving || !canLaunch}
              onClick={() => {
                setConfirmLaunchOpen(false);
                void launch();
              }}
            >
              <Play /> Launch campaign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
