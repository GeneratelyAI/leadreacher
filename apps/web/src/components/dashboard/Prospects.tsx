"use client";

import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";
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
  UserPlus,
  Users,
  X,
  Clock3,
} from "@/components/ui/icons";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { TruncatedWithTooltip } from "@/components/dashboard/DashboardMenu";
import { formatSocialMediaNames } from "@/components/dashboard/ChannelIdentity";
import { Filter as VisualFilter, type FilterGroup } from "@/components/dashboard/Filter";
import { ChannelLogo } from "@/components/onboarding/ChannelLogo";
import { SelectionToolbar, SelectionToolbarAction } from "@/components/patterns/SelectionToolbar";
import { Button } from "@/components/ui/Button";
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

const ImportProspects = dynamic(
  () => import("@/components/dashboard/ImportProspects").then((module) => module.ImportProspects),
  { ssr: false, loading: () => null },
);
const AddProspect = dynamic(
  () => import("@/components/dashboard/AddProspect").then((module) => module.AddProspect),
  { ssr: false, loading: () => null },
);
const FindProspects = dynamic(
  () => import("@/components/dashboard/FindProspects").then((module) => module.FindProspects),
  { ssr: false, loading: () => null },
);

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
  instagramUsername: string | null;
  instagramMessagingId: string | null;
  instagramIdentityStatus: string;
  outreachSuppressedAt: string | null;
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

const PAGE_SIZE_OPTIONS = [25, 50] as const;
const DEFAULT_PAGE_SIZE = PAGE_SIZE_OPTIONS[0];
const lifecycleStates = ["new", "contacted", "connected", "replied", "meeting", "converted", "lost", "skipped"];
const sourceOptions = [
  { value: "apify", label: "LinkedIn search" },
  { value: "csv", label: "CSV import" },
  { value: "manual", label: "Manual" },
];

function titleCase(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatProspectCampaignNames(detail: ProspectDetail): ProspectDetail {
  return {
    ...detail,
    campaigns: detail.campaigns.map((membership) => ({
      ...membership,
      campaign: {
        ...membership.campaign,
        name: formatSocialMediaNames(membership.campaign.name),
      },
    })),
  };
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
  const dimension = size === "large" ? 56 : 36;
  return url ? <Image src={url} width={dimension} height={dimension} alt="" unoptimized className={cn("shrink-0 rounded-full object-cover", className)} /> : <span aria-hidden className={cn("inline-flex shrink-0 items-center justify-center rounded-full bg-onboarding-purple-100 font-semibold text-onboarding-purple-700 dark:bg-onboarding-purple-900 dark:text-onboarding-purple-100", className)}>{initials(name)}</span>;
}

function ReachableSignals({ prospect }: { prospect: Prospect }) {
  return (
    <div className="flex items-center gap-1.5" aria-label="Available contact channels">
      {prospect.linkedinUrl ? <span className="inline-flex size-7 items-center justify-center" title="LinkedIn available"><ChannelLogo name="linkedin" className="size-7" /></span> : null}
      {prospect.email ? <span className="inline-flex size-7 items-center justify-center text-onboarding-success-500" title="Email available"><Mail className="size-4" /></span> : null}
      {prospect.phone ? <span className="inline-flex size-7 items-center justify-center text-onboarding-success-500" title="Phone available"><CheckCircle2 className="size-4" /></span> : null}
      {prospect.instagramUsername ? <span className="inline-flex size-7 items-center justify-center" title={prospect.instagramMessagingId ? "Instagram messaging ready" : "Instagram identity will be checked before launch"}><ChannelLogo name="instagram" className={cn("size-6", prospect.instagramMessagingId ? "" : "opacity-50")} /></span> : null}
      {prospect.outreachSuppressedAt ? <Badge variant="outline" className="text-[10px]">Suppressed</Badge> : null}
      {!prospect.linkedinUrl && !prospect.email && !prospect.phone && !prospect.instagramUsername ? <span className="text-xs text-muted-foreground">None</span> : null}
    </div>
  );
}

function ReviewBadge({ status }: { status: LeadReviewStatus }) {
  const styles = {
    pending: "border-onboarding-warning-200 bg-onboarding-warning-50 text-onboarding-warning-900 dark:border-onboarding-warning-500/70 dark:bg-onboarding-warning-900/60 dark:text-onboarding-warning-150",
    approved: "border-onboarding-success-200 bg-onboarding-success-50 text-onboarding-success-700 dark:border-onboarding-success-500/70 dark:bg-onboarding-success-900/60 dark:text-onboarding-neutral-0",
    excluded: "border-onboarding-neutral-200 bg-onboarding-neutral-100 text-onboarding-neutral-600 dark:border-onboarding-neutral-500 dark:bg-onboarding-neutral-800 dark:text-onboarding-neutral-200",
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
    <div className="flex min-w-0 items-center gap-3 border-r border-border px-3 last:border-r-0 sm:px-4">
      <span className={cn("inline-flex shrink-0 [&_svg]:size-4", tones[tone])}>{icon}</span>
      <div className="min-w-0">
        <p className="text-base font-semibold tracking-tight sm:text-lg">{value.toLocaleString()}</p>
        <p className="truncate text-xs font-medium text-onboarding-ink dark:text-onboarding-neutral-0">{label}</p>
        <p className="sr-only">{detail}</p>
      </div>
    </div>
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
  isCampaignReview,
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
  isCampaignReview: boolean;
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
      trailing={isCampaignReview ? undefined : (
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
      )}
    >
      <SelectionToolbarAction leftIcon={<Check weight="regular" />} disabled={isUpdating} onClick={onApprove}>
        Approve
      </SelectionToolbarAction>
      <SelectionToolbarAction leftIcon={<X weight="regular" />} disabled={isUpdating} onClick={onExclude}>
        Exclude
      </SelectionToolbarAction>
      {!isCampaignReview ? <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <SelectionToolbarAction aria-label="Campaign for selected prospects" />
          }
        >
          <span className="max-w-40 truncate">
            {formatSocialMediaNames(campaigns.find((campaign) => campaign.id === enrollmentCampaignId)?.name ?? "Add to campaign")}
          </span>
          <ChevronDown className="size-3.5 opacity-70" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="top" sideOffset={8} className="min-w-56">
          <DropdownMenuItem onClick={() => onEnrollmentCampaignChange("")}>Add to campaign</DropdownMenuItem>
          {campaigns
            .filter((campaign) => ["draft", "review"].includes(campaign.status))
            .map((campaign) => (
              <DropdownMenuItem key={campaign.id} onClick={() => onEnrollmentCampaignChange(campaign.id)}>
                <TruncatedWithTooltip text={formatSocialMediaNames(campaign.name)} />
                {enrollmentCampaignId === campaign.id ? <Check className="ml-auto size-3.5 shrink-0" /> : null}
              </DropdownMenuItem>
            ))}
        </DropdownMenuContent>
      </DropdownMenu> : null}
    </SelectionToolbar>
  );
}

export function Prospects() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(DEFAULT_PAGE_SIZE);
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
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [scrapeOpen, setScrapeOpen] = useState(
    () => searchParams.get("findProspects") === "true",
  );
  const [filtersOpen, setFiltersOpen] = useState(false);

  const prospectParams = useMemo(() => {
    const params = new URLSearchParams({ limit: String(pageSize), offset: String((page - 1) * pageSize) });
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
  }, [campaignFilter, debouncedQuery, lifecycle, page, pageSize, relationshipFilter, reviewStatus, source]);
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
  const leads = useMemo(() => prospectsQuery.data?.leads ?? [], [prospectsQuery.data?.leads]);
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
      queryClient.invalidateQueries({ queryKey: ["dashboard", "campaigns"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard", "overview"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard", "analytics"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard", "activity"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard", "chrome"] }),
    ]);
  };

  useEffect(() => { setPage(1); setSelected(new Set()); }, [campaignFilter, debouncedQuery, lifecycle, pageSize, relationshipFilter, reviewStatus, source]);

  useEffect(() => {
    if (!campaignFilter) setRelationshipFilter("");
  }, [campaignFilter]);

  useEffect(() => {
    if (total <= page * pageSize) return;
    const nextParams = new URLSearchParams(prospectParams);
    nextParams.set("offset", String(page * pageSize));
    const nextPageParams = nextParams.toString();
    void queryClient.prefetchQuery({
      queryKey: ["dashboard", "prospects", nextPageParams],
      queryFn: () => apiFetch<ProspectListResponse>(`/dashboard/prospects?${nextPageParams}`),
      staleTime: 30_000,
    });
  }, [page, pageSize, prospectParams, queryClient, total]);

  const fetchProspectDetail = useCallback((id: string) => queryClient.fetchQuery({
    queryKey: ["dashboard", "prospect", id],
    queryFn: () => apiFetch<{ lead: ProspectDetail }>(`/dashboard/prospects/${id}`),
  }), [queryClient]);

  const prefetchProspectDetail = useCallback((id: string) => {
    void queryClient.prefetchQuery({
      queryKey: ["dashboard", "prospect", id],
      queryFn: () => apiFetch<{ lead: ProspectDetail }>(`/dashboard/prospects/${id}`),
    });
  }, [queryClient]);

  async function openDetail(id: string) {
    const cached = queryClient.getQueryData<{ lead: ProspectDetail }>(["dashboard", "prospect", id]);
    if (cached) {
      setSelectedDetail(formatProspectCampaignNames(cached.lead));
      setDetailOpen(true);
    }
    try {
      const response = await fetchProspectDetail(id);
      setSelectedDetail(formatProspectCampaignNames(response.lead));
      setDetailOpen(true);
    } catch (requestError) {
      setActionError(requestError instanceof Error ? requestError.message : "Unable to load prospect details.");
    }
  }

  async function updateReview(leadIds: string[], nextStatus: "approved" | "excluded") {
    if (isUpdating) return;
    setIsUpdating(true);
    const previous = queryClient.getQueriesData<ProspectListResponse>({ queryKey: ["dashboard", "prospects"] });
    queryClient.setQueriesData<ProspectListResponse>({ queryKey: ["dashboard", "prospects"] }, (current) => {
      if (!current) return current;
      return {
        ...current,
        leads: current.leads.map((lead) => leadIds.includes(lead.id) ? { ...lead, reviewStatus: nextStatus, reviewedAt: new Date().toISOString() } : lead),
      };
    });
    if (selectedDetail && leadIds.includes(selectedDetail.id)) setSelectedDetail({ ...selectedDetail, reviewStatus: nextStatus });
    try {
      if (leadIds.length === 1) {
        await apiFetch(`/dashboard/prospects/${leadIds[0]}/review`, { method: "PATCH", body: JSON.stringify({ reviewStatus: nextStatus }) });
      } else {
        await apiFetch("/dashboard/prospects/review", { method: "POST", body: JSON.stringify({ leadIds, reviewStatus: nextStatus }) });
      }
      setSelected(new Set());
      await load();
    } catch (requestError) {
      previous.forEach(([queryKey, data]) => queryClient.setQueryData(queryKey, data));
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

  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const approvedSelectedCount = useMemo(() => [...selected].filter((id) => leads.find((lead) => lead.id === id)?.reviewStatus === "approved").length, [leads, selected]);
  const visibleIds = leads.map((lead) => lead.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
  const clearFilters = () => { setQuery(""); setReviewStatus("all"); setLifecycle(""); setSource(""); setCampaignFilter(""); setRelationshipFilter(""); };
  const activeFilterCount = [lifecycle, source, campaignFilter, relationshipFilter].filter(Boolean).length;
  const campaignReview = campaignFilter
    ? campaigns.find((campaign) => campaign.id === campaignFilter) ?? null
    : null;

  const lifecycleFilterGroups: FilterGroup[] = [{
    label: "Lifecycle states",
    options: lifecycleStates.map((state) => ({ value: state, label: lifecycleLabel(state) })),
  }];
  const sourceFilterGroups: FilterGroup[] = [{
    label: "Sources",
    options: sourceOptions.map((option) => ({ value: option.value, label: option.label })),
  }];
  const campaignFilterGroups: FilterGroup[] = campaigns.length ? [{
    label: "Campaigns",
    options: campaigns.map((campaign) => ({ value: campaign.id, label: formatSocialMediaNames(campaign.name) })),
  }] : [];
  const relationshipFilterGroups: FilterGroup[] = [{
    label: "Relationship routes",
    options: [
      { value: "connected", label: "Direct message", icon: <CheckCircle2 className="size-5 text-onboarding-success-500" /> },
      { value: "invite_required", label: "Invite first", icon: <MessageCircle className="size-5 text-onboarding-purple-600 dark:text-onboarding-purple-200" /> },
      { value: "unresolved", label: "Unresolved", icon: <Clock3 className="size-5 text-onboarding-warning-500" /> },
      { value: "unknown", label: "Not checked", icon: <Clock3 className="size-5 text-muted-foreground" /> },
    ],
  }];
  const filterControls = (
    <>
      <VisualFilter value={lifecycle} groups={lifecycleFilterGroups} onValueChange={setLifecycle} allLabel="All lifecycle states" className="h-9 min-w-40 text-sm font-normal" aria-label="Filter prospects by lifecycle" />
      <VisualFilter value={source} groups={sourceFilterGroups} onValueChange={setSource} allLabel="All sources" className="h-9 min-w-32 text-sm font-normal" aria-label="Filter prospects by source" />
      <VisualFilter value={campaignFilter} groups={campaignFilterGroups} onValueChange={setCampaignFilter} allLabel="All campaigns" className="h-9 min-w-36 text-sm font-normal" aria-label="Filter prospects by campaign" />
      {campaignFilter ? (
        <VisualFilter
          value={relationshipFilter}
          groups={relationshipFilterGroups}
          onValueChange={(value) => setRelationshipFilter(value as LinkedInRelationship | "")}
          allLabel="All relationship routes"
          className="h-9 min-w-36 text-sm font-normal"
          aria-label="Filter prospects by relationship route"
        />
      ) : null}
    </>
  );

  const messageMembership = selectedDetail?.campaigns.find(
    (membership) => membership.status === "active",
  ) ?? null;

  return (
    <div className={cn("space-y-3", selected.size > 0 && "pb-36 sm:pb-32")}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">
            {campaignFilter ? "Review campaign audience" : "Prospects"}
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
            {campaignFilter
              ? "Approve or exclude every enrolled prospect. Nothing is sent until the audience and sequence are both reviewed."
              : "Review real people before enrollment. Approval and exclusion are reversible and do not alter existing campaign delivery."}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {campaignFilter ? (
            <Button variant="brand" className="min-h-10" asChild>
              <Link href={`/dashboard/campaigns?reviewCampaignId=${campaignFilter}`}>Review campaign</Link>
            </Button>
          ) : (
            <>
              <Button variant="secondary" className="min-h-10" onClick={() => setQuickAddOpen(true)}>
                <UserPlus /> Add prospect
              </Button>
              <Button variant="secondary" className="min-h-10" onClick={() => setImportOpen(true)}>
                <Upload /> Import CSV
              </Button>
              <Button variant="brand" className="min-h-10" onClick={() => setScrapeOpen(true)}>
                <Search /> Find prospects
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid min-h-16 divide-y divide-border border-y border-border sm:grid-cols-2 sm:divide-y-0 xl:grid-cols-5 xl:divide-x xl:divide-y-0">
        <TrendlessMetric label="Total prospects" value={counts.all} detail="All imported prospects" tone="purple" icon={<Users strokeWidth={1.75} />} />
        <TrendlessMetric label="Pending review" value={counts.pending} detail="Awaiting a decision" tone="yellow" icon={<Clock3 strokeWidth={1.75} />} />
        <TrendlessMetric label="Approved" value={counts.approved} detail="Eligible for enrollment" tone="green" icon={<Check strokeWidth={1.75} />} />
        <TrendlessMetric label="Excluded" value={counts.excluded} detail="Reversible exclusions" tone="red" icon={<X strokeWidth={1.75} />} />
        <TrendlessMetric label="Total reached" value={counts.reached} detail="Distinct prospects with outreach" tone="blue" icon={<Mail strokeWidth={1.75} />} />
      </div>

      {error ? <div role="alert" className="rounded-lg border border-onboarding-error-200 bg-onboarding-error-50 px-4 py-3 text-sm text-onboarding-error-700 dark:border-onboarding-error-500/40 dark:bg-onboarding-error-500/15 dark:text-onboarding-error-100">{error}</div> : null}

      {campaignReview ? (
        <div className="rounded-lg border border-onboarding-purple-200 bg-onboarding-purple-50 px-4 py-3 text-sm text-onboarding-purple-900 dark:border-onboarding-purple-400/30 dark:bg-onboarding-purple-500/15 dark:text-onboarding-purple-100">
          Reviewing <span className="font-semibold">{campaignReview.name}</span>. {counts.pending} prospect{counts.pending === 1 ? "" : "s"} still need{counts.pending === 1 ? "s" : ""} a decision.
        </div>
      ) : enrollmentCampaignId ? (
        <div className="rounded-lg border border-onboarding-purple-200 bg-onboarding-purple-50 px-4 py-3 text-sm text-onboarding-purple-900 dark:border-onboarding-purple-400/30 dark:bg-onboarding-purple-500/15 dark:text-onboarding-purple-100">
          Enrolling into{" "}
          <span className="font-semibold">
            {campaigns.find((campaign) => campaign.id === enrollmentCampaignId)?.name ?? "selected campaign"}
          </span>
          . Approve prospects, select rows, then use Add to campaign.
        </div>
      ) : null}

      <section className="overflow-hidden border-y border-border">
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
            <h2 className="mt-3 font-semibold">
              {campaignReview && !debouncedQuery && reviewStatus === "all" && activeFilterCount === 1
                ? "This campaign has no prospects to review"
                : "No prospects match these filters"}
            </h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              {campaignReview && !debouncedQuery && reviewStatus === "all" && activeFilterCount === 1
                ? "Return to the campaign to retry discovery or adjust the audience before launching."
                : debouncedQuery || reviewStatus !== "all" || activeFilterCount
                  ? "No prospects match the current search and filters."
                  : "Import a CSV or run an ICP search to begin reviewing prospects."}
            </p>
            {debouncedQuery || reviewStatus !== "all" || activeFilterCount ? <Button variant="secondary" className="mt-4" onClick={clearFilters}>Clear filters</Button> : null}
            {campaignReview ? (
              <Button variant="brand" className="mt-4" asChild>
                <Link href={`/dashboard/campaigns?reviewCampaignId=${campaignFilter}`}>Review campaign</Link>
              </Button>
            ) : (
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <Button variant="secondary" onClick={() => setQuickAddOpen(true)}><UserPlus /> Add prospect</Button>
                <Button variant="secondary" onClick={() => setImportOpen(true)}><Upload /> Import CSV</Button>
                <Button variant="brand" onClick={() => setScrapeOpen(true)}><Search /> Find prospects</Button>
              </div>
            )}
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
                        onPointerEnter={() => prefetchProspectDetail(lead.id)}
                        onFocus={() => prefetchProspectDetail(lead.id)}
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
                          <MoreHorizontal weight="regular" />
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
                      <TableRow
                        key={lead.id}
                        className="cursor-pointer"
                        onClick={() => void openDetail(lead.id)}
                        onPointerEnter={() => prefetchProspectDetail(lead.id)}
                        onFocus={() => prefetchProspectDetail(lead.id)}
                      >
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
                            {lead.campaigns.length ? lead.campaigns.map((campaign) => formatSocialMediaNames(campaign.name)).join(", ") : "Not enrolled"}
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
                              <MoreHorizontal weight="regular" />
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
          <span>Showing {total === 0 ? 0 : (page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of {total.toLocaleString()} prospects</span>
          <div className="flex flex-wrap items-center gap-1">
            <Select value={String(pageSize)} onValueChange={(value) => setPageSize(Number(value) as (typeof PAGE_SIZE_OPTIONS)[number])}>
              <SelectTrigger className="h-8 w-28 text-xs" aria-label="Prospects per page"><SelectValue /></SelectTrigger>
              <SelectContent>{PAGE_SIZE_OPTIONS.map((value) => <SelectItem key={value} value={String(value)}>{value} per page</SelectItem>)}</SelectContent>
            </Select>
            <Button variant="ghost" size="icon" className="size-10 sm:size-8" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} aria-label="Previous page"><ChevronLeft /></Button>
            <span className="px-2 text-xs font-medium text-foreground">Page {page} of {pageCount}</span>
            <Button variant="ghost" size="icon" className="size-10 sm:size-8" disabled={page >= pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))} aria-label="Next page"><ChevronRight /></Button>
          </div>
        </div>
      </section>

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
        isCampaignReview={Boolean(campaignFilter)}
        isUpdating={isUpdating}
        onApprove={() => void updateReview([...selected], "approved")}
        onExclude={() => void updateReview([...selected], "excluded")}
        onEnrollmentCampaignChange={setEnrollmentCampaignId}
        onEnroll={() => void enrollSelected()}
        onClear={() => setSelected(new Set())}
      />

      <ImportProspects open={importOpen} onOpenChange={setImportOpen} onImported={load} />
      <AddProspect open={quickAddOpen} onOpenChange={setQuickAddOpen} onAdded={load} />
      <FindProspects open={scrapeOpen} onOpenChange={setScrapeOpen} onScraped={load} />

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-2xl overflow-y-auto">
          {selectedDetail ? <><DialogHeader><div className="flex items-center gap-3"><ProspectAvatar size="large" name={`${selectedDetail.firstName} ${selectedDetail.lastName}`} url={selectedDetail.avatarUrl} /><div><DialogTitle>{selectedDetail.firstName} {selectedDetail.lastName}</DialogTitle><DialogDescription>{selectedDetail.title || "Title unavailable"} at {selectedDetail.company || "Company unavailable"}</DialogDescription></div></div></DialogHeader><div className="flex flex-wrap gap-2"><ReviewBadge status={selectedDetail.reviewStatus} />{selectedDetail.linkedinUrl ? <Button variant="secondary" asChild><a href={selectedDetail.linkedinUrl} target="_blank" rel="noreferrer">LinkedIn <ExternalLink /></a></Button> : null}{messageMembership ? <Button variant="brand" asChild><Link href={`/dashboard/messages/${messageMembership.id}`}><MessageCircle /> Message</Link></Button> : null}</div><div className="grid gap-4 rounded-lg border border-border p-4 text-sm sm:grid-cols-2"><div><p className="text-muted-foreground">Location</p><p className="mt-1 font-medium">{selectedDetail.location || "Unavailable"}</p></div><div><p className="text-muted-foreground">Source</p><p className="mt-1 font-medium">{titleCase(selectedDetail.source)}</p></div><div><p className="text-muted-foreground">Email</p><p className="mt-1 break-all font-medium">{selectedDetail.email || "Unavailable"}</p></div><div><p className="text-muted-foreground">Phone</p><p className="mt-1 font-medium">{selectedDetail.phone || "Unavailable"}</p></div></div><section><h3 className="font-semibold">Campaign membership</h3><div className="mt-2 space-y-2">{selectedDetail.campaigns.length ? selectedDetail.campaigns.map((membership) => <div key={membership.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"><span>{membership.campaign.name}</span><span className="text-muted-foreground">{titleCase(membership.status)}</span></div>) : <p className="text-sm text-muted-foreground">Not enrolled in a campaign.</p>}</div></section><section><h3 className="font-semibold">Recent activity</h3><div className="mt-2 space-y-3">{selectedDetail.messages.length ? selectedDetail.messages.map((message) => <div key={message.id} className="border-b border-border pb-3 last:border-0"><div className="flex items-center justify-between gap-3 text-xs text-muted-foreground"><span>{message.direction === "inbound" ? "Inbound reply" : "Outbound message"}</span><span>{relativeTime(message.occurredAt)}</span></div><p className="mt-1 text-sm">{message.content.message}</p></div>) : <p className="text-sm text-muted-foreground">No recorded messages yet.</p>}</div></section><DialogFooter><Button variant="outline" disabled={isUpdating || selectedDetail.reviewStatus === "excluded"} onClick={() => void updateReview([selectedDetail.id], "excluded")}>Exclude</Button><Button variant="brand" disabled={isUpdating || selectedDetail.reviewStatus === "approved"} onClick={() => void updateReview([selectedDetail.id], "approved")}><Check /> Approve</Button></DialogFooter></> : <Skeleton className="h-48 w-full" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
