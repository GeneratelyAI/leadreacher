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
  CreditCard,
  ExternalLink,
  Link2,
  Loader2,
  Mail,
  Megaphone,
  MessageSquare,
  Moon,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings,
  Sparkles,
  Sun,
  Users,
} from "lucide-react";
import { type FormEvent, type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { ChannelLogo } from "@/components/onboarding/ChannelLogo";
import { OnboardingLogo } from "@/components/onboarding/OnboardingLogo";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useThemeMode } from "@/hooks/useThemeMode";
import { ApiError, apiFetch } from "@/lib/api";
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

type ConversationRow = {
  id: string;
  campaignLeadStatus: string;
  prospect: { name: string; title: string; company: string; avatarUrl: string | null };
  campaign: { id: string; name: string };
  sender: { id: string; accountName: string; platform: string; status: string; unipileId: string | null } | null;
  latestMessage: { id: string; content: string; direction: string; origin: string; occurredAt: string };
  unreadCount: number;
  needsReply: boolean;
};

type ConversationDetail = {
  id: string;
  status: string;
  chatId: string | null;
  prospect: { name: string; title: string; company: string; location: string | null; linkedinUrl: string | null; avatarUrl: string | null; status: string };
  campaign: { id: string; name: string };
  sender: { id: string; accountName: string; platform: string; status: string; unipileId: string | null } | null;
  senderLimit: { limit: number; remaining: number; resetAt: string } | null;
  canReply: boolean;
  messages: Array<{ id: string; direction: string; origin: string; status: string; content: { message: string; attachments: Array<{ type: string; videoUrl?: string }> }; occurredAt: string }>;
};

type Analytics = {
  totals: { sent: number; received: number; delivered: number; replies: number; meetings: number };
  channels: Array<{ channel: string; sent: number; received: number }>;
  campaigns: Array<{ id: string; name: string; status: string; prospectCount: number }>;
};

type AnalyticsInsights = {
  status: "ready" | "aggregating" | "no_data";
  whatsWorking: Array<{ campaignId: string; campaignName: string; text: string }>;
  whatsNotWorking: Array<{ campaignId: string; campaignName: string; text: string }>;
  whatToDoNext: Array<{
    campaignId: string;
    campaignName: string;
    action: string;
    reason: string;
    priority: 1 | 2 | 3;
  }>;
};

type WorkspaceSettings = {
  organization: {
    name: string;
    plan: string;
    subscriptionStatus: string | null;
    currentPeriodEnd: string | null;
    hasBillingPortal: boolean;
  } | null;
};

type WorkspaceActivity = {
  id: string;
  kind: "message" | "prospect" | "video" | "campaign";
  title: string;
  detail: string;
  occurredAt: string;
  avatarUrl?: string | null;
  channel?: string;
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
  if (platform === "linkedin" || platform === "whatsapp") {
    return (
      <span
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-[0.35rem] text-white",
          size === "badge" ? "size-4" : "size-9",
          platform === "linkedin" ? "bg-[#0A66C2]" : "bg-[#25D366]",
          className,
        )}
      >
        <ChannelLogo name={platform} className={size === "badge" ? "size-2.5" : "size-5"} />
      </span>
    );
  }

  return <span className={cn("inline-flex shrink-0 items-center justify-center rounded-[0.35rem] bg-onboarding-purple-100 text-onboarding-purple-600 dark:bg-onboarding-purple-900 dark:text-onboarding-purple-100", size === "badge" ? "size-4" : "size-9", className)}><Link2 className={size === "badge" ? "size-2.5" : "size-4"} /></span>;
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

export function CampaignsView() {
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
          <label className="grid gap-2 text-sm font-medium">LinkedIn sender<select required value={senderAccountId} onChange={(event) => setSenderAccountId(event.target.value)} className="h-8 rounded-lg border border-input bg-transparent px-3 text-sm dark:bg-input/30"><option value="">Select a connected account</option>{accounts.filter((account) => account.platform === "linkedin" && account.status === "active").map((account) => <option key={account.id} value={account.id}>{account.accountName}</option>)}</select></label>
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

export function ProspectsView() {
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
    <PageCard className="overflow-hidden"><div className="flex flex-col gap-3 border-b border-onboarding-neutral-150 p-4 dark:border-onboarding-neutral-750"><div className="flex flex-col gap-2 lg:flex-row"><label className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border border-onboarding-neutral-150 px-3 dark:border-onboarding-neutral-750"><Search className="size-4 text-onboarding-neutral-500" /><span className="sr-only">Search prospects</span><input value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm outline-none" placeholder="Search name, company, or title" /></label><div className="flex gap-2"><select value={lifecycle} onChange={(event) => setLifecycle(event.target.value)} className="h-9 rounded-lg border border-input bg-transparent px-2 text-sm dark:bg-input/30"><option value="">All lifecycle states</option>{LEAD_STATUSES.map((status) => <option key={status} value={status}>{titleCase(status)}</option>)}</select><select value={source} onChange={(event) => setSource(event.target.value)} className="h-9 rounded-lg border border-input bg-transparent px-2 text-sm dark:bg-input/30"><option value="">All sources</option><option value="apify">LinkedIn search</option><option value="csv">CSV import</option><option value="manual">Manual</option></select></div></div><div className="flex items-center gap-1 overflow-x-auto" role="tablist" aria-label="Review state">{(["all", "pending", "approved", "excluded"] as const).map((state) => <button key={state} type="button" role="tab" aria-selected={reviewStatus === state} onClick={() => setReviewStatus(state)} className={cn("h-8 rounded-lg px-3 text-sm font-medium capitalize transition-colors", reviewStatus === state ? "bg-onboarding-purple-50 text-onboarding-purple-700 dark:bg-onboarding-purple-900 dark:text-onboarding-purple-100" : "text-onboarding-neutral-600 hover:bg-onboarding-neutral-100 dark:text-onboarding-neutral-400 dark:hover:bg-onboarding-neutral-800")}>{state}</button>)}</div></div>
      {selected.size > 0 ? <div className="flex flex-wrap items-center gap-2 border-b border-onboarding-purple-100 bg-onboarding-purple-50 px-4 py-3 dark:border-onboarding-purple-800 dark:bg-onboarding-purple-950"><span className="text-sm font-semibold text-onboarding-purple-700 dark:text-onboarding-purple-100">{selected.size} selected</span><Button size="sm" variant="secondary" onClick={() => void updateReview([...selected], "approved")}><Check /> Approve</Button><Button size="sm" variant="outline" onClick={() => void updateReview([...selected], "excluded")}>Exclude</Button><select value={campaignId} onChange={(event) => setCampaignId(event.target.value)} className="h-7 rounded-lg border border-input bg-transparent px-2 text-xs dark:bg-input/30"><option value="">Choose campaign</option>{campaigns.filter((campaign) => ["draft", "review"].includes(campaign.status)).map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}</select><Button size="sm" variant="brand" disabled={!campaignId || approvedSelectedCount === 0} onClick={() => void enrollSelected()}>Add {approvedSelectedCount || ""} approved</Button></div> : null}
      {isLoading ? <LoadingState /> : leads.length === 0 ? <EmptyState title="No prospects match these filters" detail="Import a CSV or run a strategy-led search to begin reviewing prospects. Paid scraping is not started from this workspace." /> : <div className="max-h-[calc(100dvh-21rem)] overflow-auto"><table className="w-full min-w-[67rem] text-left text-sm"><thead className="sticky top-0 z-10 bg-onboarding-neutral-50 text-xs text-onboarding-neutral-500 dark:bg-onboarding-neutral-850 dark:text-onboarding-neutral-400"><tr><th className="w-12 px-4 py-3"><span className="sr-only">Select</span></th><th className="px-3 py-3 font-medium">Prospect</th><th className="px-3 py-3 font-medium">Company and location</th><th className="px-3 py-3 font-medium">Reachable</th><th className="px-3 py-3 font-medium">Review</th><th className="px-3 py-3 font-medium">Lifecycle</th><th className="px-3 py-3 font-medium">Campaigns</th><th className="px-4 py-3 font-medium">Last activity</th></tr></thead><tbody className="divide-y divide-onboarding-neutral-150 dark:divide-onboarding-neutral-750">{leads.map((lead) => { const name = `${lead.firstName} ${lead.lastName}`.trim(); return <tr key={lead.id} onClick={() => router.push(`/dashboard/prospects/${lead.id}`)} className="cursor-pointer transition-colors hover:bg-onboarding-neutral-50 dark:hover:bg-onboarding-neutral-850"><td className="px-4 py-3" onClick={(event) => event.stopPropagation()}><input type="checkbox" checked={selected.has(lead.id)} onChange={(event) => setSelected((current) => { const next = new Set(current); if (event.target.checked) next.add(lead.id); else next.delete(lead.id); return next; })} aria-label={`Select ${name}`} /></td><td className="px-3 py-3"><div className="flex items-center gap-3"><ProspectAvatar name={name} url={lead.avatarUrl} /><div><p className="font-semibold">{name}</p><p className="mt-0.5 text-xs text-onboarding-neutral-500 dark:text-onboarding-neutral-400">{lead.title || "Title unavailable"}</p></div></div></td><td className="px-3 py-3"><p>{lead.company || "Company unavailable"}</p><p className="mt-0.5 text-xs text-onboarding-neutral-500 dark:text-onboarding-neutral-400">{lead.location || "Location unavailable"}</p></td><td className="px-3 py-3"><div className="flex gap-1.5">{lead.linkedinUrl ? <ChannelMark platform="linkedin" /> : null}{lead.email ? <span className="inline-flex size-7 items-center justify-center text-onboarding-success-500" title="Email available"><Mail className="size-4" /></span> : null}{lead.phone ? <span className="inline-flex size-7 items-center justify-center text-onboarding-success-500" title="Phone available"><CheckCircle2 className="size-4" /></span> : null}{!lead.linkedinUrl && !lead.email && !lead.phone ? <span className="text-xs text-onboarding-neutral-500">None</span> : null}</div></td><td className="px-3 py-3"><span className={cn("text-xs font-semibold", lead.reviewStatus === "approved" ? "text-onboarding-success-500" : lead.reviewStatus === "excluded" ? "text-onboarding-neutral-500" : "text-onboarding-warning-900 dark:text-onboarding-warning-150")}>{titleCase(lead.reviewStatus)}</span></td><td className="px-3 py-3 text-xs text-onboarding-neutral-600 dark:text-onboarding-neutral-400">{titleCase(lead.status)}</td><td className="px-3 py-3 text-xs text-onboarding-neutral-600 dark:text-onboarding-neutral-400">{lead.campaigns.length ? lead.campaigns.map((campaign) => campaign.name).join(", ") : "Not enrolled"}</td><td className="px-4 py-3 text-xs text-onboarding-neutral-500 dark:text-onboarding-neutral-400">{relativeTime(lead.lastActivityAt)}</td></tr>; })}</tbody></table></div>}</PageCard>
    {detail ? <div className="fixed inset-0 z-50 flex justify-end bg-onboarding-ink/20" role="dialog" aria-modal="true" aria-label="Prospect details"><button type="button" className="min-w-0 flex-1" aria-label="Close prospect details" onClick={closeDetail} /><aside className="h-full w-full max-w-xl overflow-y-auto border-l border-onboarding-neutral-150 bg-onboarding-neutral-0 p-5 shadow-xl dark:border-onboarding-neutral-750 dark:bg-onboarding-neutral-900 sm:p-7"><div className="flex items-start justify-between gap-4"><div className="flex items-center gap-3"><ProspectAvatar name={`${detail.firstName} ${detail.lastName}`} url={detail.avatarUrl} className="size-12" /><div><h2 className="text-xl font-semibold">{detail.firstName} {detail.lastName}</h2><p className="text-sm text-onboarding-neutral-600 dark:text-onboarding-neutral-400">{detail.title} at {detail.company}</p></div></div><Button variant="ghost" size="icon" onClick={closeDetail} aria-label="Close">×</Button></div><div className="mt-6 flex flex-wrap gap-2">{detail.reviewStatus !== "approved" ? <Button variant="brand" onClick={() => void updateReview([detail.id], "approved")}><Check /> Approve</Button> : null}{detail.reviewStatus !== "excluded" ? <Button variant="outline" onClick={() => void updateReview([detail.id], "excluded")}>Exclude</Button> : null}{detail.linkedinUrl ? <Button variant="secondary" asChild><a href={detail.linkedinUrl} target="_blank" rel="noreferrer">LinkedIn <ExternalLink /></a></Button> : null}</div><dl className="mt-7 grid grid-cols-2 gap-x-5 gap-y-5 text-sm"><div><dt className="text-onboarding-neutral-500">Location</dt><dd className="mt-1 font-medium">{detail.location || "Unavailable"}</dd></div><div><dt className="text-onboarding-neutral-500">Source</dt><dd className="mt-1 font-medium">{titleCase(detail.source)}</dd></div><div><dt className="text-onboarding-neutral-500">Email</dt><dd className="mt-1 break-all font-medium">{detail.email || "Unavailable"}</dd></div><div><dt className="text-onboarding-neutral-500">Phone</dt><dd className="mt-1 font-medium">{detail.phone || "Unavailable"}</dd></div></dl><section className="mt-8"><h3 className="font-semibold">Campaign membership</h3><div className="mt-3 space-y-2">{detail.campaigns.length ? detail.campaigns.map((membership) => <div key={membership.id} className="flex items-center justify-between rounded-lg border border-onboarding-neutral-150 px-3 py-2 text-sm dark:border-onboarding-neutral-750"><span>{membership.campaign.name}</span><span className="text-onboarding-neutral-500">{titleCase(membership.status)}</span></div>) : <p className="text-sm text-onboarding-neutral-500">Not enrolled in a campaign.</p>}</div></section><section className="mt-8"><h3 className="font-semibold">Recent activity</h3><div className="mt-3 space-y-3">{detail.messages.length ? detail.messages.map((message) => <div key={message.id} className="text-sm"><p className="font-medium">{message.direction === "inbound" ? "Inbound reply" : "Outbound message"}</p><p className="mt-1 text-onboarding-neutral-600 dark:text-onboarding-neutral-400">{message.content.message}</p></div>) : <p className="text-sm text-onboarding-neutral-500">No recorded messages yet.</p>}</div></section></aside></div> : null}
  </div>;
}

export function MessagesView({ conversationId }: { conversationId?: string }) {
  const router = useRouter();
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(conversationId ?? null);
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [message, setMessage] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const [query, setQuery] = useState("");
  const [state, setState] = useState<"all" | "unread" | "needs_reply">("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isDrafting, setIsDrafting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [limitError, setLimitError] = useState<string | null>(null);
  const load = useCallback(async () => { const params = new URLSearchParams({ state, limit: "100" }); if (query) params.set("query", query); setIsLoading(true); try { const result = await apiFetch<{ conversations: ConversationRow[] }>(`/dashboard/conversations?${params.toString()}`); setConversations(result.conversations); setSelectedId((current) => conversationId ?? (current && result.conversations.some((conversation) => conversation.id === current) ? current : null)); setError(null); } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Unable to load conversations."); } finally { setIsLoading(false); } }, [conversationId, query, state]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setSelectedId(conversationId ?? null); }, [conversationId]);
  const loadDetail = useCallback(async (id: string) => { try { const result = await apiFetch<{ conversation: ConversationDetail }>(`/dashboard/conversations/${id}`); setDetail(result.conversation); setLimitError(null); } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Unable to load conversation."); } }, []);
  useEffect(() => { if (selectedId) void loadDetail(selectedId); else setDetail(null); }, [loadDetail, selectedId]);
  async function generateDraft() { if (!detail) return; setIsDrafting(true); try { const result = await apiFetch<{ drafts: string[] }>(`/dashboard/conversations/${detail.id}/drafts`, { method: "POST", body: JSON.stringify({}) }); setMessage(result.drafts[0] ?? ""); } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Unable to generate a draft."); } finally { setIsDrafting(false); } }
  async function sendReply() { if (!detail || !message.trim() || isSending) return; setIsSending(true); setLimitError(null); try { await apiFetch(`/dashboard/conversations/${detail.id}/replies`, { method: "POST", body: JSON.stringify({ message, idempotencyKey }) }); setMessage(""); setIdempotencyKey(crypto.randomUUID()); await Promise.all([load(), loadDetail(detail.id)]); } catch (requestError) { if (requestError instanceof ApiError && requestError.code === "daily_message_limit") setLimitError(requestError.message); else setError(requestError instanceof Error ? requestError.message : "Unable to send reply."); } finally { setIsSending(false); } }
  const resetTime = detail?.senderLimit ? new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(detail.senderLimit.resetAt)) : null;
  const isLimitReached = Boolean(detail?.senderLimit && detail.senderLimit.remaining <= 0);
  return <div className="flex h-[calc(100dvh-9.75rem)] min-h-[34rem] flex-col gap-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-3xl font-semibold tracking-tight">Messages</h1><p className="mt-2 text-sm text-onboarding-neutral-600 dark:text-onboarding-neutral-400">Operator inbox for LinkedIn conversations. AI drafts are editable, and every reply is sent only after your explicit action.</p></div><div className="flex gap-2"><Button size="sm" variant={state === "all" ? "secondary" : "ghost"} onClick={() => setState("all")}>All</Button><Button size="sm" variant={state === "unread" ? "secondary" : "ghost"} onClick={() => setState("unread")}>Unread</Button><Button size="sm" variant={state === "needs_reply" ? "secondary" : "ghost"} onClick={() => setState("needs_reply")}>Needs reply</Button></div></div>{error ? <ErrorNotice message={error} /> : null}<PageCard className="min-h-0 flex-1 overflow-hidden"><div className="grid h-full min-h-0 lg:grid-cols-[22rem_minmax(0,1fr)_17rem]"><aside className="min-h-0 border-b border-onboarding-neutral-150 dark:border-onboarding-neutral-750 lg:border-r lg:border-b-0"><div className="border-b border-onboarding-neutral-150 p-3 dark:border-onboarding-neutral-750"><label className="flex h-9 items-center gap-2 rounded-lg border border-onboarding-neutral-150 px-3 dark:border-onboarding-neutral-750"><Search className="size-4 text-onboarding-neutral-500" /><span className="sr-only">Search conversations</span><input value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm outline-none" placeholder="Search conversations" /></label></div><div className="h-[12rem] overflow-y-auto lg:h-full">{isLoading ? <LoadingState /> : conversations.length === 0 ? <EmptyState title="No conversations yet" detail="Replies will appear here once prospects respond." /> : <ul>{conversations.map((conversation) => <li key={conversation.id}><button type="button" onClick={() => router.push(`/dashboard/messages/${conversation.id}`)} className={cn("flex w-full gap-3 border-b border-onboarding-neutral-150 px-3 py-3 text-left transition-colors dark:border-onboarding-neutral-750", selectedId === conversation.id ? "bg-onboarding-purple-50 dark:bg-onboarding-purple-950" : "hover:bg-onboarding-neutral-50 dark:hover:bg-onboarding-neutral-850")}><ProspectAvatar name={conversation.prospect.name} url={conversation.prospect.avatarUrl} /><span className="min-w-0 flex-1"><span className="flex items-baseline justify-between gap-2"><span className="truncate font-semibold">{conversation.prospect.name}</span><time className="shrink-0 text-[11px] text-onboarding-neutral-500">{relativeTime(conversation.latestMessage.occurredAt)}</time></span><span className="mt-0.5 block truncate text-xs text-onboarding-neutral-500">{conversation.prospect.company}</span><span className="mt-1 block truncate text-sm text-onboarding-neutral-600 dark:text-onboarding-neutral-400">{conversation.latestMessage.content}</span></span>{conversation.unreadCount ? <span className="mt-1 size-2 rounded-full bg-onboarding-purple-500" aria-label={`${conversation.unreadCount} unread messages`} /> : null}</button></li>)}</ul>}</div></aside><main className="flex min-h-0 flex-col">{detail ? <><div className="flex items-center justify-between border-b border-onboarding-neutral-150 px-4 py-3 dark:border-onboarding-neutral-750"><div className="flex items-center gap-3"><ProspectAvatar name={detail.prospect.name} url={detail.prospect.avatarUrl} /><div><p className="font-semibold">{detail.prospect.name}</p><p className="text-xs text-onboarding-neutral-500">{detail.prospect.company} · {detail.campaign.name}</p></div></div>{detail.prospect.linkedinUrl ? <a href={detail.prospect.linkedinUrl} target="_blank" rel="noreferrer" className="text-onboarding-purple-600" aria-label="Open LinkedIn profile"><ExternalLink className="size-4" /></a> : null}</div><div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">{detail.messages.map((item) => <div key={item.id} className={cn("flex", item.direction === "inbound" ? "justify-start" : "justify-end")}><div className={cn("max-w-[82%] rounded-xl px-3 py-2 text-sm leading-6", item.direction === "inbound" ? "bg-onboarding-neutral-100 text-onboarding-ink dark:bg-onboarding-neutral-800 dark:text-onboarding-neutral-0" : "bg-onboarding-purple-600 text-white")}><p>{item.content.message}</p>{item.content.attachments.filter((attachment) => attachment.type === "video" && attachment.videoUrl).map((attachment) => <a key={attachment.videoUrl} href={attachment.videoUrl} target="_blank" rel="noreferrer" className="mt-2 flex items-center gap-1 text-xs underline">Video attachment <ExternalLink className="size-3" /></a>)}<time className={cn("mt-1 block text-[10px]", item.direction === "inbound" ? "text-onboarding-neutral-500" : "text-white/70")}>{relativeTime(item.occurredAt)}{item.origin === "operator" ? " · Operator" : ""}</time></div></div>)}</div><div className="border-t border-onboarding-neutral-150 p-3 dark:border-onboarding-neutral-750">{limitError || isLimitReached ? <p className="mb-2 text-xs font-medium text-onboarding-warning-900 dark:text-onboarding-warning-150">{limitError || `Daily LinkedIn message limit reached. Sending resets at ${resetTime}.`}</p> : null}{!detail.canReply ? <p className="text-sm text-onboarding-neutral-500">A real inbound reply and an active campaign sender are required before an operator can reply.</p> : <><textarea value={message} onChange={(event) => setMessage(event.target.value)} className="min-h-24 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30" placeholder="Write a reply..." /><div className="mt-2 flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-onboarding-neutral-500">Send as {detail.sender?.accountName || "LinkedIn account"}{detail.senderLimit ? ` · ${detail.senderLimit.remaining}/${detail.senderLimit.limit} remaining today` : ""}</p><div className="flex gap-2"><Button size="sm" variant="secondary" disabled={isDrafting || isLimitReached} onClick={() => void generateDraft()}>{isDrafting ? <Loader2 className="animate-spin" /> : <Sparkles />} Draft</Button><Button size="sm" variant="brand" disabled={isSending || !message.trim() || isLimitReached} onClick={() => void sendReply()}>{isSending ? <Loader2 className="animate-spin" /> : <Send />} Send reply</Button></div></div></>}</div></> : <EmptyState title="Choose a conversation" detail="Select a conversation to view the full message history and prospect context." />}</main><aside className="hidden min-h-0 overflow-y-auto border-l border-onboarding-neutral-150 p-4 dark:border-onboarding-neutral-750 lg:block">{detail ? <><h2 className="font-semibold">Prospect context</h2><div className="mt-4 flex items-center gap-3"><ProspectAvatar name={detail.prospect.name} url={detail.prospect.avatarUrl} /><div><p className="font-medium">{detail.prospect.name}</p><p className="text-xs text-onboarding-neutral-500">{detail.prospect.title || "Title unavailable"}</p></div></div><dl className="mt-6 space-y-4 text-sm"><div><dt className="text-onboarding-neutral-500">Campaign</dt><dd className="mt-1 font-medium">{detail.campaign.name}</dd></div><div><dt className="text-onboarding-neutral-500">Sending account</dt><dd className="mt-1 font-medium">{detail.sender?.accountName || "Not configured"}</dd></div><div><dt className="text-onboarding-neutral-500">Automation</dt><dd className="mt-1 font-medium">Stopped after inbound reply</dd></div></dl></> : null}</aside></div></PageCard></div>;
}

export function ActivityView() {
  const [activity, setActivity] = useState<WorkspaceActivity[]>([]);
  const [kind, setKind] = useState<"all" | WorkspaceActivity["kind"]>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await apiFetch<{ activity: WorkspaceActivity[] }>(`/dashboard/activity?kind=${kind}&limit=100`);
      setActivity(result.activity);
      setError(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load activity.");
    } finally { setIsLoading(false); }
  }, [kind]);
  useEffect(() => { void load(); }, [load]);

  return <div className="space-y-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><div className="flex items-center gap-2"><h1 className="text-3xl font-semibold tracking-tight">Activity</h1><span className="size-2 rounded-full bg-onboarding-success-500" aria-hidden /></div><p className="mt-2 text-sm text-onboarding-neutral-600 dark:text-onboarding-neutral-400">A chronological record of actual prospect, campaign, message, and video events in your workspace.</p></div><div className="flex gap-1 overflow-x-auto" role="tablist" aria-label="Activity type">{(["all", "message", "prospect", "campaign", "video"] as const).map((value) => <button key={value} type="button" role="tab" aria-selected={kind === value} onClick={() => setKind(value)} className={cn("h-8 rounded-lg px-3 text-sm font-medium capitalize", kind === value ? "bg-onboarding-purple-50 text-onboarding-purple-700 dark:bg-onboarding-purple-900 dark:text-onboarding-purple-100" : "text-onboarding-neutral-600 hover:bg-onboarding-neutral-100 dark:text-onboarding-neutral-400 dark:hover:bg-onboarding-neutral-800")}>{value === "all" ? "All activity" : `${titleCase(value)}s`}</button>)}</div></div>{error ? <ErrorNotice message={error} /> : null}<PageCard className="overflow-hidden">{isLoading ? <LoadingState /> : activity.length === 0 ? <EmptyState title="No activity yet" detail="Activity will appear after prospects are added, campaigns are updated, or outreach begins." /> : <ul className="divide-y divide-onboarding-neutral-150 dark:divide-onboarding-neutral-750">{activity.map((item) => <li key={item.id} className="flex items-center gap-3 px-5 py-3.5"><ActivityMark item={item} /><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{item.title}</p><p className="mt-0.5 truncate text-sm text-onboarding-neutral-600 dark:text-onboarding-neutral-400">{item.detail}</p></div><time dateTime={item.occurredAt} className="shrink-0 text-xs text-onboarding-neutral-500 dark:text-onboarding-neutral-400">{relativeTime(item.occurredAt)}</time></li>)}</ul>}</PageCard></div>;
}

function ActivityMark({ item }: { item: WorkspaceActivity }) {
  if (item.avatarUrl) {
    return (
      <span className="relative size-9 shrink-0" aria-hidden>
        <ProspectAvatar name={item.title} url={item.avatarUrl} />
        {item.channel === "linkedin" || item.channel === "whatsapp" ? (
          <ChannelMark
            platform={item.channel}
            size="badge"
            className="absolute -right-0.5 -bottom-0.5 border-2 border-onboarding-neutral-0 dark:border-onboarding-neutral-900"
          />
        ) : null}
      </span>
    );
  }
  if (item.channel === "linkedin" || item.channel === "whatsapp") return <ChannelMark platform={item.channel} />;
  const Icon = item.kind === "message" ? MessageSquare : item.kind === "prospect" ? Users : item.kind === "video" ? Sparkles : Megaphone;
  return <Icon className="size-5 shrink-0 text-onboarding-purple-600 dark:text-onboarding-purple-200" aria-hidden />;
}

export function ChannelsView() {
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => { setIsLoading(true); try { const result = await apiFetch<{ accounts: SocialAccount[] }>("/social-accounts"); setAccounts(result.accounts); setError(null); } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Unable to load channels."); } finally { setIsLoading(false); } }, []);
  useEffect(() => { void load(); }, [load]);
  async function sync() { setIsSyncing(true); try { await apiFetch("/social-accounts/sync", { method: "POST", body: JSON.stringify({}) }); await load(); } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Unable to sync channels."); } finally { setIsSyncing(false); } }
  async function connectLinkedIn() { try { const result = await apiFetch<{ url: string }>("/social-accounts/connect", { method: "POST", body: JSON.stringify({ provider: "LINKEDIN", returnTo: "home" }) }); window.location.assign(result.url); } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Unable to start channel connection."); } }
  return <div className="space-y-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-3xl font-semibold tracking-tight">Channels</h1><p className="mt-2 text-sm text-onboarding-neutral-600 dark:text-onboarding-neutral-400">Manage the connected accounts that make approved outreach delivery possible.</p></div><div className="flex gap-2"><Button variant="secondary" onClick={() => void sync()} disabled={isSyncing}>{isSyncing ? <Loader2 className="animate-spin" /> : <RefreshCw />} Sync accounts</Button><Button variant="brand" onClick={() => void connectLinkedIn()}><Plus /> Connect LinkedIn</Button></div></div>{error ? <ErrorNotice message={error} /> : null}<PageCard className="overflow-hidden">{isLoading ? <LoadingState /> : accounts.length === 0 ? <EmptyState title="No channels connected" detail="Connect LinkedIn to make the first outreach channel available. Connecting an account does not send outreach." /> : <ul className="divide-y divide-onboarding-neutral-150 dark:divide-onboarding-neutral-750">{accounts.map((account) => <li key={`${account.platform}:${account.accountName}`} className="flex items-center gap-3 px-5 py-4"><ChannelMark platform={account.platform} /><div className="min-w-0 flex-1"><p className="font-semibold">{channelName(account.platform)}</p><p className="truncate text-sm text-onboarding-neutral-600 dark:text-onboarding-neutral-400">{account.accountName}</p></div><span className={cn("inline-flex items-center gap-1.5 text-xs font-semibold", account.status === "active" ? "text-onboarding-success-500" : "text-onboarding-warning-900 dark:text-onboarding-warning-150")}><CheckCircle2 className="size-3.5" />{titleCase(account.status)}</span></li>)}</ul>}</PageCard></div>;
}

export function AnalyticsView() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [insights, setInsights] = useState<AnalyticsInsights | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      apiFetch<Analytics>("/dashboard/analytics"),
      apiFetch<AnalyticsInsights>("/dashboard/analytics/insights"),
    ])
      .then(([analyticsResult, insightsResult]) => {
        if (cancelled) return;
        setAnalytics(analyticsResult);
        setInsights(insightsResult);
      })
      .catch((requestError) => {
        if (!cancelled) {
          setError(requestError instanceof Error ? requestError.message : "Unable to load analytics.");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const metrics = analytics
    ? [
        { label: "Sent", value: analytics.totals.sent },
        { label: "Received", value: analytics.totals.received },
        { label: "Delivered", value: analytics.totals.delivered },
        { label: "Replies", value: analytics.totals.replies },
        { label: "Meetings", value: analytics.totals.meetings },
      ]
    : [];

  return <div className="space-y-6">
    <div><h1 className="text-3xl font-semibold tracking-tight">Analytics</h1><p className="mt-2 text-sm text-onboarding-neutral-600 dark:text-onboarding-neutral-400">Factual delivery and reply totals based on persisted messages and lead lifecycle data.</p></div>
    {error ? <ErrorNotice message={error} /> : null}
    {isLoading ? <PageCard><LoadingState /></PageCard> : analytics ? <>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{metrics.map((metric) => <PageCard key={metric.label} className="p-5"><p className="text-2xl font-semibold">{new Intl.NumberFormat().format(metric.value)}</p><p className="mt-1 text-sm text-onboarding-neutral-600 dark:text-onboarding-neutral-400">{metric.label}</p></PageCard>)}</section>
      <div className="grid gap-5 lg:grid-cols-2"><PageCard className="overflow-hidden"><div className="border-b border-onboarding-neutral-150 px-5 py-4 dark:border-onboarding-neutral-750"><h2 className="font-semibold">Channel delivery</h2></div>{analytics.channels.length === 0 ? <EmptyState title="No delivery data" detail="Channel totals appear after messages are recorded." /> : <ul className="divide-y divide-onboarding-neutral-150 dark:divide-onboarding-neutral-750">{analytics.channels.map((channel) => <li key={channel.channel} className="flex items-center gap-3 px-5 py-4"><ChannelMark platform={channel.channel} /><div className="min-w-0 flex-1"><p className="font-medium">{channelName(channel.channel)}</p><p className="text-sm text-onboarding-neutral-600 dark:text-onboarding-neutral-400">{channel.sent} sent · {channel.received} received</p></div></li>)}</ul>}</PageCard><PageCard className="overflow-hidden"><div className="border-b border-onboarding-neutral-150 px-5 py-4 dark:border-onboarding-neutral-750"><h2 className="font-semibold">Campaign coverage</h2></div>{analytics.campaigns.length === 0 ? <EmptyState title="No campaigns yet" detail="Campaign totals appear here after you create a draft." /> : <ul className="divide-y divide-onboarding-neutral-150 dark:divide-onboarding-neutral-750">{analytics.campaigns.map((campaign) => <li key={campaign.id} className="flex items-center justify-between gap-3 px-5 py-4"><div><p className="font-medium">{campaign.name}</p><p className="mt-1 text-sm text-onboarding-neutral-600 dark:text-onboarding-neutral-400">{campaign.prospectCount} prospects</p></div><span className="text-xs font-semibold text-onboarding-neutral-500 dark:text-onboarding-neutral-400">{titleCase(campaign.status)}</span></li>)}</ul>}</PageCard></div>
      <section aria-labelledby="analytics-insights-heading"><div className="mb-3"><h2 id="analytics-insights-heading" className="text-xl font-semibold">Insights</h2><p className="mt-1 text-sm text-onboarding-neutral-600 dark:text-onboarding-neutral-400">Narrated only from recorded outreach performance.</p></div>{insights?.status === "no_data" ? <PageCard><EmptyState title="Once you have sent some outreach, insights will appear here" detail="There is no persisted send history to analyze yet." /></PageCard> : insights?.status === "aggregating" || !insights ? <PageCard><EmptyState title="Still gathering data" detail="Recorded outreach is being summarized. Check back shortly for data-backed insights." /></PageCard> : <div className="grid gap-5 xl:grid-cols-3"><InsightPanel title="What’s working" items={insights.whatsWorking.map((item) => <div key={`${item.campaignId}:${item.text}`}><p className="text-sm leading-6">{item.text}</p><p className="mt-1 text-xs text-onboarding-neutral-500 dark:text-onboarding-neutral-400">{item.campaignName}</p></div>)} empty="No positive patterns are available from the recorded data yet." /><InsightPanel title="What’s not working" items={insights.whatsNotWorking.map((item) => <div key={`${item.campaignId}:${item.text}`}><p className="text-sm leading-6">{item.text}</p><p className="mt-1 text-xs text-onboarding-neutral-500 dark:text-onboarding-neutral-400">{item.campaignName}</p></div>)} empty="No underperforming pattern is available from the recorded data yet." /><InsightPanel title="What to do next" items={insights.whatToDoNext.map((item) => <div key={`${item.campaignId}:${item.action}`}><p className="text-sm font-medium leading-6">{item.action}</p><p className="mt-1 text-sm leading-6 text-onboarding-neutral-600 dark:text-onboarding-neutral-400">{item.reason}</p><p className="mt-2 text-xs text-onboarding-neutral-500 dark:text-onboarding-neutral-400">Priority {item.priority} · {item.campaignName}</p></div>)} empty="No next action is available from the recorded data yet." /></div>}</section>
    </> : null}
  </div>;
}

function InsightPanel({ title, items, empty }: { title: string; items: ReactNode[]; empty: string }) {
  return <PageCard className="overflow-hidden"><div className="border-b border-onboarding-neutral-150 px-5 py-4 dark:border-onboarding-neutral-750"><h3 className="font-semibold">{title}</h3></div>{items.length === 0 ? <EmptyState title={empty} detail="" /> : <ul className="divide-y divide-onboarding-neutral-150 dark:divide-onboarding-neutral-750">{items.map((item, index) => <li key={index} className="px-5 py-4">{item}</li>)}</ul>}</PageCard>;
}

export function SettingsView() {
  const [settings, setSettings] = useState<WorkspaceSettings | null>(null);
  const [name, setName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const load = useCallback(async () => { try { const result = await apiFetch<WorkspaceSettings>("/dashboard/settings"); setSettings(result); setName(result.organization?.name ?? ""); } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Unable to load settings."); } finally { setIsLoading(false); } }, []);
  useEffect(() => { void load(); }, [load]);
  async function save(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setIsSaving(true); try { const result = await apiFetch<WorkspaceSettings>("/dashboard/settings", { method: "PATCH", body: JSON.stringify({ organizationName: name }) }); setSettings(result); setError(null); } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Unable to save settings."); } finally { setIsSaving(false); } }
  async function openPortal() { try { const session = await apiFetch<{ url: string }>("/billing/portal-session", { method: "POST", body: JSON.stringify({}) }); window.location.assign(session.url); } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Unable to open billing portal."); } }
  return <div className="space-y-6"><div><h1 className="text-3xl font-semibold tracking-tight">Settings</h1><p className="mt-2 text-sm text-onboarding-neutral-600 dark:text-onboarding-neutral-400">Update workspace details and access subscription management.</p></div>{error ? <ErrorNotice message={error} /> : null}{isLoading ? <PageCard><LoadingState /></PageCard> : settings ? <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]"><PageCard className="p-5 sm:p-6"><h2 className="font-semibold">Organization</h2><form onSubmit={save} className="mt-5 max-w-xl space-y-4"><label className="grid gap-2 text-sm font-medium">Workspace name<Input value={name} onChange={(event) => setName(event.target.value)} required /></label><Button type="submit" variant="brand" disabled={isSaving}>{isSaving ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} Save changes</Button></form></PageCard><PageCard className="p-5"><h2 className="font-semibold">Plan and billing</h2><dl className="mt-4 space-y-3 text-sm"><div><dt className="text-onboarding-neutral-500 dark:text-onboarding-neutral-400">Plan</dt><dd className="mt-1 font-medium">{titleCase(settings.organization?.plan ?? "starter")}</dd></div><div><dt className="text-onboarding-neutral-500 dark:text-onboarding-neutral-400">Subscription</dt><dd className="mt-1 font-medium">{titleCase(settings.organization?.subscriptionStatus ?? "not active")}</dd></div></dl>{settings.organization?.hasBillingPortal ? <Button variant="secondary" className="mt-5 w-full" onClick={() => void openPortal()}><CreditCard /> Manage billing</Button> : null}</PageCard></div> : null}</div>;
}

function ErrorNotice({ message }: { message: string }) { return <div className="flex items-start gap-3 rounded-onboarding border border-onboarding-error-500/30 bg-onboarding-error-50 p-4 text-sm text-onboarding-error-900 dark:bg-onboarding-error-900 dark:text-onboarding-error-50" role="alert"><CircleAlert className="mt-0.5 size-4 shrink-0" /><p>{message}</p></div>; }
function LoadingState() { return <div className="flex min-h-44 items-center justify-center text-sm text-onboarding-neutral-600 dark:text-onboarding-neutral-400"><Loader2 className="mr-2 size-4 animate-spin" />Loading workspace data</div>; }

export function DashboardPageFrame({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-[100rem] px-5 py-6 sm:px-6 lg:px-4 xl:px-5">{children}</div>;
}
