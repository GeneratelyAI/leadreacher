"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Filter,
  Mail,
  MessageCircle,
  MoreHorizontal,
  Search,
  Upload,
  Users,
  X,
  Clock3,
} from "lucide-react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { TruncatedWithTooltip } from "@/components/dashboard/dashboard-menu";
import { ImportProspectsModal } from "@/components/dashboard/ImportProspectsModal";
import { ScrapeProspectsModal } from "@/components/dashboard/ScrapeProspectsModal";
import { ChannelLogo } from "@/components/onboarding/ChannelLogo";
import { SelectionToolbar, SelectionToolbarAction } from "@/components/patterns/SelectionToolbar";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/badge";
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiFetch } from "@/lib/api";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { cn } from "@/lib/utils";

type ReviewStatus = "all" | "pending" | "approved" | "excluded" | "booked";
type LeadReviewStatus = Exclude<ReviewStatus, "all" | "booked">;
type LinkedInRelationship = "connected" | "invite_required" | "unresolved" | "unknown";

type Campaign = {
  id: string;
  name: string;
  status: string;
  channels: string[];
  createdAt: string;
  updatedAt: string;
};

type Prospect = {
  id: string;
  firstName: string;
  lastName: string;
  title: string;
  company: string;
  location: string | null;
  linkedinUrl: string | null;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  source: string;
  status: string;
  reviewStatus: LeadReviewStatus;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string;
  campaigns: Array<{
    id: string;
    name: string;
    status: string;
    campaignLeadId: string;
    campaignLeadStatus: string;
    linkedinRelationship: LinkedInRelationship;
    relationshipCheckedAt: string | null;
  }>;
};

type ProspectDetail = Omit<Prospect, "campaigns"> & {
  industry: string | null;
  companySize: string | null;
  tags: string[];
  notes: unknown[];
  messages: Array<{
    id: string;
    direction: string;
    origin: string;
    status: string;
    content: { message: string };
    occurredAt: string;
  }>;
  videoAssets: Array<{
    id: string;
    status: string;
    videoUrl: string | null;
    thumbnailUrl: string | null;
    updatedAt: string;
  }>;
  campaigns: Array<{
    id: string;
    status: string;
    currentStep: number;
    linkedinChatId: string | null;
    createdAt: string;
    campaign: { id: string; name: string; status: string };
  }>;
};

type ProspectListResponse = {
  leads: Prospect[];
  total: number;
  counts: {
    all: number;
    pending: number;
    approved: number;
    excluded: number;
    booked: number;
    reached: number;
  };
  limit: number;
  offset: number;
};

const PAGE_SIZE = 10;
const lifecycleStates = ["new", "contacted", "connected", "replied", "meeting", "converted", "lost", "skipped"];
const sourceOptions = [
  { value: "apify", label: "LinkedIn search" },
  { value: "csv", label: "CSV import" },
  { value: "manual", label: "Manual" },
];

function titleCase(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function lifecycleLabel(value: string): string {
  return value === "meeting" ? "Booked" : titleCase(value);
}

function relativeTime(value: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function initials(name: string): string {
  return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "?";
}

function ProspectAvatar({ name, url, size = "default" }: { name: string; url: string | null; size?: "default" | "large" }) {
  const className = size === "large" ? "size-14 text-base" : "size-9 text-xs";
  return url ? <img src={url} alt="" className={cn("shrink-0 rounded-full object-cover", className)} /> : <span aria-hidden className={cn("inline-flex shrink-0 items-center justify-center rounded-full bg-onboarding-purple-100 font-semibold text-onboarding-purple-700 dark:bg-onboarding-purple-900 dark:text-onboarding-purple-100", className)}>{initials(name)}</span>;
}

function ReachableSignals({ prospect }: { prospect: Prospect }) {
  return (
    <div className="flex items-center gap-1.5" aria-label="Available contact channels">
      {prospect.linkedinUrl ? <span className="inline-flex size-7 items-center justify-center" title="LinkedIn available"><ChannelLogo name="linkedin" className="size-7" /></span> : null}
      {prospect.email ? <span className="inline-flex size-7 items-center justify-center text-onboarding-success-500" title="Email available"><Mail className="size-4" /></span> : null}
      {prospect.phone ? <span className="inline-flex size-7 items-center justify-center text-onboarding-success-500" title="Phone available"><CheckCircle2 className="size-4" /></span> : null}
      {!prospect.linkedinUrl && !prospect.email && !prospect.phone ? <span className="text-xs text-muted-foreground">None</span> : null}
    </div>
  );
}

function ReviewBadge({ status }: { status: LeadReviewStatus }) {
  const styles = {
    pending: "border-onboarding-warning-200 bg-onboarding-warning-50 text-onboarding-warning-900 dark:border-onboarding-warning-500/70 dark:bg-onboarding-warning-900/60 dark:text-onboarding-warning-150",
    approved: "border-onboarding-success-200 bg-onboarding-success-50 text-onboarding-success-700 dark:border-onboarding-success-500/70 dark:bg-onboarding-success-900/60 dark:text-onboarding-neutral-0",
    excluded: "border-onboarding-neutral-200 bg-onboarding-neutral-100 text-onboarding-neutral-600 dark:border-onboarding-neutral-500 dark:bg-onboarding-neutral-700 dark:text-onboarding-neutral-0",
  } as const;
  return <Badge variant="outline" className={cn("font-medium", styles[status])}>{titleCase(status)}</Badge>;
}

function RelationshipBadge({ relationship }: { relationship: LinkedInRelationship }) {
  const labels: Record<LinkedInRelationship, string> = {
    connected: "Direct message",
    invite_required: "Invite first",
    unresolved: "Unresolved",
    unknown: "Not checked",
  };
  return (
    <Badge variant="outline" className="border-transparent bg-muted text-[11px] font-medium text-muted-foreground">
      {labels[relationship]}
    </Badge>
  );
}

function TrendlessMetric({ label, value, detail, tone, icon }: { label: string; value: number; detail: string; tone: "purple" | "yellow" | "green" | "red" | "blue"; icon: ReactNode }) {
  const tones = {
    purple: "text-onboarding-purple-700 dark:text-onboarding-purple-200",
    yellow: "text-onboarding-warning-900 dark:text-[#fff1b6]",
    green: "text-onboarding-success-700 dark:text-[#d9fbe5]",
    red: "text-onboarding-error-700 dark:text-[#ffe4e4]",
    blue: "text-blue-700 dark:text-[#dbeafe]",
  } as const;
  return (
    <Card className="min-w-0">
      <CardContent className="flex items-center gap-3.5 p-3.5 sm:gap-4 sm:p-4">
        <span className={cn("inline-flex shrink-0 [&_svg]:size-5 sm:[&_svg]:size-6", tones[tone])}>{icon}</span>
        <div className="min-w-0">
          <p className="text-xl font-semibold tracking-tight sm:text-2xl">{value.toLocaleString()}</p>
          <p className="truncate text-sm font-medium text-onboarding-ink dark:text-onboarding-neutral-0">{label}</p>
          <p className="mt-0.5 truncate text-xs text-onboarding-neutral-600 dark:text-onboarding-neutral-300">{detail}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function LoadingRows() {
  return <div className="space-y-3 p-5">{Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-12 w-full" />)}</div>;
}

function SelectionActionBar({
  count,
  approvedCount,
  campaigns,
  enrollmentCampaignId,
  isUpdating,
  onApprove,
  onExclude,
  onEnrollmentCampaignChange,
  onEnroll,
  onClear,
}: {
  count: number;
  approvedCount: number;
  campaigns: Campaign[];
  enrollmentCampaignId: string;
  isUpdating: boolean;
  onApprove: () => void;
  onExclude: () => void;
  onEnrollmentCampaignChange: (value: string) => void;
  onEnroll: () => void;
  onClear: () => void;
}) {
  return (
    <SelectionToolbar
      count={count}
      entityName="Prospect"
      ariaLabel="Selected prospect actions"
      onClear={onClear}
      trailing={
        <Button
          size="sm"
          variant="primary"
          className="h-10 shrink-0 px-3 font-medium sm:h-8"
          disabled={isUpdating || !enrollmentCampaignId || approvedCount === 0}
          onClick={onEnroll}
          title={!enrollmentCampaignId ? "Choose a draft or review campaign first" : approvedCount === 0 ? "Approve at least one selected prospect before enrollment" : `${approvedCount} of ${count} selected prospects are eligible`}
        >
          Add {approvedCount} approved
        </Button>
      }
    >
      <SelectionToolbarAction leftIcon={<Check />} disabled={isUpdating} onClick={onApprove}>
        Approve
      </SelectionToolbarAction>
      <SelectionToolbarAction leftIcon={<X />} disabled={isUpdating} onClick={onExclude}>
        Exclude
      </SelectionToolbarAction>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <SelectionToolbarAction aria-label="Campaign for selected prospects" />
          }
        >
          <span className="max-w-40 truncate">
            {campaigns.find((campaign) => campaign.id === enrollmentCampaignId)?.name ?? "Add to campaign"}
          </span>
          <ChevronDown className="size-3.5 opacity-70" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="top" sideOffset={8} className="min-w-56">
          <DropdownMenuItem onClick={() => onEnrollmentCampaignChange("")}>Add to campaign</DropdownMenuItem>
          {campaigns
            .filter((campaign) => ["draft", "review"].includes(campaign.status))
            .map((campaign) => (
              <DropdownMenuItem key={campaign.id} onClick={() => onEnrollmentCampaignChange(campaign.id)}>
                <TruncatedWithTooltip text={campaign.name} />
                {enrollmentCampaignId === campaign.id ? <Check className="ml-auto size-3.5 shrink-0" /> : null}
              </DropdownMenuItem>
            ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </SelectionToolbar>
  );
}

export function ProspectsWorkspace() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectedDetail, setSelectedDetail] = useState<ProspectDetail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query.trim(), 300);
  const [reviewStatus, setReviewStatus] = useState<ReviewStatus>("all");
  const [lifecycle, setLifecycle] = useState("");
  const [source, setSource] = useState("");
  const [campaignFilter, setCampaignFilter] = useState(() => searchParams.get("campaignId") ?? "");
  const [relationshipFilter, setRelationshipFilter] = useState<LinkedInRelationship | "">(() => {
    const value = searchParams.get("relationship");
    return ["connected", "invite_required", "unresolved", "unknown"].includes(value ?? "")
      ? value as LinkedInRelationship
      : "";
  });
  const [enrollmentCampaignId, setEnrollmentCampaignId] = useState(
    () => searchParams.get("enrollCampaignId") ?? "",
  );
  const [isUpdating, setIsUpdating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [scrapeOpen, setScrapeOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const prospectParams = useMemo(() => {
    const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String((page - 1) * PAGE_SIZE) });
    if (debouncedQuery) params.set("query", debouncedQuery);
    if (reviewStatus === "booked") {
      params.set("status", "meeting");
    } else {
      if (reviewStatus !== "all") params.set("reviewStatus", reviewStatus);
      if (lifecycle) params.set("status", lifecycle);
    }
    if (source) params.set("source", source);
    if (campaignFilter) params.set("campaignId", campaignFilter);
    if (campaignFilter && relationshipFilter) params.set("linkedinRelationship", relationshipFilter);
    return params.toString();
  }, [campaignFilter, debouncedQuery, lifecycle, page, relationshipFilter, reviewStatus, source]);
  const prospectsQuery = useQuery({
    queryKey: ["dashboard", "prospects", prospectParams],
    queryFn: () => apiFetch<ProspectListResponse>(`/dashboard/prospects?${prospectParams}`),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
  const campaignsQuery = useQuery({
    queryKey: ["campaigns", "options"],
    queryFn: () => apiFetch<{ campaigns: Campaign[] }>("/campaigns"),
    staleTime: 60_000,
  });
  const leads = prospectsQuery.data?.leads ?? [];
  const campaigns = campaignsQuery.data?.campaigns ?? [];
  const counts = prospectsQuery.data?.counts ?? { all: 0, pending: 0, approved: 0, excluded: 0, booked: 0, reached: 0 };
  const total = prospectsQuery.data?.total ?? 0;
  const isLoading = prospectsQuery.isLoading && !prospectsQuery.data;
  const isRefreshing = prospectsQuery.isFetching && !!prospectsQuery.data;
  const error = actionError ?? (prospectsQuery.error instanceof Error ? prospectsQuery.error.message : campaignsQuery.error instanceof Error ? campaignsQuery.error.message : null);
  const load = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["dashboard", "prospects"] }),
      queryClient.invalidateQueries({ queryKey: ["campaigns", "options"] }),
    ]);
  };

  useEffect(() => { setPage(1); setSelected(new Set()); }, [campaignFilter, debouncedQuery, lifecycle, relationshipFilter, reviewStatus, source]);

  useEffect(() => {
    if (!campaignFilter) setRelationshipFilter("");
  }, [campaignFilter]);

  async function openDetail(id: string) {
    try {
      const response = await apiFetch<{ lead: ProspectDetail }>(`/dashboard/prospects/${id}`);
      setSelectedDetail(response.lead);
      setDetailOpen(true);
    } catch (requestError) {
      setActionError(requestError instanceof Error ? requestError.message : "Unable to load prospect details.");
    }
  }

  async function updateReview(leadIds: string[], nextStatus: "approved" | "excluded") {
    if (isUpdating) return;
    setIsUpdating(true);
    try {
      if (leadIds.length === 1) {
        await apiFetch(`/dashboard/prospects/${leadIds[0]}/review`, { method: "PATCH", body: JSON.stringify({ reviewStatus: nextStatus }) });
      } else {
        await apiFetch("/dashboard/prospects/review", { method: "POST", body: JSON.stringify({ leadIds, reviewStatus: nextStatus }) });
      }
      if (selectedDetail && leadIds.includes(selectedDetail.id)) setSelectedDetail({ ...selectedDetail, reviewStatus: nextStatus });
      setSelected(new Set());
      await load();
    } catch (requestError) {
      setActionError(requestError instanceof Error ? requestError.message : "Unable to update prospect review.");
    } finally {
      setIsUpdating(false);
    }
  }

  async function enrollSelected() {
    const approvedIds = [...selected].filter((id) => leads.find((lead) => lead.id === id)?.reviewStatus === "approved");
    if (!enrollmentCampaignId || approvedIds.length === 0) return;
    try {
      await apiFetch(`/campaigns/${enrollmentCampaignId}/leads`, { method: "POST", body: JSON.stringify({ leadIds: approvedIds }) });
      setSelected(new Set());
      await load();
    } catch (requestError) {
      setActionError(requestError instanceof Error ? requestError.message : "Unable to add prospects to campaign.");
    }
  }

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const approvedSelectedCount = useMemo(() => [...selected].filter((id) => leads.find((lead) => lead.id === id)?.reviewStatus === "approved").length, [leads, selected]);
  const visibleIds = leads.map((lead) => lead.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
  const clearFilters = () => { setQuery(""); setReviewStatus("all"); setLifecycle(""); setSource(""); setCampaignFilter(""); setRelationshipFilter(""); };
  const activeFilterCount = [lifecycle, source, campaignFilter, relationshipFilter].filter(Boolean).length;

  const filterControls = (
    <>
      <Select value={lifecycle || null} onValueChange={(value) => setLifecycle(value === "__all" ? "" : value ?? "")}>
        <SelectTrigger className="min-w-40 h-10 sm:h-9"><SelectValue placeholder="All lifecycle states" /></SelectTrigger>
        <SelectContent><SelectItem value="__all">All lifecycle states</SelectItem>{lifecycleStates.map((state) => <SelectItem key={state} value={state}>{lifecycleLabel(state)}</SelectItem>)}</SelectContent>
      </Select>
      <Select value={source || null} onValueChange={(value) => setSource(value === "__all" ? "" : value ?? "")}>
        <SelectTrigger className="min-w-32 h-10 sm:h-9"><SelectValue placeholder="All sources" /></SelectTrigger>
        <SelectContent><SelectItem value="__all">All sources</SelectItem>{sourceOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
      </Select>
      <Select value={campaignFilter || null} onValueChange={(value) => setCampaignFilter(value === "__all" ? "" : value ?? "")}>
        <SelectTrigger className="min-w-36 h-10 sm:h-9"><SelectValue placeholder="All campaigns" /></SelectTrigger>
        <SelectContent><SelectItem value="__all">All campaigns</SelectItem>{campaigns.map((campaign) => <SelectItem key={campaign.id} value={campaign.id}>{campaign.name}</SelectItem>)}</SelectContent>
      </Select>
      {campaignFilter ? (
        <Select
          value={relationshipFilter || null}
          onValueChange={(value) => {
            const nextValue = value as string | null;
            setRelationshipFilter(nextValue === "__all" || nextValue === null ? "" : nextValue as LinkedInRelationship);
          }}
        >
          <SelectTrigger className="min-w-36 h-10 sm:h-9"><SelectValue placeholder="All relationship routes" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">All relationship routes</SelectItem>
            <SelectItem value="connected">Direct message</SelectItem>
            <SelectItem value="invite_required">Invite first</SelectItem>
            <SelectItem value="unresolved">Unresolved</SelectItem>
            <SelectItem value="unknown">Not checked</SelectItem>
          </SelectContent>
        </Select>
      ) : null}
    </>
  );

  const messageMembership = selectedDetail?.campaigns.find(
    (membership) => membership.status === "active",
  ) ?? null;

  return (
    <div className={cn("space-y-4", selected.size > 0 && "pb-36 sm:pb-32")}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-3xl font-semibold tracking-tight">Prospects</h1>
          <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">Review real people before enrollment. Approval and exclusion are reversible and do not alter existing campaign delivery.</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button variant="secondary" className="min-h-10" onClick={() => setImportOpen(true)}>
            <Upload /> Import CSV
          </Button>
          <Button variant="brand" className="min-h-10" onClick={() => setScrapeOpen(true)}>
            <Search /> Find prospects
          </Button>
        </div>
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-5">
        <TrendlessMetric label="Total prospects" value={counts.all} detail="All imported prospects" tone="purple" icon={<Users strokeWidth={1.75} />} />
        <TrendlessMetric label="Pending review" value={counts.pending} detail="Awaiting a decision" tone="yellow" icon={<Clock3 strokeWidth={1.75} />} />
        <TrendlessMetric label="Approved" value={counts.approved} detail="Eligible for enrollment" tone="green" icon={<Check strokeWidth={1.75} />} />
        <TrendlessMetric label="Excluded" value={counts.excluded} detail="Reversible exclusions" tone="red" icon={<X strokeWidth={1.75} />} />
        <TrendlessMetric label="Total reached" value={counts.reached} detail="Distinct prospects with outreach" tone="blue" icon={<Mail strokeWidth={1.75} />} />
      </div>

      {error ? <div role="alert" className="rounded-lg border border-onboarding-error-200 bg-onboarding-error-50 px-4 py-3 text-sm text-onboarding-error-700 dark:border-onboarding-error-500/40 dark:bg-onboarding-error-500/15 dark:text-onboarding-error-100">{error}</div> : null}

      {enrollmentCampaignId ? (
        <div className="rounded-lg border border-onboarding-purple-200 bg-onboarding-purple-50 px-4 py-3 text-sm text-onboarding-purple-900 dark:border-onboarding-purple-400/30 dark:bg-onboarding-purple-500/15 dark:text-onboarding-purple-100">
          Enrolling into{" "}
          <span className="font-semibold">
            {campaigns.find((campaign) => campaign.id === enrollmentCampaignId)?.name ?? "selected campaign"}
          </span>
          . Approve prospects, select rows, then use Add to campaign.
        </div>
      ) : null}

      <Card className="overflow-hidden">
        <div className="space-y-3 border-b border-border px-4 pt-4 pb-3">
          <div className="flex flex-col gap-2.5 xl:flex-row xl:items-center">
            <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-lg border border-input bg-onboarding-neutral-0 px-3 dark:bg-onboarding-neutral-900 sm:h-9">
              <Search className="size-4 shrink-0 text-muted-foreground" />
              <span className="sr-only">Search prospects</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm outline-none" placeholder="Search by name, company, title or keyword..." />
            </label>
            <div className="hidden flex-wrap gap-2 lg:flex">
              {filterControls}
              <Button variant="secondary" size="sm" className="h-9" onClick={clearFilters}><Filter /> Clear</Button>
            </div>
            <Button
              variant="secondary"
              className="h-10 lg:hidden"
              onClick={() => setFiltersOpen(true)}
            >
              <Filter /> Filters{activeFilterCount ? ` (${activeFilterCount})` : ""}
            </Button>
            {isRefreshing ? <span className="text-xs text-muted-foreground" aria-live="polite">Updating…</span> : null}
          </div>
          <Tabs value={reviewStatus} onValueChange={(value) => setReviewStatus(value as ReviewStatus)}>
            <TabsList variant="line" className="w-full flex-wrap justify-start gap-1 rounded-none p-0">
              <TabsTrigger value="all" className="flex-none px-3 py-2.5 min-h-10 sm:min-h-0 sm:py-2">All <span className="text-xs text-muted-foreground">{counts.all}</span></TabsTrigger>
              <TabsTrigger value="pending" className="flex-none px-3 py-2.5 min-h-10 sm:min-h-0 sm:py-2">Pending <span className="text-xs text-muted-foreground">{counts.pending}</span></TabsTrigger>
              <TabsTrigger value="approved" className="flex-none px-3 py-2.5 min-h-10 sm:min-h-0 sm:py-2">Approved <span className="text-xs text-muted-foreground">{counts.approved}</span></TabsTrigger>
              <TabsTrigger value="excluded" className="flex-none px-3 py-2.5 min-h-10 sm:min-h-0 sm:py-2">Excluded <span className="text-xs text-muted-foreground">{counts.excluded}</span></TabsTrigger>
              <TabsTrigger value="booked" className="flex-none px-3 py-2.5 min-h-10 sm:min-h-0 sm:py-2">Booked <span className="text-xs text-muted-foreground">{counts.booked}</span></TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {isLoading ? <LoadingRows /> : leads.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <Users className="mx-auto size-8 text-muted-foreground" />
            <h2 className="mt-3 font-semibold">No prospects match these filters</h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{debouncedQuery || reviewStatus !== "all" || activeFilterCount ? "No prospects match the current search and filters." : "Import a CSV or run an ICP search to begin reviewing prospects."}</p>
            {debouncedQuery || reviewStatus !== "all" || activeFilterCount ? <Button variant="secondary" className="mt-4" onClick={clearFilters}>Clear filters</Button> : null}
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <Button variant="secondary" onClick={() => setImportOpen(true)}><Upload /> Import CSV</Button>
              <Button variant="brand" onClick={() => setScrapeOpen(true)}><Search /> Find prospects</Button>
            </div>
          </div>
        ) : (
          <>
            <ul className="divide-y divide-border lg:hidden">
              {leads.map((lead) => {
                const name = `${lead.firstName} ${lead.lastName}`.trim();
                return (
                  <li key={lead.id}>
                    <div className="flex items-start gap-3 px-4 py-3.5">
                      <div className="pt-1" onClick={(event) => event.stopPropagation()}>
                        <Checkbox
                          checked={selected.has(lead.id)}
                          onCheckedChange={(checked) => setSelected((current) => {
                            const next = new Set(current);
                            if (checked) next.add(lead.id);
                            else next.delete(lead.id);
                            return next;
                          })}
                          aria-label={`Select ${name}`}
                          className="size-5"
                        />
                      </div>
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left"
                        onClick={() => void openDetail(lead.id)}
                      >
                        <div className="flex items-start gap-3">
                          <ProspectAvatar name={name} url={lead.avatarUrl} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <p className="font-semibold">{name}</p>
                              <ReviewBadge status={lead.reviewStatus} />
                            </div>
                            <p className="mt-0.5 truncate text-sm text-muted-foreground">
                              {[lead.title, lead.company].filter(Boolean).join(" · ") || "Details unavailable"}
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <ReachableSignals prospect={lead} />
                              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                                <span className={cn("size-1.5 rounded-full", lead.status === "new" ? "bg-onboarding-neutral-400" : lead.status === "replied" ? "bg-blue-500" : lead.status === "meeting" ? "bg-onboarding-purple-600" : "bg-onboarding-success-500")} />
                                {lifecycleLabel(lead.status)}
                              </span>
                              {campaignFilter ? (
                                <RelationshipBadge
                                  relationship={lead.campaigns.find((campaign) => campaign.id === campaignFilter)?.linkedinRelationship ?? "unknown"}
                                />
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </button>
                      <DropdownMenu>
                        <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="size-10 shrink-0" aria-label={`Actions for ${name}`} />}>
                          <MoreHorizontal />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => void openDetail(lead.id)}>View details</DropdownMenuItem>
                          {lead.reviewStatus !== "approved" ? <DropdownMenuItem onClick={() => void updateReview([lead.id], "approved")}>Approve</DropdownMenuItem> : null}
                          {lead.reviewStatus !== "excluded" ? <DropdownMenuItem onClick={() => void updateReview([lead.id], "excluded")}>Exclude</DropdownMenuItem> : null}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="hidden lg:block">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="w-12">
                      <Checkbox checked={allVisibleSelected} onCheckedChange={(checked) => setSelected(checked ? new Set(visibleIds) : new Set())} aria-label="Select visible prospects" />
                    </TableHead>
                    <TableHead>Prospect</TableHead>
                    <TableHead>Company and location</TableHead>
                    <TableHead>Reachable</TableHead>
                    <TableHead>Review</TableHead>
                    <TableHead>Lifecycle</TableHead>
                    <TableHead>Campaigns</TableHead>
                    <TableHead>Last activity</TableHead>
                    <TableHead className="w-12"><span className="sr-only">Actions</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leads.map((lead) => {
                    const name = `${lead.firstName} ${lead.lastName}`.trim();
                    return (
                      <TableRow key={lead.id} className="cursor-pointer" onClick={() => void openDetail(lead.id)}>
                        <TableCell onClick={(event) => event.stopPropagation()}>
                          <Checkbox
                            checked={selected.has(lead.id)}
                            onCheckedChange={(checked) => setSelected((current) => {
                              const next = new Set(current);
                              if (checked) next.add(lead.id);
                              else next.delete(lead.id);
                              return next;
                            })}
                            aria-label={`Select ${name}`}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <ProspectAvatar name={name} url={lead.avatarUrl} />
                            <div className="min-w-0">
                              <p className="font-semibold">{name}</p>
                              <p className="max-w-40 truncate text-xs text-muted-foreground">{lead.title || "Title unavailable"}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <p>{lead.company || "Company unavailable"}</p>
                          <p className="text-xs text-muted-foreground">{lead.location || "Location unavailable"}</p>
                        </TableCell>
                        <TableCell><ReachableSignals prospect={lead} /></TableCell>
                        <TableCell><ReviewBadge status={lead.reviewStatus} /></TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                            <span className={cn("size-1.5 rounded-full", lead.status === "new" ? "bg-onboarding-neutral-400" : lead.status === "replied" ? "bg-blue-500" : lead.status === "meeting" ? "bg-onboarding-purple-600" : "bg-onboarding-success-500")} />
                            {lifecycleLabel(lead.status)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="max-w-48 truncate text-xs text-primary">
                            {lead.campaigns.length ? lead.campaigns.map((campaign) => campaign.name).join(", ") : "Not enrolled"}
                          </div>
                          {campaignFilter ? (
                            <div className="mt-1">
                              <RelationshipBadge
                                relationship={lead.campaigns.find((campaign) => campaign.id === campaignFilter)?.linkedinRelationship ?? "unknown"}
                              />
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{relativeTime(lead.lastActivityAt)}</TableCell>
                        <TableCell onClick={(event) => event.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label={`Actions for ${name}`} />}>
                              <MoreHorizontal />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => void openDetail(lead.id)}>View details</DropdownMenuItem>
                              {lead.reviewStatus !== "approved" ? <DropdownMenuItem onClick={() => void updateReview([lead.id], "approved")}>Approve</DropdownMenuItem> : null}
                              {lead.reviewStatus !== "excluded" ? <DropdownMenuItem onClick={() => void updateReview([lead.id], "excluded")}>Exclude</DropdownMenuItem> : null}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </>
        )}

        <div className="flex flex-col gap-3 border-t border-border px-4 py-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>Showing {total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1} to {Math.min(page * PAGE_SIZE, total)} of {total.toLocaleString()} prospects</span>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="size-10 sm:size-8" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} aria-label="Previous page"><ChevronLeft /></Button>
            <span className="px-2 text-xs font-medium text-foreground">Page {page} of {pageCount}</span>
            <Button variant="ghost" size="icon" className="size-10 sm:size-8" disabled={page >= pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))} aria-label="Next page"><ChevronRight /></Button>
          </div>
        </div>
      </Card>

      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="bottom" className="gap-4 rounded-t-2xl pb-[max(1rem,var(--safe-area-bottom))] lg:hidden">
          <SheetHeader>
            <SheetTitle>Filters</SheetTitle>
            <SheetDescription>Narrow the prospect list by lifecycle, source, or campaign.</SheetDescription>
          </SheetHeader>
          <div className="grid gap-3 px-1">{filterControls}</div>
          <SheetFooter className="flex-row gap-2">
            <Button variant="outline" className="flex-1" onClick={() => { clearFilters(); setFiltersOpen(false); }}>Clear</Button>
            <Button variant="brand" className="flex-1" onClick={() => setFiltersOpen(false)}>Done</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <SelectionActionBar
        count={selected.size}
        approvedCount={approvedSelectedCount}
        campaigns={campaigns}
        enrollmentCampaignId={enrollmentCampaignId}
        isUpdating={isUpdating}
        onApprove={() => void updateReview([...selected], "approved")}
        onExclude={() => void updateReview([...selected], "excluded")}
        onEnrollmentCampaignChange={setEnrollmentCampaignId}
        onEnroll={() => void enrollSelected()}
        onClear={() => setSelected(new Set())}
      />

      <ImportProspectsModal open={importOpen} onOpenChange={setImportOpen} onImported={load} />
      <ScrapeProspectsModal open={scrapeOpen} onOpenChange={setScrapeOpen} onScraped={load} />

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-2xl overflow-y-auto">
          {selectedDetail ? <><DialogHeader><div className="flex items-center gap-3"><ProspectAvatar size="large" name={`${selectedDetail.firstName} ${selectedDetail.lastName}`} url={selectedDetail.avatarUrl} /><div><DialogTitle>{selectedDetail.firstName} {selectedDetail.lastName}</DialogTitle><DialogDescription>{selectedDetail.title || "Title unavailable"} at {selectedDetail.company || "Company unavailable"}</DialogDescription></div></div></DialogHeader><div className="flex flex-wrap gap-2"><ReviewBadge status={selectedDetail.reviewStatus} />{selectedDetail.linkedinUrl ? <Button variant="secondary" asChild><a href={selectedDetail.linkedinUrl} target="_blank" rel="noreferrer">LinkedIn <ExternalLink /></a></Button> : null}{messageMembership ? <Button variant="brand" asChild><Link href={`/dashboard/messages/${messageMembership.id}`}><MessageCircle /> Message</Link></Button> : null}</div><div className="grid gap-4 rounded-lg border border-border p-4 text-sm sm:grid-cols-2"><div><p className="text-muted-foreground">Location</p><p className="mt-1 font-medium">{selectedDetail.location || "Unavailable"}</p></div><div><p className="text-muted-foreground">Source</p><p className="mt-1 font-medium">{titleCase(selectedDetail.source)}</p></div><div><p className="text-muted-foreground">Email</p><p className="mt-1 break-all font-medium">{selectedDetail.email || "Unavailable"}</p></div><div><p className="text-muted-foreground">Phone</p><p className="mt-1 font-medium">{selectedDetail.phone || "Unavailable"}</p></div></div><section><h3 className="font-semibold">Campaign membership</h3><div className="mt-2 space-y-2">{selectedDetail.campaigns.length ? selectedDetail.campaigns.map((membership) => <div key={membership.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"><span>{membership.campaign.name}</span><span className="text-muted-foreground">{titleCase(membership.status)}</span></div>) : <p className="text-sm text-muted-foreground">Not enrolled in a campaign.</p>}</div></section><section><h3 className="font-semibold">Recent activity</h3><div className="mt-2 space-y-3">{selectedDetail.messages.length ? selectedDetail.messages.map((message) => <div key={message.id} className="border-b border-border pb-3 last:border-0"><div className="flex items-center justify-between gap-3 text-xs text-muted-foreground"><span>{message.direction === "inbound" ? "Inbound reply" : "Outbound message"}</span><span>{relativeTime(message.occurredAt)}</span></div><p className="mt-1 text-sm">{message.content.message}</p></div>) : <p className="text-sm text-muted-foreground">No recorded messages yet.</p>}</div></section><DialogFooter><Button variant="outline" disabled={isUpdating || selectedDetail.reviewStatus === "excluded"} onClick={() => void updateReview([selectedDetail.id], "excluded")}>Exclude</Button><Button variant="brand" disabled={isUpdating || selectedDetail.reviewStatus === "approved"} onClick={() => void updateReview([selectedDetail.id], "approved")}><Check /> Approve</Button></DialogFooter></> : <Skeleton className="h-48 w-full" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
