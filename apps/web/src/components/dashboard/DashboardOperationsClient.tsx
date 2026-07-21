"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  Bell,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  CreditCard,
  Link2,
  Loader2,
  Mail,
  Megaphone,
  MessageSquare,
  Moon,
  Plus,
  RefreshCw,
  Search,
  Settings,
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

export const DASHBOARD_WORKSPACE_VIEWS = [
  "campaigns",
  "prospects",
  "messages",
  "channels",
  "analytics",
  "settings",
] as const;

export type DashboardWorkspaceView = (typeof DASHBOARD_WORKSPACE_VIEWS)[number];

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

type SocialAccount = {
  platform: string;
  accountName: string;
  avatarUrl: string | null;
  status: string;
};

type WorkspaceMessage = {
  id: string;
  channel: string;
  content: string;
  direction: string;
  status: string;
  stepIndex: number;
  occurredAt: string;
  lead: { name: string; company: string };
  campaign: { id: string; name: string };
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

const NAV_ITEMS: Array<{
  value: DashboardWorkspaceView;
  label: string;
  icon: typeof Megaphone;
}> = [
  { value: "campaigns", label: "Campaigns", icon: Megaphone },
  { value: "prospects", label: "Prospects", icon: Users },
  { value: "messages", label: "Messages", icon: MessageSquare },
  { value: "channels", label: "Channels", icon: Link2 },
  { value: "analytics", label: "Analytics", icon: BarChart3 },
  { value: "settings", label: "Settings", icon: Settings },
];

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

function ChannelMark({ platform }: { platform: string }) {
  if (platform === "linkedin" || platform === "whatsapp") {
    return (
      <span
        className={cn(
          "inline-flex size-9 shrink-0 items-center justify-center rounded-[0.35rem] text-white",
          platform === "linkedin" ? "bg-[#0A66C2]" : "bg-[#25D366]",
        )}
      >
        <ChannelLogo name={platform} className="size-5" />
      </span>
    );
  }

  return <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-[0.35rem] bg-onboarding-purple-100 text-onboarding-purple-600 dark:bg-onboarding-purple-900 dark:text-onboarding-purple-100"><Link2 className="size-4" /></span>;
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

function WorkspaceHeader({
  activeView,
  memberName,
  onToggleTheme,
  isDark,
}: {
  activeView: DashboardWorkspaceView;
  memberName: string;
  onToggleTheme: (element: HTMLElement) => void;
  isDark: boolean;
}) {
  const router = useRouter();

  return (
    <>
      <aside className="hidden h-full w-[17.5rem] shrink-0 border-r border-onboarding-neutral-150 bg-onboarding-neutral-0 px-5 py-7 dark:border-onboarding-neutral-750 dark:bg-onboarding-neutral-900 lg:flex lg:flex-col">
        <OnboardingLogo className="h-8 w-auto" />
        <p className="mt-1 pl-9 text-[10px] font-medium tracking-[0.14em] text-onboarding-neutral-400 uppercase dark:text-onboarding-neutral-500">AI customer acquisition</p>
        <nav className="mt-11 space-y-1.5" aria-label="Workspace navigation">
          <Link href="/home" className="flex h-11 items-center gap-3 rounded-onboarding px-3.5 text-sm text-onboarding-neutral-500 transition-colors hover:bg-onboarding-neutral-100 dark:text-onboarding-neutral-400 dark:hover:bg-onboarding-neutral-800">
            <BarChart3 className="size-4" aria-hidden />
            Overview
          </Link>
          {NAV_ITEMS.map(({ value, label, icon: Icon }) => {
            const active = value === activeView;
            return (
              <Link
                key={value}
                href={`/home?view=${value}`}
                className={cn(
                  "flex h-11 items-center gap-3 rounded-onboarding px-3.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-onboarding-purple-300",
                  active
                    ? "bg-onboarding-purple-50 font-semibold text-onboarding-purple-600 dark:bg-onboarding-purple-900 dark:text-onboarding-purple-100"
                    : "text-onboarding-neutral-500 hover:bg-onboarding-neutral-100 dark:text-onboarding-neutral-400 dark:hover:bg-onboarding-neutral-800",
                )}
                aria-current={active ? "page" : undefined}
              >
                <Icon className="size-4" aria-hidden />
                {label}
              </Link>
            );
          })}
        </nav>
        <button type="button" onClick={() => router.push("/home?view=settings")} className="mt-auto flex w-full items-center gap-3 rounded-onboarding px-2 py-2 text-left text-sm transition-colors hover:bg-onboarding-neutral-100 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-onboarding-purple-300 dark:hover:bg-onboarding-neutral-800">
          <span className="inline-flex size-8 items-center justify-center rounded-full bg-onboarding-neutral-150 font-semibold text-onboarding-purple-600 dark:bg-onboarding-neutral-750 dark:text-onboarding-purple-200">{memberName.slice(0, 1).toUpperCase()}</span>
          <span className="min-w-0 flex-1 truncate font-medium">{memberName}</span>
          <ChevronDown className="size-4 text-onboarding-neutral-400" aria-hidden />
        </button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-[4.75rem] shrink-0 items-center justify-between border-b border-onboarding-neutral-150 bg-onboarding-neutral-0 px-5 dark:border-onboarding-neutral-750 dark:bg-onboarding-neutral-900 sm:px-8 lg:px-10">
          <div className="flex items-center gap-3 lg:hidden">
            <OnboardingLogo className="h-6 w-auto" />
            <span className="text-xs text-onboarding-neutral-500 dark:text-onboarding-neutral-400">{titleCase(activeView)}</span>
          </div>
          <div className="hidden max-w-[29rem] flex-1 lg:block">
            <div className="flex h-10 items-center gap-2.5 rounded-onboarding border border-onboarding-neutral-150 bg-onboarding-neutral-50 px-3.5 text-sm text-onboarding-neutral-400 dark:border-onboarding-neutral-750 dark:bg-onboarding-neutral-850 dark:text-onboarding-neutral-500">
              <Search className="size-4" aria-hidden />
              Search coming soon
              <span className="ml-auto rounded border border-onboarding-neutral-200 px-1.5 py-0.5 text-[10px] font-medium dark:border-onboarding-neutral-700">⌘ K</span>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            <button type="button" onClick={(event) => onToggleTheme(event.currentTarget)} className="inline-flex size-10 items-center justify-center rounded-onboarding text-onboarding-neutral-600 transition-colors hover:bg-onboarding-neutral-100 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-onboarding-purple-300 dark:text-onboarding-neutral-300 dark:hover:bg-onboarding-neutral-800" aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}>
              {isDark ? <Sun className="size-[1.1rem]" aria-hidden /> : <Moon className="size-[1.1rem]" aria-hidden />}
            </button>
            <span className="hidden size-10 items-center justify-center text-onboarding-neutral-400 sm:inline-flex" aria-label="Notifications coming soon"><Bell className="size-4" aria-hidden /></span>
          </div>
        </header>
      </div>
    </>
  );
}

function CampaignsView() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [name, setName] = useState("");
  const [invite, setInvite] = useState("");
  const [firstMessage, setFirstMessage] = useState("");
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
          <label className="grid gap-2 text-sm font-medium">Connection note<Input required value={invite} onChange={(event) => setInvite(event.target.value)} placeholder="A short invitation note" /></label>
          <label className="grid gap-2 text-sm font-medium lg:col-span-2">First message<textarea required value={firstMessage} onChange={(event) => setFirstMessage(event.target.value)} className="min-h-28 w-full rounded-onboarding border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30" placeholder="The message sent after a prospect accepts the connection." /></label>
          <div className="flex flex-wrap items-center justify-between gap-3 lg:col-span-2"><p className="text-xs text-onboarding-neutral-500 dark:text-onboarding-neutral-400">{activeLinkedIn ? "LinkedIn is connected and ready for campaign setup." : "An active LinkedIn account is required to create this campaign."}</p><Button type="submit" variant="brand" disabled={isCreating || !activeLinkedIn}>{isCreating ? <Loader2 className="animate-spin" /> : <Plus />} Create draft</Button></div>
        </form>
      </PageCard>
      <PageCard className="overflow-hidden">
        <div className="border-b border-onboarding-neutral-150 px-5 py-4 dark:border-onboarding-neutral-750"><h2 className="font-semibold">Your campaigns</h2></div>
        {isLoading ? <LoadingState /> : campaigns.length === 0 ? <EmptyState title="No campaigns yet" detail="Create a draft using reviewed copy, then add prospects before launching." /> : <ul className="divide-y divide-onboarding-neutral-150 dark:divide-onboarding-neutral-750">{campaigns.map((campaign) => <li key={campaign.id} className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold">{campaign.name}</p><p className="mt-1 text-sm text-onboarding-neutral-600 dark:text-onboarding-neutral-400">{campaign.channels.map(channelName).join(", ")} · Updated {relativeTime(campaign.updatedAt)}</p></div><div className="flex items-center gap-3"><span className="text-xs font-semibold text-onboarding-neutral-500 dark:text-onboarding-neutral-400">{titleCase(campaign.status)}</span>{["draft", "review"].includes(campaign.status) ? <Button variant="brand" size="sm" onClick={() => void launchCampaign(campaign.id)}>Launch</Button> : null}</div></li>)}</ul>}
      </PageCard>
    </div>
  );
}

function ProspectsView() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [campaignId, setCampaignId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [leadResponse, campaignResponse] = await Promise.all([apiFetch<{ leads: Lead[] }>("/leads?limit=100"), apiFetch<{ campaigns: Campaign[] }>("/campaigns")]);
      setLeads(leadResponse.leads);
      setCampaigns(campaignResponse.campaigns);
      setError(null);
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Unable to load prospects."); }
    finally { setIsLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function updateStatus(leadId: string, status: string) {
    try { await apiFetch(`/leads/${leadId}`, { method: "PATCH", body: JSON.stringify({ status }) }); await load(); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Unable to update prospect."); }
  }
  async function enrollSelected() {
    if (!campaignId || selected.size === 0) return;
    try { await apiFetch(`/campaigns/${campaignId}/leads`, { method: "POST", body: JSON.stringify({ leadIds: [...selected] }) }); setSelected(new Set()); await load(); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Unable to add prospects to campaign."); }
  }

  return <div className="space-y-6"><div><h1 className="text-3xl font-semibold tracking-tight">Prospects</h1><p className="mt-2 text-sm text-onboarding-neutral-600 dark:text-onboarding-neutral-400">Review imported prospects, maintain their lifecycle status, and add selected people to a campaign.</p></div>{error ? <ErrorNotice message={error} /> : null}<PageCard className="overflow-hidden"><div className="flex flex-col gap-3 border-b border-onboarding-neutral-150 px-5 py-4 dark:border-onboarding-neutral-750 sm:flex-row sm:items-center sm:justify-between"><h2 className="font-semibold">Prospect list</h2><div className="flex gap-2"><select value={campaignId} onChange={(event) => setCampaignId(event.target.value)} className="h-8 max-w-52 rounded-lg border border-input bg-transparent px-2 text-sm dark:bg-input/30"><option value="">Select a campaign</option>{campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}</select><Button size="sm" variant="brand" onClick={() => void enrollSelected()} disabled={!campaignId || selected.size === 0}>Add {selected.size || ""} selected</Button></div></div>{isLoading ? <LoadingState /> : leads.length === 0 ? <EmptyState title="No prospects imported" detail="Prospects will appear here once you import a list or run a lead search." /> : <div className="overflow-x-auto"><table className="w-full min-w-[48rem] text-left text-sm"><thead className="bg-onboarding-neutral-50 text-xs text-onboarding-neutral-500 dark:bg-onboarding-neutral-850 dark:text-onboarding-neutral-400"><tr><th className="w-12 px-5 py-3"><span className="sr-only">Select</span></th><th className="px-3 py-3 font-medium">Prospect</th><th className="px-3 py-3 font-medium">Company</th><th className="px-3 py-3 font-medium">Status</th><th className="px-5 py-3 font-medium">Source</th></tr></thead><tbody className="divide-y divide-onboarding-neutral-150 dark:divide-onboarding-neutral-750">{leads.map((lead) => <tr key={lead.id}><td className="px-5 py-3"><input type="checkbox" checked={selected.has(lead.id)} onChange={(event) => setSelected((current) => { const next = new Set(current); if (event.target.checked) next.add(lead.id); else next.delete(lead.id); return next; })} aria-label={`Select ${lead.firstName} ${lead.lastName}`} /></td><td className="px-3 py-3"><p className="font-medium">{lead.firstName} {lead.lastName}</p><p className="mt-0.5 text-xs text-onboarding-neutral-500 dark:text-onboarding-neutral-400">{lead.title}</p></td><td className="px-3 py-3 text-onboarding-neutral-600 dark:text-onboarding-neutral-400">{lead.company}</td><td className="px-3 py-3"><select value={lead.status} onChange={(event) => void updateStatus(lead.id, event.target.value)} className="h-8 rounded-lg border border-input bg-transparent px-2 text-xs dark:bg-input/30">{LEAD_STATUSES.map((status) => <option key={status} value={status}>{titleCase(status)}</option>)}</select></td><td className="px-5 py-3 text-onboarding-neutral-500 dark:text-onboarding-neutral-400">Imported</td></tr>)}</tbody></table></div>}</PageCard></div>;
}

function MessagesView() {
  const [messages, setMessages] = useState<WorkspaceMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { let cancelled = false; void apiFetch<{ messages: WorkspaceMessage[] }>("/dashboard/messages").then((result) => { if (!cancelled) setMessages(result.messages); }).catch((requestError) => { if (!cancelled) setError(requestError instanceof Error ? requestError.message : "Unable to load messages."); }).finally(() => { if (!cancelled) setIsLoading(false); }); return () => { cancelled = true; }; }, []);
  return <div className="space-y-6"><div><h1 className="text-3xl font-semibold tracking-tight">Messages</h1><p className="mt-2 text-sm text-onboarding-neutral-600 dark:text-onboarding-neutral-400">A read-only record of persisted outbound delivery and inbound replies. Reply composition will be added with channel-specific safeguards.</p></div>{error ? <ErrorNotice message={error} /> : null}<PageCard className="overflow-hidden">{isLoading ? <LoadingState /> : messages.length === 0 ? <EmptyState title="No messages yet" detail="Outbound delivery and inbound replies will appear here after a campaign begins." /> : <ul className="divide-y divide-onboarding-neutral-150 dark:divide-onboarding-neutral-750">{messages.map((message) => <li key={message.id} className="flex gap-4 px-5 py-4"><span className={cn("mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full", message.direction === "inbound" ? "bg-onboarding-success-50 text-onboarding-success-500" : "bg-onboarding-purple-50 text-onboarding-purple-600 dark:bg-onboarding-purple-900 dark:text-onboarding-purple-100")}>{message.direction === "inbound" ? <MessageSquare className="size-4" /> : <Mail className="size-4" />}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-baseline justify-between gap-2"><p className="font-semibold">{message.direction === "inbound" ? "Reply from" : "Outreach to"} {message.lead.name}</p><time className="text-xs text-onboarding-neutral-500 dark:text-onboarding-neutral-400">{relativeTime(message.occurredAt)}</time></div><p className="mt-1 line-clamp-2 text-sm text-onboarding-neutral-600 dark:text-onboarding-neutral-400">{message.content}</p><p className="mt-2 text-xs text-onboarding-neutral-500 dark:text-onboarding-neutral-400">{channelName(message.channel)} · {message.campaign.name} · {titleCase(message.status)}</p></div></li>)}</ul>}</PageCard></div>;
}

function ChannelsView() {
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

function AnalyticsView() {
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

function SettingsView() {
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

export function DashboardOperationsClient({ memberName, activeView }: { memberName: string; activeView: DashboardWorkspaceView }) {
  const { isDark, toggle } = useThemeMode();
  const content = useMemo(() => {
    if (activeView === "campaigns") return <CampaignsView />;
    if (activeView === "prospects") return <ProspectsView />;
    if (activeView === "messages") return <MessagesView />;
    if (activeView === "channels") return <ChannelsView />;
    if (activeView === "analytics") return <AnalyticsView />;
    return <SettingsView />;
  }, [activeView]);
  return <div className="h-dvh overflow-hidden bg-onboarding-neutral-0 text-onboarding-ink dark:bg-onboarding-neutral-950 dark:text-onboarding-neutral-0"><div className="relative flex h-full w-full"><WorkspaceHeader activeView={activeView} memberName={memberName} isDark={isDark} onToggleTheme={toggle} /><main className="absolute inset-y-0 left-0 right-0 top-[4.75rem] min-h-0 overflow-y-auto overscroll-contain lg:left-[17.5rem]"><div className="mx-auto w-full max-w-[94rem] px-5 py-6 sm:px-8 lg:px-10 xl:px-12">{content}</div></main></div></div>;
}
