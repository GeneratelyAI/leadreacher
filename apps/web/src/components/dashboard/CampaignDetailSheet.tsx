"use client";

import Link from "next/link";
import {
  CheckCircle2,
  CircleHelp,
  Loader2,
  MessageSquare,
  Pause,
  Play,
  RefreshCw,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { CampaignVideoView, type CampaignVideoSummary } from "@/components/dashboard/CampaignVideoView";
import { SequenceBuilder } from "@/components/dashboard/SequenceBuilder";
import { channelDisplayName, DashboardChannelLogo } from "@/components/dashboard/ChannelIdentity";
import { Button } from "@/components/ui/Button";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ApiError, apiFetch } from "@/lib/api";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

type SequenceStep = { type: string; message: string; delayHours: number };

export type CampaignDetail = {
  id: string;
  name: string;
  status: string;
  channels: string[];
  sequence: SequenceStep[] | unknown;
  archived: boolean;
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

type CampaignDetailSheetProps = {
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

export function CampaignDetailSheet({
  campaignId,
  accounts,
  onClose,
  onChanged,
}: CampaignDetailSheetProps) {
  const isMobile = useIsMobile();
  const [detail, setDetail] = useState<CampaignDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [sequence, setSequence] = useState<SequenceStep[]>([]);
  const [senderAccountId, setSenderAccountId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmLaunchOpen, setConfirmLaunchOpen] = useState(false);
  const [isRefreshingRelationships, setIsRefreshingRelationships] = useState(false);
  const [relationshipCursor, setRelationshipCursor] = useState<string | null>(null);
  const [channelPreflight, setChannelPreflight] = useState<ChannelPreflight | null>(null);
  const [isCheckingChannels, setIsCheckingChannels] = useState(false);

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

  const load = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const next = await apiFetch<CampaignDetail>(`/campaigns/${id}`);
      setDetail(next);
      setName(next.name);
      setSequence(asSequence(next.sequence));
      setSenderAccountId(next.socialAccountId ?? "");
      setRelationshipCursor(null);
      setEditing(false);
      if (["draft", "review"].includes(next.status) && next.channels.some((channel) => channel === "instagram" || channel === "whatsapp")) {
        void checkChannels(id);
      } else {
        setChannelPreflight(null);
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load campaign.");
    } finally {
      setIsLoading(false);
    }
  }, [checkChannels]);

  useEffect(() => {
    if (!campaignId) {
      setDetail(null);
      return;
    }
    void load(campaignId);
  }, [campaignId, load]);

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
        name,
        sequence,
        ...(senderAccountId ? { socialAccountId: senderAccountId } : {}),
      },
      "Campaign updated",
    );
    setEditing(false);
  }

  const open = Boolean(campaignId);
  const activeSenders = accounts.filter((account) => account.platform === "linkedin" && account.status === "active");
  const canLaunch =
    detail &&
    ["draft", "review"].includes(detail.status) &&
    detail.launchReady.hasLeads &&
    detail.launchReady.hasSequenceReview &&
    detail.launchReady.hasSender;
  const sequenceEditable = detail ? ["draft", "review", "paused"].includes(detail.status) : false;
  const sequenceLocked = detail?.status === "active";

  return (
    <Sheet open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        showCloseButton
        className={cn(
          "flex flex-col gap-0 overflow-hidden p-0",
          isMobile
            ? "h-[min(96dvh,100%)] max-h-[96dvh] w-full rounded-t-2xl sm:max-w-none"
            : "h-full w-full max-w-3xl sm:max-w-3xl",
        )}
      >
        {isLoading || !detail ? (
          <div className="flex min-h-64 items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 size-4 animate-spin" /> Loading campaign
          </div>
        ) : (
          <>
            <SheetHeader className="shrink-0 border-b border-border px-5 py-5 pr-14 text-left sm:px-6">
              <div className="flex flex-wrap items-center gap-2">
                <SheetTitle className="text-xl">{detail.name}</SheetTitle>
                <Badge variant="outline">{detail.status === "active" ? "Running" : titleCase(detail.status)}</Badge>
                {detail.archived ? <Badge variant="secondary">Archived</Badge> : null}
              </div>
              <SheetDescription>
                {detail.channels.map((channel) => titleCase(channel)).join(" · ")} · Updated{" "}
                {new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(detail.updatedAt))}
              </SheetDescription>
            </SheetHeader>

            {error ? (
              <p className="mx-5 mt-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive sm:mx-6">{error}</p>
            ) : null}

            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5 sm:px-6">
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
                  <Button size="sm" className="min-h-10 sm:min-h-8" variant="brand" disabled={isSaving || !canLaunch} onClick={() => setConfirmLaunchOpen(true)}>
                    {isSaving ? <Loader2 className="animate-spin" /> : <Play />} Launch
                  </Button>
                ) : null}
                {["active", "paused"].includes(detail.status) ? (
                  <Button size="sm" className="min-h-10 sm:min-h-8" variant="outline" disabled={isSaving} onClick={() => void patch({ status: "completed" }, "Campaign completed")}>
                    <CheckCircle2 /> Complete
                  </Button>
                ) : null}
                <Button size="sm" className="min-h-10 sm:min-h-8" variant="outline" asChild>
                  <Link href={`/dashboard/prospects?enrollCampaignId=${detail.id}`}>
                    <Users /> {detail.prospectCount === 0 ? "Add prospects" : "Add more"}
                  </Link>
                </Button>
                <Button size="sm" className="min-h-10 sm:min-h-8" variant="outline" asChild>
                  <Link href={`/dashboard/messages?campaignId=${detail.id}`}>
                    <MessageSquare /> Messages
                  </Link>
                </Button>
                <Button size="sm" className="min-h-10 sm:min-h-8" variant="outline" asChild>
                  <Link href={`/dashboard/analytics?campaignId=${detail.id}`}>Analytics</Link>
                </Button>
              </div>

              {["draft", "review"].includes(detail.status) && detail.launchReady.reasons.length > 0 ? (
                <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                  {detail.launchReady.reasons.map((reason) => (
                    <p key={reason}>{reason}</p>
                  ))}
                </div>
              ) : null}

              {channelPreflight ? (
                <section className="space-y-2 rounded-lg border border-border p-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-semibold">Channel readiness</h3>
                    <Button size="sm" variant="ghost" disabled={isCheckingChannels} onClick={() => campaignId && void checkChannels(campaignId)}>
                      <RefreshCw className={cn(isCheckingChannels && "animate-spin")} /> Refresh
                    </Button>
                  </div>
                  {channelPreflight.instagram ? (
                    <p className="text-muted-foreground">
                      Instagram: <strong className="text-foreground">{channelPreflight.instagram.reachable} ready</strong>, {channelPreflight.instagram.unresolved} unresolved, {channelPreflight.instagram.invalid} invalid, {channelPreflight.instagram.errors} errors, {channelPreflight.instagram.suppressed} suppressed. {titleCase(channelPreflight.instagram.capacity.stage)} account: {channelPreflight.instagram.capacity.dailyRemaining}/{channelPreflight.instagram.capacity.dailyLimit} daily and {channelPreflight.instagram.capacity.hourlyRemaining}/{channelPreflight.instagram.capacity.hourlyLimit} hourly actions remaining.
                    </p>
                  ) : null}
                  {channelPreflight.whatsapp ? (
                    <p className="text-muted-foreground">
                      WhatsApp: <strong className="text-foreground">{channelPreflight.whatsapp.reachable} ready</strong>, {channelPreflight.whatsapp.invalidPhone} invalid numbers, {channelPreflight.whatsapp.missingConsent} missing consent, {channelPreflight.whatsapp.suppressed} suppressed.
                    </p>
                  ) : null}
                </section>
              ) : null}

              <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  ["Prospects", detail.prospectCount],
                  ["Sent", detail.metrics.sent],
                  ["Replies", detail.metrics.replies],
                  ["Meetings", detail.metrics.meetings],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg border border-border p-3">
                    <p className="text-xl font-semibold">{value}</p>
                    <p className="text-xs text-muted-foreground">{label}</p>
                  </div>
                ))}
              </section>

              <section className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">Sequence</h3>
                  {sequenceLocked ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isSaving}
                      onClick={() => void patch({ status: "paused" }, "Campaign paused - you can edit the sequence now")}
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
                {sequenceLocked ? (
                  <p className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                    Sequence is locked while the campaign is running. Pause to change steps, delays, or copy.
                  </p>
                ) : null}
                {editing && sequenceEditable ? (
                  <div className="space-y-3">
                    <label className="grid gap-1.5 text-sm font-medium">
                      Name
                      <Input value={name} onChange={(event) => setName(event.target.value)} />
                    </label>
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
                    <SequenceBuilder value={sequence} onChange={setSequence} />
                    <Button size="sm" variant="brand" disabled={isSaving} onClick={() => void saveEdits()}>
                      {isSaving ? <Loader2 className="animate-spin" /> : null} Save changes
                    </Button>
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {asSequence(detail.sequence).map((step, index) => (
                      <li key={`${step.type}-${index}`} className="rounded-lg border border-border p-3">
                        <p className="text-xs font-semibold text-muted-foreground">
                          Step {index + 1} · {step.type} · {step.delayHours}h delay
                        </p>
                        <p className="mt-1 text-sm whitespace-pre-wrap">{step.message}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="space-y-3">
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
              </section>

              <section className="space-y-3">
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
                <CampaignVideoView
                  campaignId={detail.id}
                  video={detail.video}
                  onVideoChange={(next) => setDetail((current) => (current ? { ...current, video: next } : current))}
                />
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-semibold">More</h3>
                <div className="flex flex-wrap gap-2">
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
              </section>
            </div>

            <SheetFooter className="shrink-0 border-t border-border px-5 py-4 pb-[max(1rem,var(--safe-area-bottom))] sm:px-6 sm:pb-4">
              <Button variant="outline" className="min-h-10 w-full sm:min-h-8 sm:w-auto" onClick={onClose}>Close</Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
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
    </Sheet>
  );
}
