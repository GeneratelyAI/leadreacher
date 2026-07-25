"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  Bell,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Clock3,
  ExternalLink,
  Link2,
  Loader2,
  Mail,
  Megaphone,
  MessageSquare,
  Moon,
  Plus,
  Search,
  Settings,
  Sparkles,
  Sun,
  Users,
} from "lucide-react";
import { type FormEvent, type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { ChannelLogo } from "@/components/onboarding/ChannelLogo";
import { OnboardingLogo } from "@/components/onboarding/OnboardingLogo";
import { ActivityWorkspace } from "@/components/dashboard/ActivityWorkspace";
import { AnalyticsWorkspace } from "@/components/dashboard/AnalyticsWorkspace";
import { CampaignsPage } from "@/components/dashboard/CampaignsPage";
import { ChannelsWorkspace } from "@/components/dashboard/ChannelsWorkspace";
import { MessagesWorkspace } from "@/components/dashboard/MessagesWorkspace";
import { ProspectsWorkspace } from "@/components/dashboard/ProspectsWorkspace";
import { SettingsWorkspace } from "@/components/dashboard/SettingsWorkspace";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useThemeMode } from "@/hooks/useThemeMode";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

type Campaign = {
  id: string;
  name: string;
  status: string;
  channels: string[];
  createdAt: string;
  updatedAt: string;
};

type Lead = {
  id: string;
  firstName: string;
  lastName: string;
  company: string;
  title: string;
  status: string;
  linkedinUrl: string | null;
  createdAt: string;
};

type Prospect = Lead & {
  location: string | null;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  source: string;
  reviewStatus: "pending" | "approved" | "excluded";
  reviewedAt: string | null;
  lastActivityAt: string;
  campaigns: Array<{ id: string; name: string; status: string; campaignLeadId: string; campaignLeadStatus: string }>;
};

type ProspectDetail = Omit<Prospect, "campaigns"> & {
  industry: string | null;
  companySize: string | null;
  tags: string[];
  notes: string | null;
  messages: Array<{ id: string; direction: string; origin: string; status: string; content: { message: string }; occurredAt: string }>;
  videoAssets: Array<{ id: string; status: string; videoUrl: string | null; thumbnailUrl: string | null; updatedAt: string }>;
  campaigns: Array<{ id: string; status: string; currentStep: number; linkedinChatId: string | null; createdAt: string; campaign: { id: string; name: string; status: string } }>;
};

type SocialAccount = {
  id: string;
  platform: string;
  accountName: string;
  avatarUrl: string | null;
  status: string;
};

const LEAD_STATUSES = [
  "new",
  "contacted",
  "connected",
  "replied",
  "meeting",
  "converted",
  "lost",
  "skipped",
];

function titleCase(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function relativeTime(value: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function channelName(value: string): string {
  return titleCase(value);
}

function initials(name: string): string {
  return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "?";
}

function ProspectAvatar({ name, url, className }: { name: string; url: string | null; className?: string }) {
  if (url) return <img src={url} alt="" className={cn("size-9 rounded-full object-cover", className)} />;
  return <span aria-hidden className={cn("inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-onboarding-purple-100 text-xs font-semibold text-onboarding-purple-700 dark:bg-onboarding-purple-900 dark:text-onboarding-purple-100", className)}>{initials(name)}</span>;
}

function ChannelMark({
  platform,
  size = "default",
  className,
}: {
  platform: string;
  size?: "default" | "badge";
  className?: string;
}) {
  if (platform === "linkedin") {
    return (
      <span
        className={cn(
          "inline-flex shrink-0 items-center justify-center",
          size === "badge" ? "size-4" : "size-9",
          className,
        )}
      >
        <ChannelLogo name="linkedin" className="size-full" />
      </span>
    );
  }

  if (platform === "whatsapp") {
    return (
      <span
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-[0.35rem] bg-[#25D366] text-white",
          size === "badge" ? "size-4" : "size-9",
          className,
        )}
      >
        <ChannelLogo name="whatsapp" className={size === "badge" ? "size-2.5" : "size-5"} />
      </span>
    );
  }

  return <span className={cn("inline-flex shrink-0 items-center justify-center text-onboarding-purple-600 dark:text-onboarding-purple-100", size === "badge" ? "size-4" : "size-9", className)}><Link2 className={size === "badge" ? "size-2.5" : "size-4"} /></span>;
}

function PageCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={cn("rounded-onboarding border border-onboarding-neutral-150 bg-onboarding-neutral-0 shadow-onboarding-small dark:border-onboarding-neutral-750 dark:bg-onboarding-neutral-900", className)}>{children}</section>;
}

function EmptyState({
  title,
  detail,
}: {
  title: string;
  detail: string;
}) {
  return (
    <div className="px-6 py-12 text-center">
      <p className="text-sm font-semibold">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-onboarding-neutral-600 dark:text-onboarding-neutral-400">{detail}</p>
    </div>
  );
}

function LegacyCampaignsView() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [name, setName] = useState("");
  const [invite, setInvite] = useState("");
  const [firstMessage, setFirstMessage] = useState("");
  const [senderAccountId, setSenderAccountId] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [campaignResponse, accountResponse] = await Promise.all([
        apiFetch<{ campaigns: Campaign[] }>("/campaigns"),
        apiFetch<{ accounts: SocialAccount[] }>("/social-accounts"),
      ]);
      setCampaigns(campaignResponse.campaigns);
      setAccounts(accountResponse.accounts);
      setSenderAccountId((current) => current || accountResponse.accounts.find((account) => account.platform === "linkedin" && account.status === "active")?.id || "");
      setError(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load campaigns.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const activeLinkedIn = accounts.some((account) => account.platform === "linkedin" && account.status === "active");

  async function createCampaign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeLinkedIn) {
      setError("Connect an active LinkedIn account before creating a LinkedIn campaign.");
      return;
    }
    setIsCreating(true);
    try {
      await apiFetch("/campaigns", {
        method: "POST",
        body: JSON.stringify({
          name,
          channels: ["linkedin"],
          socialAccountId: senderAccountId,
          sequence: [
            { type: "linkedin_invite", message: invite, delayHours: 0 },
            { type: "linkedin_message", message: firstMessage, delayHours: 0 },
          ],
        }),
      });
      setName("");
      setInvite("");
      setFirstMessage("");
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to create campaign.");
    } finally {
      setIsCreating(false);
    }
  }

  async function launchCampaign(campaignId: string) {
    try {
      await apiFetch(`/campaigns/${campaignId}/launch`, { method: "POST", body: JSON.stringify({}) });
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to launch campaign.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><h1 className="text-3xl font-semibold tracking-tight">Campaigns</h1><p className="mt-2 text-sm text-onboarding-neutral-600 dark:text-onboarding-neutral-400">Create campaigns, add approved prospects, and launch only when the sequence is ready.</p></div>
      </div>
      {error ? <ErrorNotice message={error} /> : null}
      <PageCard className="p-5 sm:p-6">
        <div className="flex items-start gap-3"><Plus className="mt-0.5 size-5 text-onboarding-purple-600" /><div><h2 className="font-semibold">Create a LinkedIn campaign</h2><p className="mt-1 text-sm text-onboarding-neutral-600 dark:text-onboarding-neutral-400">Write and review both messages before the campaign can be launched. Nothing sends when you create a draft.</p></div></div>
        <form onSubmit={createCampaign} className="mt-5 grid gap-4 lg:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium">Campaign name<Input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Q3 founder outreach" /></label>
          <label className="grid gap-2 text-sm font-medium">LinkedIn sender<Select value={senderAccountId || null} onValueChange={(value) => setSenderAccountId(value ?? "")} required><SelectTrigger className="h-8 w-full border-input bg-transparent px-3 text-sm dark:bg-input/30"><SelectValue placeholder="Select a connected account" /></SelectTrigger><SelectContent className="border-onboarding-neutral-150 bg-onboarding-neutral-0 text-onboarding-ink dark:border-onboarding-neutral-750 dark:bg-onboarding-neutral-900 dark:text-onboarding-neutral-0">{accounts.filter((account) => account.platform === "linkedin" && account.status === "active").map((account) => <SelectItem key={account.id} value={account.id} className="text-onboarding-ink focus:bg-onboarding-neutral-50 focus:text-onboarding-ink dark:text-onboarding-neutral-0 dark:focus:bg-onboarding-neutral-800 dark:focus:text-onboarding-neutral-0">{account.accountName}</SelectItem>)}</SelectContent></Select></label>
          <label className="grid gap-2 text-sm font-medium">Connection note<Input required value={invite} onChange={(event) => setInvite(event.target.value)} placeholder="A short invitation note" /></label>
          <label className="grid gap-2 text-sm font-medium lg:col-span-2">First message<textarea required value={firstMessage} onChange={(event) => setFirstMessage(event.target.value)} className="min-h-28 w-full rounded-onboarding border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30" placeholder="The message sent after a prospect accepts the connection." /></label>
          <div className="flex flex-wrap items-center justify-between gap-3 lg:col-span-2"><p className="text-xs text-onboarding-neutral-500 dark:text-onboarding-neutral-400">{activeLinkedIn ? "The selected LinkedIn account will be the only sender for this campaign." : "An active LinkedIn account is required to create this campaign."}</p><Button type="submit" variant="brand" disabled={isCreating || !senderAccountId}>{isCreating ? <Loader2 className="animate-spin" /> : <Plus />} Create draft</Button></div>
        </form>
      </PageCard>
      <PageCard className="overflow-hidden">
        <div className="border-b border-onboarding-neutral-150 px-5 py-4 dark:border-onboarding-neutral-750"><h2 className="font-semibold">Your campaigns</h2></div>
        {isLoading ? <LoadingState /> : campaigns.length === 0 ? <EmptyState title="No campaigns yet" detail="Create a draft using reviewed copy, then add prospects before launching." /> : <ul className="divide-y divide-onboarding-neutral-150 dark:divide-onboarding-neutral-750">{campaigns.map((campaign) => <li key={campaign.id} className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold">{campaign.name}</p><p className="mt-1 text-sm text-onboarding-neutral-600 dark:text-onboarding-neutral-400">{campaign.channels.map(channelName).join(", ")} · Updated {relativeTime(campaign.updatedAt)}</p></div><div className="flex items-center gap-3"><span className="text-xs font-semibold text-onboarding-neutral-500 dark:text-onboarding-neutral-400">{titleCase(campaign.status)}</span>{["draft", "review"].includes(campaign.status) ? <Button variant="brand" size="sm" onClick={() => void launchCampaign(campaign.id)}>Launch</Button> : null}</div></li>)}</ul>}
      </PageCard>
    </div>
  );
}

export const CampaignsView = CampaignsPage;

function LegacyProspectsView() {
  const router = useRouter();
  const [leads, setLeads] = useState<Prospect[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detail, setDetail] = useState<ProspectDetail | null>(null);
  const [campaignId, setCampaignId] = useState("");
  const [query, setQuery] = useState("");
  const [reviewStatus, setReviewStatus] = useState<"all" | "pending" | "approved" | "excluded">("pending");
  const [lifecycle, setLifecycle] = useState("");
  const [source, setSource] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    const params = new URLSearchParams({ limit: "100" });
    if (query) params.set("query", query);
    if (reviewStatus !== "all") params.set("reviewStatus", reviewStatus);
    if (lifecycle) params.set("status", lifecycle);
    if (source) params.set("source", source);
    try {
      const [leadResponse, campaignResponse] = await Promise.all([
        apiFetch<{ leads: Prospect[] }>(`/dashboard/prospects?${params.toString()}`),
        apiFetch<{ campaigns: Campaign[] }>("/campaigns"),
      ]);
      setLeads(leadResponse.leads);
      setCampaigns(campaignResponse.campaigns);
      setError(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load prospects.");
    } finally { setIsLoading(false); }
  }, [lifecycle, query, reviewStatus, source]);
  useEffect(() => { void load(); }, [load]);

  async function openDetail(leadId: string) {
    try {
      const result = await apiFetch<{ lead: ProspectDetail }>(`/dashboard/prospects/${leadId}`);
      setDetail(result.lead);
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Unable to load prospect details."); }
  }
  async function updateReview(leadIds: string[], nextReviewStatus: "approved" | "excluded") {
    try {
      if (leadIds.length === 1) await apiFetch(`/dashboard/prospects/${leadIds[0]}/review`, { method: "PATCH", body: JSON.stringify({ reviewStatus: nextReviewStatus }) });
      else await apiFetch("/dashboard/prospects/review", { method: "POST", body: JSON.stringify({ leadIds, reviewStatus: nextReviewStatus }) });
      if (detail && leadIds.includes(detail.id)) setDetail({ ...detail, reviewStatus: nextReviewStatus });
      setSelected(new Set());
      await load();
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Unable to update prospect review."); }
  }
  async function enrollSelected() {
    const approvedIds = [...selected].filter((leadId) => leads.find((lead) => lead.id === leadId)?.reviewStatus === "approved");
    if (!campaignId || approvedIds.length === 0) return;
    try {
      await apiFetch(`/campaigns/${campaignId}/leads`, { method: "POST", body: JSON.stringify({ leadIds: approvedIds }) });
      setSelected(new Set());
      await load();
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Unable to add prospects to campaign."); }
  }
  const approvedSelectedCount = useMemo(() => [...selected].filter((id) => leads.find((lead) => lead.id === id)?.reviewStatus === "approved").length, [leads, selected]);

  const closeDetail = () => router.push("/dashboard/prospects");
  return <div className="space-y-5"><div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between"><div><h1 className="text-3xl font-semibold tracking-tight">Prospects</h1><p className="mt-2 text-sm text-onboarding-neutral-600 dark:text-onboarding-neutral-400">Review real people before enrollment. Approval and exclusion are reversible and do not alter existing campaign delivery.</p></div><Button variant="secondary" asChild><Link href="/onboarding?step=strategy">Review strategy</Link></Button></div>{error ? <ErrorNotice message={error} /> : null}
    <PageCard className="overflow-hidden"><div className="flex flex-col gap-3 border-b border-onboarding-neutral-150 p-4 dark:border-onboarding-neutral-750"><div className="flex flex-col gap-2 lg:flex-row"><label className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border border-onboarding-neutral-150 px-3 dark:border-onboarding-neutral-750"><Search className="size-4 text-onboarding-neutral-500" /><span className="sr-only">Search prospects</span><input value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm outline-none" placeholder="Search name, company, or title" /></label><div className="flex gap-2"><Select value={lifecycle || null} onValueChange={(value) => setLifecycle(value === "__all" ? "" : value ?? "")}><SelectTrigger className="h-9 w-auto min-w-36 border-input bg-transparent px-2 text-sm dark:bg-input/30"><SelectValue placeholder="All lifecycle states" /></SelectTrigger><SelectContent className="border-onboarding-neutral-150 bg-onboarding-neutral-0 text-onboarding-ink dark:border-onboarding-neutral-750 dark:bg-onboarding-neutral-900 dark:text-onboarding-neutral-0"><SelectItem value="__all" className="text-onboarding-ink dark:text-onboarding-neutral-0">All lifecycle states</SelectItem>{LEAD_STATUSES.map((status) => <SelectItem key={status} value={status} className="text-onboarding-ink dark:text-onboarding-neutral-0">{titleCase(status)}</SelectItem>)}</SelectContent></Select><Select value={source || null} onValueChange={(value) => setSource(value === "__all" ? "" : value ?? "")}><SelectTrigger className="h-9 w-auto min-w-28 border-input bg-transparent px-2 text-sm dark:bg-input/30"><SelectValue placeholder="All sources" /></SelectTrigger><SelectContent className="border-onboarding-neutral-150 bg-onboarding-neutral-0 text-onboarding-ink dark:border-onboarding-neutral-750 dark:bg-onboarding-neutral-900 dark:text-onboarding-neutral-0"><SelectItem value="__all" className="text-onboarding-ink dark:text-onboarding-neutral-0">All sources</SelectItem><SelectItem value="apify" className="text-onboarding-ink dark:text-onboarding-neutral-0">LinkedIn search</SelectItem><SelectItem value="csv" className="text-onboarding-ink dark:text-onboarding-neutral-0">CSV import</SelectItem><SelectItem value="manual" className="text-onboarding-ink dark:text-onboarding-neutral-0">Manual</SelectItem></SelectContent></Select></div></div><div className="flex items-center gap-1 overflow-x-auto" role="tablist" aria-label="Review state">{(["all", "pending", "approved", "excluded"] as const).map((state) => <button key={state} type="button" role="tab" aria-selected={reviewStatus === state} onClick={() => setReviewStatus(state)} className={cn("h-8 rounded-lg px-3 text-sm font-medium capitalize transition-colors", reviewStatus === state ? "bg-onboarding-purple-50 text-onboarding-purple-700 dark:bg-onboarding-purple-900 dark:text-onboarding-purple-100" : "text-onboarding-neutral-600 hover:bg-onboarding-neutral-100 dark:text-onboarding-neutral-400 dark:hover:bg-onboarding-neutral-800")}>{state}</button>)}</div></div>
      {selected.size > 0 ? <div className="flex flex-wrap items-center gap-2 border-b border-onboarding-purple-100 bg-onboarding-purple-50 px-4 py-3 dark:border-onboarding-purple-400/30 dark:bg-onboarding-purple-500/15"><span className="text-sm font-semibold text-onboarding-purple-700 dark:text-onboarding-purple-100">{selected.size} selected</span><Button size="sm" variant="secondary" onClick={() => void updateReview([...selected], "approved")}><Check /> Approve</Button><Button size="sm" variant="outline" onClick={() => void updateReview([...selected], "excluded")}>Exclude</Button><Select value={campaignId || null} onValueChange={(value) => setCampaignId(value === "__none" ? "" : value ?? "")}><SelectTrigger className="h-7 w-auto min-w-36 border-input bg-transparent px-2 text-xs dark:bg-input/30"><SelectValue placeholder="Choose campaign" /></SelectTrigger><SelectContent className="border-onboarding-neutral-150 bg-onboarding-neutral-0 text-onboarding-ink dark:border-onboarding-neutral-750 dark:bg-onboarding-neutral-900 dark:text-onboarding-neutral-0"><SelectItem value="__none" className="text-onboarding-ink dark:text-onboarding-neutral-0">Choose campaign</SelectItem>{campaigns.filter((campaign) => ["draft", "review"].includes(campaign.status)).map((campaign) => <SelectItem key={campaign.id} value={campaign.id} className="text-onboarding-ink dark:text-onboarding-neutral-0">{campaign.name}</SelectItem>)}</SelectContent></Select><Button size="sm" variant="brand" disabled={!campaignId || approvedSelectedCount === 0} onClick={() => void enrollSelected()}>Add {approvedSelectedCount || ""} approved</Button></div> : null}
      {isLoading ? <LoadingState /> : leads.length === 0 ? <EmptyState title="No prospects match these filters" detail="Import a CSV or run a strategy-led search to begin reviewing prospects. Paid scraping is not started from this workspace." /> : <div className="max-h-[calc(100dvh-21rem)] overflow-auto"><table className="w-full min-w-[67rem] text-left text-sm"><thead className="sticky top-0 z-10 bg-onboarding-neutral-50 text-xs text-onboarding-neutral-500 dark:bg-onboarding-neutral-850 dark:text-onboarding-neutral-400"><tr><th className="w-12 px-4 py-3"><span className="sr-only">Select</span></th><th className="px-3 py-3 font-medium">Prospect</th><th className="px-3 py-3 font-medium">Company and location</th><th className="px-3 py-3 font-medium">Reachable</th><th className="px-3 py-3 font-medium">Review</th><th className="px-3 py-3 font-medium">Lifecycle</th><th className="px-3 py-3 font-medium">Campaigns</th><th className="px-4 py-3 font-medium">Last activity</th></tr></thead><tbody className="divide-y divide-onboarding-neutral-150 dark:divide-onboarding-neutral-750">{leads.map((lead) => { const name = `${lead.firstName} ${lead.lastName}`.trim(); return <tr key={lead.id} onClick={() => router.push(`/dashboard/prospects/${lead.id}`)} className="cursor-pointer transition-colors hover:bg-onboarding-neutral-50 dark:hover:bg-onboarding-neutral-850"><td className="px-4 py-3" onClick={(event) => event.stopPropagation()}><input type="checkbox" checked={selected.has(lead.id)} onChange={(event) => setSelected((current) => { const next = new Set(current); if (event.target.checked) next.add(lead.id); else next.delete(lead.id); return next; })} aria-label={`Select ${name}`} /></td><td className="px-3 py-3"><div className="flex items-center gap-3"><ProspectAvatar name={name} url={lead.avatarUrl} /><div><p className="font-semibold">{name}</p><p className="mt-0.5 text-xs text-onboarding-neutral-500 dark:text-onboarding-neutral-400">{lead.title || "Title unavailable"}</p></div></div></td><td className="px-3 py-3"><p>{lead.company || "Company unavailable"}</p><p className="mt-0.5 text-xs text-onboarding-neutral-500 dark:text-onboarding-neutral-400">{lead.location || "Location unavailable"}</p></td><td className="px-3 py-3"><div className="flex gap-1.5">{lead.linkedinUrl ? <ChannelMark platform="linkedin" /> : null}{lead.email ? <span className="inline-flex size-7 items-center justify-center text-onboarding-success-500" title="Email available"><Mail className="size-4" /></span> : null}{lead.phone ? <span className="inline-flex size-7 items-center justify-center text-onboarding-success-500" title="Phone available"><CheckCircle2 className="size-4" /></span> : null}{!lead.linkedinUrl && !lead.email && !lead.phone ? <span className="text-xs text-onboarding-neutral-500">None</span> : null}</div></td><td className="px-3 py-3"><span className={cn("text-xs font-semibold", lead.reviewStatus === "approved" ? "text-onboarding-success-500" : lead.reviewStatus === "excluded" ? "text-onboarding-neutral-500" : "text-onboarding-warning-900 dark:text-onboarding-warning-150")}>{titleCase(lead.reviewStatus)}</span></td><td className="px-3 py-3 text-xs text-onboarding-neutral-600 dark:text-onboarding-neutral-400">{titleCase(lead.status)}</td><td className="px-3 py-3 text-xs text-onboarding-neutral-600 dark:text-onboarding-neutral-400">{lead.campaigns.length ? lead.campaigns.map((campaign) => campaign.name).join(", ") : "Not enrolled"}</td><td className="px-4 py-3 text-xs text-onboarding-neutral-500 dark:text-onboarding-neutral-400">{relativeTime(lead.lastActivityAt)}</td></tr>; })}</tbody></table></div>}</PageCard>
    {detail ? <div className="fixed inset-0 z-50 flex justify-end bg-onboarding-ink/20" role="dialog" aria-modal="true" aria-label="Prospect details"><button type="button" className="min-w-0 flex-1" aria-label="Close prospect details" onClick={closeDetail} /><aside className="h-full w-full max-w-xl overflow-y-auto border-l border-onboarding-neutral-150 bg-onboarding-neutral-0 p-5 shadow-xl dark:border-onboarding-neutral-750 dark:bg-onboarding-neutral-900 sm:p-7"><div className="flex items-start justify-between gap-4"><div className="flex items-center gap-3"><ProspectAvatar name={`${detail.firstName} ${detail.lastName}`} url={detail.avatarUrl} className="size-12" /><div><h2 className="text-xl font-semibold">{detail.firstName} {detail.lastName}</h2><p className="text-sm text-onboarding-neutral-600 dark:text-onboarding-neutral-400">{detail.title} at {detail.company}</p></div></div><Button variant="ghost" size="icon" onClick={closeDetail} aria-label="Close">×</Button></div><div className="mt-6 flex flex-wrap gap-2">{detail.reviewStatus !== "approved" ? <Button variant="brand" onClick={() => void updateReview([detail.id], "approved")}><Check /> Approve</Button> : null}{detail.reviewStatus !== "excluded" ? <Button variant="outline" onClick={() => void updateReview([detail.id], "excluded")}>Exclude</Button> : null}{detail.linkedinUrl ? <Button variant="secondary" asChild><a href={detail.linkedinUrl} target="_blank" rel="noreferrer">LinkedIn <ExternalLink /></a></Button> : null}</div><dl className="mt-7 grid grid-cols-2 gap-x-5 gap-y-5 text-sm"><div><dt className="text-onboarding-neutral-500">Location</dt><dd className="mt-1 font-medium">{detail.location || "Unavailable"}</dd></div><div><dt className="text-onboarding-neutral-500">Source</dt><dd className="mt-1 font-medium">{titleCase(detail.source)}</dd></div><div><dt className="text-onboarding-neutral-500">Email</dt><dd className="mt-1 break-all font-medium">{detail.email || "Unavailable"}</dd></div><div><dt className="text-onboarding-neutral-500">Phone</dt><dd className="mt-1 font-medium">{detail.phone || "Unavailable"}</dd></div></dl><section className="mt-8"><h3 className="font-semibold">Campaign membership</h3><div className="mt-3 space-y-2">{detail.campaigns.length ? detail.campaigns.map((membership) => <div key={membership.id} className="flex items-center justify-between rounded-lg border border-onboarding-neutral-150 px-3 py-2 text-sm dark:border-onboarding-neutral-750"><span>{membership.campaign.name}</span><span className="text-onboarding-neutral-500">{titleCase(membership.status)}</span></div>) : <p className="text-sm text-onboarding-neutral-500">Not enrolled in a campaign.</p>}</div></section><section className="mt-8"><h3 className="font-semibold">Recent activity</h3><div className="mt-3 space-y-3">{detail.messages.length ? detail.messages.map((message) => <div key={message.id} className="text-sm"><p className="font-medium">{message.direction === "inbound" ? "Inbound reply" : "Outbound message"}</p><p className="mt-1 text-onboarding-neutral-600 dark:text-onboarding-neutral-400">{message.content.message}</p></div>) : <p className="text-sm text-onboarding-neutral-500">No recorded messages yet.</p>}</div></section></aside></div> : null}
  </div>;
}

export const ProspectsView = ProspectsWorkspace;

export function MessagesView({ conversationId }: { conversationId?: string }) {
  return <MessagesWorkspace conversationId={conversationId} />;
}

export function ActivityView() {
  return <ActivityWorkspace />;
}

export function ChannelsView() {
  return <ChannelsWorkspace />;
}

export function AnalyticsView() {
  return <AnalyticsWorkspace />;
}

export function SettingsView() {
  return <SettingsWorkspace />;
}

function ErrorNotice({ message }: { message: string }) { return <div className="flex items-start gap-3 rounded-onboarding border border-onboarding-error-500/30 bg-onboarding-error-50 p-4 text-sm text-onboarding-error-900 dark:bg-onboarding-error-900 dark:text-onboarding-error-50" role="alert"><CircleAlert className="mt-0.5 size-4 shrink-0" /><p>{message}</p></div>; }
function LoadingState() { return <div className="flex min-h-44 items-center justify-center text-sm text-onboarding-neutral-600 dark:text-onboarding-neutral-400"><Loader2 className="mr-2 size-4 animate-spin" />Loading workspace data</div>; }

export function DashboardPageFrame({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-[100rem] px-[var(--dashboard-page-px,1rem)] py-[var(--dashboard-page-py,1.25rem)]",
        className,
      )}
    >
      {children}
    </div>
  );
}
