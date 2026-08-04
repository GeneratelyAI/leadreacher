"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Filter,
  Loader2,
  Maximize2,
  MessageSquare,
  Minimize2,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Send,
  Sparkles,
} from "lucide-react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TruncatedWithTooltip } from "@/components/dashboard/dashboard-menu";
import { ChannelLogo } from "@/components/onboarding/ChannelLogo";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Marker, MarkerContent } from "@/components/ui/marker";
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageFooter,
  MessageGroup,
  MessageHeader,
} from "@/components/ui/message";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, apiFetch } from "@/lib/api";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { cn } from "@/lib/utils";

type ConversationState = "all" | "unread" | "needs_reply";
type SortMode = "last_activity" | "unread_first";

type ConversationRow = {
  id: string;
  leadId: string;
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
  leadId: string;
  status: string;
  chatId: string | null;
  prospect: {
    name: string;
    title: string;
    company: string;
    location: string | null;
    linkedinUrl: string | null;
    avatarUrl: string | null;
    status: string;
  };
  campaign: { id: string; name: string };
  sender: { id: string; accountName: string; platform: string; status: string; unipileId: string | null } | null;
  senderLimit: { limit: number; remaining: number; resetAt: string } | null;
  canReply: boolean;
  messages: Array<{
    id: string;
    direction: string;
    origin: string;
    status: string;
    content: { message: string; attachments: Array<{ type: string; videoUrl?: string }> };
    occurredAt: string;
  }>;
};

type ConversationListResponse = {
  conversations: ConversationRow[];
  counts: { all: number; unread: number; needsReply: number };
  total: number;
  limit: number;
  offset: number;
};

type CampaignOption = { id: string; name: string; status: string };

const PAGE_SIZE = 10;

function titleCase(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function relativeTime(value: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

function relativeTimeLong(value: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function initials(name: string): string {
  return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "?";
}

function dayKey(value: string): string {
  return new Date(value).toISOString().slice(0, 10);
}

function formatDayLabel(value: string): string {
  return new Intl.DateTimeFormat(undefined, { month: "long", day: "numeric", year: "numeric" }).format(new Date(value));
}

function PersonAvatar({
  name,
  url,
  size = "default",
}: {
  name: string;
  url: string | null;
  size?: "default" | "sm" | "lg";
}) {
  return (
    <Avatar size={size}>
      {url ? <AvatarImage src={url} alt="" /> : null}
      <AvatarFallback className="bg-onboarding-purple-100 text-onboarding-purple-700 dark:bg-onboarding-purple-900 dark:text-onboarding-purple-100">
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}

function statusDotClass(conversation: ConversationRow): string {
  if (conversation.needsReply) return "bg-onboarding-warning-500";
  return "bg-onboarding-success-500";
}

function statusTooltipLabel(conversation: ConversationRow): string {
  if (conversation.unreadCount > 0) {
    return conversation.unreadCount === 1
      ? "1 unread message"
      : `${conversation.unreadCount > 99 ? "99+" : conversation.unreadCount} unread messages`;
  }
  if (conversation.needsReply) return "Needs reply";
  return "Caught up";
}

function ConversationStatusIndicator({ conversation }: { conversation: ConversationRow }) {
  const label = statusTooltipLabel(conversation);

  if (conversation.unreadCount > 0) {
    return (
      <span
        className="mt-0.5 inline-flex min-w-5 shrink-0 items-center justify-center rounded-full bg-onboarding-error-500 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white"
        aria-label={label}
        title={label}
      >
        {conversation.unreadCount > 99 ? "99+" : conversation.unreadCount}
      </span>
    );
  }

  return (
    <span
      className={cn("mt-1 size-2.5 shrink-0 rounded-full", statusDotClass(conversation))}
      aria-label={label}
      title={label}
    />
  );
}

type FeedMarker = { kind: "marker"; id: string; label: string };
type FeedMessage = {
  kind: "message";
  id: string;
  message: ConversationDetail["messages"][number];
  showHeader: boolean;
  showAvatar: boolean;
};
type FeedGroup = {
  kind: "group";
  id: string;
  align: "start" | "end";
  senderName: string;
  senderUrl: string | null;
  messages: FeedMessage[];
};
type FeedItem = FeedMarker | FeedGroup;

function buildFeedItems(
  messages: ConversationDetail["messages"],
  prospect: { name: string; avatarUrl: string | null },
  senderName: string,
): FeedItem[] {
  const items: FeedItem[] = [];
  let lastDay: string | null = null;
  let openGroup: FeedGroup | null = null;

  const flushGroup = () => {
    if (!openGroup) return;
    const last = openGroup.messages[openGroup.messages.length - 1];
    if (last) last.showAvatar = true;
    items.push(openGroup);
    openGroup = null;
  };

  for (const message of messages) {
    const day = dayKey(message.occurredAt);
    if (day !== lastDay) {
      flushGroup();
      items.push({ kind: "marker", id: `day-${day}`, label: formatDayLabel(message.occurredAt) });
      lastDay = day;
    }

    const inbound = message.direction === "inbound";
    const align = inbound ? "start" : "end";
    const name = inbound ? prospect.name : senderName;
    const url = inbound ? prospect.avatarUrl : null;

    if (!openGroup || openGroup.align !== align) {
      flushGroup();
      openGroup = {
        kind: "group",
        id: `group-${message.id}`,
        align,
        senderName: name,
        senderUrl: url,
        messages: [],
      };
    }

    openGroup.messages.push({
      kind: "message",
      id: message.id,
      message,
      showHeader: openGroup.messages.length === 0,
      showAvatar: false,
    });
  }

  flushGroup();
  return items;
}

export function MessagesWorkspace({ conversationId }: { conversationId?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(conversationId ?? null);
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [message, setMessage] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const [query, setQuery] = useState("");
  const [state, setState] = useState<ConversationState>(() => {
    const raw = searchParams.get("state");
    return raw === "unread" || raw === "needs_reply" ? raw : "all";
  });
  const [campaignFilter, setCampaignFilter] = useState(() => searchParams.get("campaignId") ?? "");
  const [sortMode, setSortMode] = useState<SortMode>("last_activity");
  const [composerTab, setComposerTab] = useState<"reply" | "draft">("reply");
  const [draftSeen, setDraftSeen] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isDrafting, setIsDrafting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [limitError, setLimitError] = useState<string | null>(null);
  const [listSidebarOpen, setListSidebarOpen] = useState(true);
  const [amplified, setAmplified] = useState(false);
  const listOpenBeforeAmplify = useRef(true);
  const queryClient = useQueryClient();
  const debouncedQuery = useDebouncedValue(query.trim(), 300);

  const conversationParams = useMemo(() => {
    const params = new URLSearchParams({
      state,
      limit: String(PAGE_SIZE),
      offset: String((page - 1) * PAGE_SIZE),
    });
    if (debouncedQuery) params.set("query", debouncedQuery);
    if (campaignFilter) params.set("campaignId", campaignFilter);
    return params.toString();
  }, [campaignFilter, debouncedQuery, page, state]);

  const conversationsQuery = useQuery({
    queryKey: ["dashboard", "conversations", conversationParams],
    queryFn: () => apiFetch<ConversationListResponse>(`/dashboard/conversations?${conversationParams}`),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
  const campaignsQuery = useQuery({
    queryKey: ["campaigns", "options"],
    queryFn: () => apiFetch<{ campaigns: CampaignOption[] }>("/campaigns"),
    staleTime: 60_000,
  });

  const conversations = useMemo(() => {
    const rows = conversationsQuery.data?.conversations ?? [];
    if (sortMode !== "unread_first") return rows;
    return [...rows].sort((left, right) => {
      if (right.unreadCount !== left.unreadCount) return right.unreadCount - left.unreadCount;
      return new Date(right.latestMessage.occurredAt).getTime() - new Date(left.latestMessage.occurredAt).getTime();
    });
  }, [conversationsQuery.data?.conversations, sortMode]);
  const counts = conversationsQuery.data?.counts ?? { all: 0, unread: 0, needsReply: 0 };
  const total = conversationsQuery.data?.total ?? 0;
  const campaigns = campaignsQuery.data?.campaigns ?? [];
  const isLoading = conversationsQuery.isLoading && !conversationsQuery.data;
  const error = actionError ?? (conversationsQuery.error instanceof Error ? conversationsQuery.error.message : null);

  useEffect(() => {
    const savedState = window.localStorage.getItem("leadreacher-messages-sidebar-open");
    if (savedState === "false") setListSidebarOpen(false);
  }, []);

  useEffect(() => {
    if (!amplified) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setAmplified(false);
        setListSidebarOpen(listOpenBeforeAmplify.current);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [amplified]);

  function toggleListSidebar() {
    if (amplified) {
      setAmplified(false);
      setListSidebarOpen(true);
      window.localStorage.setItem("leadreacher-messages-sidebar-open", "true");
      return;
    }
    setListSidebarOpen((current) => {
      const next = !current;
      window.localStorage.setItem("leadreacher-messages-sidebar-open", String(next));
      return next;
    });
  }

  function toggleAmplified() {
    setAmplified((current) => {
      if (current) {
        setListSidebarOpen(listOpenBeforeAmplify.current);
        return false;
      }
      listOpenBeforeAmplify.current = listSidebarOpen;
      setListSidebarOpen(false);
      return true;
    });
  }

  const showListSidebar = listSidebarOpen && !amplified;

  useEffect(() => {
    if (!conversationsQuery.data) return;
    setSelectedId((current) => {
      if (conversationId) return conversationId;
      if (current && conversations.some((row) => row.id === current)) return current;
      // Keep list-first on phones/tablets; desktop can auto-open the first thread.
      if (typeof window !== "undefined" && window.innerWidth < 1024) return null;
      return conversations[0]?.id ?? null;
    });
  }, [conversationId, conversations, conversationsQuery.data]);

  useEffect(() => {
    setPage(1);
  }, [campaignFilter, debouncedQuery, state]);

  useEffect(() => {
    setSelectedId(conversationId ?? null);
  }, [conversationId]);

  const loadDetail = useCallback(async (id: string) => {
    setIsDetailLoading(true);
    try {
      const result = await apiFetch<{ conversation: ConversationDetail }>(`/dashboard/conversations/${id}`);
      setDetail(result.conversation);
      setLimitError(null);
      setMessage("");
      setComposerTab("reply");
      setDraftSeen(false);
      setIdempotencyKey(crypto.randomUUID());
    } catch (requestError) {
      setActionError(requestError instanceof Error ? requestError.message : "Unable to load conversation.");
    } finally {
      setIsDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId);
    else setDetail(null);
  }, [loadDetail, selectedId]);

  async function generateDraft() {
    if (!detail) return;
    setIsDrafting(true);
    setComposerTab("draft");
    try {
      const result = await apiFetch<{ drafts: string[] }>(`/dashboard/conversations/${detail.id}/drafts`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      setMessage(result.drafts[0] ?? "");
      setDraftSeen(true);
    } catch (requestError) {
      setActionError(requestError instanceof Error ? requestError.message : "Unable to generate a draft.");
    } finally {
      setIsDrafting(false);
    }
  }

  async function sendReply() {
    if (!detail || !message.trim() || isSending) return;
    setIsSending(true);
    setLimitError(null);
    try {
      await apiFetch(`/dashboard/conversations/${detail.id}/replies`, {
        method: "POST",
        body: JSON.stringify({ message, idempotencyKey }),
      });
      setMessage("");
      setIdempotencyKey(crypto.randomUUID());
      setComposerTab("reply");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["dashboard", "conversations"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard", "chrome"] }),
        loadDetail(detail.id),
      ]);
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.code === "daily_message_limit") {
        setLimitError(requestError.message);
      } else if (
        requestError instanceof ApiError &&
        ["delivery_pending", "delivery_unknown", "delivery_failed"].includes(
          requestError.code ?? "",
        )
      ) {
        setActionError(requestError.message);
      } else {
        setActionError(requestError instanceof Error ? requestError.message : "Unable to send reply.");
      }
    } finally {
      setIsSending(false);
    }
  }

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const feedItems = useMemo(
    () =>
      detail
        ? buildFeedItems(
            detail.messages,
            detail.prospect,
            detail.sender?.accountName || "You",
          )
        : [],
    [detail],
  );
  const hasInbound = Boolean(detail?.messages.some((item) => item.direction === "inbound"));
  const resetTime = detail?.senderLimit
    ? new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(detail.senderLimit.resetAt))
    : null;
  const isLimitReached = Boolean(detail?.senderLimit && detail.senderLimit.remaining <= 0);
  const selectedCampaignLabel = campaigns.find((campaign) => campaign.id === campaignFilter)?.name ?? "All campaigns";

  function selectConversation(id: string) {
    setSelectedId(id);
    router.push(`/dashboard/messages/${id}`);
  }

  function backToList() {
    setSelectedId(null);
    setDetail(null);
    router.push("/dashboard/messages");
  }

  const mobileThreadOpen = Boolean(selectedId);

  return (
    <div
      className={cn(
        "flex flex-col",
        amplified
          ? "fixed inset-x-0 bottom-[var(--dashboard-bottom-nav-height,0px)] top-[4.75rem] z-30 bg-onboarding-neutral-0 p-3 sm:p-4 dark:bg-onboarding-neutral-950 lg:bottom-0 lg:left-[var(--dashboard-sidebar-width)]"
          : "h-[calc(100dvh-4.75rem-var(--dashboard-bottom-nav-height,0px))] min-h-0 gap-0 lg:h-[calc(100dvh-7.25rem)] lg:min-h-[42rem] lg:gap-3",
      )}
    >
      {!amplified && !mobileThreadOpen ? (
        <div className="min-w-0 shrink-0 px-4 pb-3 pt-4 lg:px-0 lg:pb-0 lg:pt-0">
          <h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">Messages</h1>
          <p className="mt-1 hidden text-sm text-muted-foreground lg:block lg:truncate lg:whitespace-nowrap">
            Operator inbox for your conversations. AI drafts are editable, and every reply is sent only after your explicit action.
          </p>
        </div>
      ) : !amplified ? (
        <div className="hidden min-w-0 lg:block">
          <h1 className="text-3xl font-semibold tracking-tight">Messages</h1>
          <p className="mt-1 truncate text-sm text-muted-foreground whitespace-nowrap">
            Operator inbox for your conversations. AI drafts are editable, and every reply is sent only after your explicit action.
          </p>
        </div>
      ) : null}

      {error ? (
        <div role="alert" className="mx-4 mb-3 rounded-lg border border-onboarding-error-200 bg-onboarding-error-50 px-4 py-3 text-sm text-onboarding-error-700 lg:mx-0 dark:border-onboarding-error-500/40 dark:bg-onboarding-error-500/15 dark:text-onboarding-error-100">
          {error}
        </div>
      ) : null}

      <Card className="flex min-h-0 flex-1 overflow-hidden rounded-none border-x-0 border-b-0 shadow-none lg:rounded-xl lg:border lg:shadow-onboarding-small">
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <div
            className={cn(
              "flex min-h-0 flex-col overflow-hidden transition-[width,height,opacity] duration-200 ease-out",
              showListSidebar
                ? "h-full w-full opacity-100 lg:w-96 lg:shrink-0 lg:border-r lg:border-b-0"
                : "pointer-events-none h-0 w-0 border-0 opacity-0 lg:h-full",
              mobileThreadOpen && "max-lg:hidden",
            )}
          >
            <aside className="flex h-full min-h-0 w-full flex-col lg:w-96">
            <div className="space-y-2.5 border-b border-border px-3 py-3">
              <div className="flex items-center justify-between gap-2">
                <Tabs value={state} onValueChange={(value) => setState(value as ConversationState)} className="min-w-0 flex-1">
                  <TabsList variant="line" className="w-full justify-start gap-0 overflow-x-auto rounded-none p-0">
                    <TabsTrigger value="all" className="min-h-10 flex-none px-3 py-2.5 lg:min-h-0 lg:py-2">
                      All <span className="text-xs text-muted-foreground">{counts.all}</span>
                    </TabsTrigger>
                    <TabsTrigger value="unread" className="min-h-10 flex-none px-3 py-2.5 lg:min-h-0 lg:py-2">
                      Unread <span className="text-xs text-muted-foreground">{counts.unread}</span>
                    </TabsTrigger>
                    <TabsTrigger value="needs_reply" className="min-h-10 flex-none px-3 py-2.5 lg:min-h-0 lg:py-2">
                      Needs reply <span className="text-xs text-muted-foreground">{counts.needsReply}</span>
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
                <button
                  type="button"
                  onClick={toggleListSidebar}
                  className="hidden size-9 shrink-0 items-center justify-center rounded-lg text-onboarding-neutral-600 transition-colors hover:bg-onboarding-neutral-100 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-onboarding-purple-300 lg:inline-flex dark:text-onboarding-neutral-300 dark:hover:bg-onboarding-neutral-800"
                  aria-label="Collapse conversation list"
                  aria-expanded={showListSidebar}
                  title="Collapse conversation list"
                >
                  <PanelLeftClose className="size-4" aria-hidden />
                </button>
              </div>

              <label className="flex h-11 items-center gap-2 rounded-xl border border-input px-3 lg:h-9 lg:rounded-lg">
                <Search className="size-4 shrink-0 text-muted-foreground" />
                <span className="sr-only">Search conversations</span>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="min-w-0 flex-1 bg-transparent text-base outline-none lg:text-sm"
                  placeholder="Search conversations..."
                />
              </label>

              <div className="flex gap-2 overflow-x-auto pb-0.5">
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button size="sm" variant="secondary" className="h-10 shrink-0 gap-1.5 px-3 lg:h-8 lg:px-2.5" />
                    }
                  >
                    <Filter className="size-3.5" />
                    <span className="max-w-36 truncate">{selectedCampaignLabel}</span>
                    <ChevronDown className="size-3.5 opacity-70" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="min-w-56">
                    <DropdownMenuItem onClick={() => setCampaignFilter("")}>
                      All campaigns
                      {!campaignFilter ? <Check className="ml-auto size-3.5 shrink-0" /> : null}
                    </DropdownMenuItem>
                    {campaigns.map((campaign) => (
                      <DropdownMenuItem
                        key={campaign.id}
                        onClick={() => setCampaignFilter(campaign.id)}
                      >
                        <TruncatedWithTooltip text={campaign.name} />
                        {campaignFilter === campaign.id ? <Check className="ml-auto size-3.5 shrink-0" /> : null}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button size="sm" variant="secondary" className="h-10 shrink-0 gap-1.5 px-3 lg:h-8 lg:px-2.5" />
                    }
                  >
                    {sortMode === "last_activity" ? "Recent" : "Unread first"}
                    <ChevronDown className="size-3.5 opacity-70" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem onClick={() => setSortMode("last_activity")}>Last activity</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSortMode("unread_first")}>Unread first</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {isLoading ? (
                <div className="space-y-3 p-4">
                  {Array.from({ length: 6 }, (_, index) => (
                    <Skeleton key={index} className="h-16 w-full" />
                  ))}
                </div>
              ) : conversations.length === 0 ? (
                <div className="px-6 py-16 text-center">
                  <MessageSquare className="mx-auto size-8 text-muted-foreground" />
                  <h2 className="mt-3 font-semibold">No conversations yet</h2>
                  <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
                    Replies will appear here once prospects respond.
                  </p>
                </div>
              ) : (
                <ul>
                  {conversations.map((conversation) => {
                    const active = selectedId === conversation.id;
                    return (
                      <li key={conversation.id}>
                        <button
                          type="button"
                          onClick={() => selectConversation(conversation.id)}
                          className={cn(
                            "flex w-full gap-3 border-b border-border px-4 py-3.5 text-left transition-colors active:bg-onboarding-neutral-100 lg:px-3 lg:py-3 dark:active:bg-onboarding-neutral-850",
                            active
                              ? "bg-onboarding-purple-50 text-onboarding-ink dark:bg-onboarding-purple-900 dark:text-onboarding-neutral-0"
                              : "text-onboarding-ink hover:bg-onboarding-neutral-50 dark:text-onboarding-neutral-0 dark:hover:bg-onboarding-neutral-850",
                          )}
                        >
                          <PersonAvatar name={conversation.prospect.name} url={conversation.prospect.avatarUrl} />
                          <span className="min-w-0 flex-1">
                            <span className="flex items-baseline justify-between gap-2">
                              <span className={cn("truncate font-semibold", conversation.unreadCount > 0 && "font-bold")}>
                                {conversation.prospect.name}
                              </span>
                              <time
                                className={cn(
                                  "shrink-0 text-[11px]",
                                  conversation.unreadCount > 0
                                    ? "font-semibold text-onboarding-purple-600 dark:text-onboarding-purple-200"
                                    : active
                                      ? "text-onboarding-neutral-600 dark:text-onboarding-neutral-400"
                                      : "text-onboarding-neutral-500 dark:text-onboarding-neutral-400",
                                )}
                              >
                                {relativeTime(conversation.latestMessage.occurredAt)}
                              </time>
                            </span>
                            <span className="mt-0.5 block truncate text-xs text-onboarding-neutral-600 dark:text-onboarding-neutral-400">
                              {conversation.prospect.title || conversation.prospect.company || "Prospect"}
                              {conversation.campaign.name ? ` · ${conversation.campaign.name}` : ""}
                            </span>
                            <span
                              className={cn(
                                "mt-1 block truncate text-sm",
                                conversation.unreadCount > 0
                                  ? "font-medium text-onboarding-ink dark:text-onboarding-neutral-0"
                                  : active
                                    ? "text-onboarding-neutral-700 dark:text-onboarding-neutral-400"
                                    : "text-onboarding-neutral-600 dark:text-onboarding-neutral-500",
                              )}
                            >
                              {conversation.latestMessage.content}
                            </span>
                          </span>
                          <ConversationStatusIndicator conversation={conversation} />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2.5 text-xs text-muted-foreground">
              <span className="truncate">
                {total === 0 ? "0" : `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)}`} of {total.toLocaleString()}
              </span>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="size-10 lg:size-8" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} aria-label="Previous page">
                  <ChevronLeft />
                </Button>
                <span className="px-1 font-medium text-foreground">
                  {page}/{pageCount}
                </span>
                <Button variant="ghost" size="icon" className="size-10 lg:size-8" disabled={page >= pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))} aria-label="Next page">
                  <ChevronRight />
                </Button>
              </div>
            </div>
            </aside>
          </div>

          <main
            className={cn(
              "flex min-h-0 min-w-0 flex-1 flex-col",
              !mobileThreadOpen && "max-lg:hidden",
            )}
          >
            {isDetailLoading && !detail ? (
              <div className="relative flex flex-1 items-center justify-center text-sm text-muted-foreground">
                {!showListSidebar ? (
                  <button
                    type="button"
                    onClick={toggleListSidebar}
                    className="absolute top-4 left-4 inline-flex size-9 items-center justify-center rounded-lg text-onboarding-neutral-600 transition-colors hover:bg-onboarding-neutral-100 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-onboarding-purple-300 dark:text-onboarding-neutral-300 dark:hover:bg-onboarding-neutral-800"
                    aria-label="Expand conversation list"
                    aria-expanded={showListSidebar}
                    title="Expand conversation list"
                  >
                    <PanelLeftOpen className="size-4" aria-hidden />
                  </button>
                ) : null}
                <Loader2 className="mr-2 size-4 animate-spin" /> Loading conversation
              </div>
            ) : detail ? (
              <>
                <div className={cn("border-b border-border px-3 py-3 lg:space-y-4 lg:p-4", amplified && "lg:px-6")}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2.5 lg:gap-3">
                      <button
                        type="button"
                        onClick={backToList}
                        className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg text-onboarding-neutral-600 transition-colors hover:bg-onboarding-neutral-100 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-onboarding-purple-300 lg:hidden dark:text-onboarding-neutral-300 dark:hover:bg-onboarding-neutral-800"
                        aria-label="Back to conversations"
                      >
                        <ChevronLeft className="size-5" aria-hidden />
                      </button>
                      {!showListSidebar ? (
                        <button
                          type="button"
                          onClick={toggleListSidebar}
                          className="hidden size-9 shrink-0 items-center justify-center rounded-lg text-onboarding-neutral-600 transition-colors hover:bg-onboarding-neutral-100 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-onboarding-purple-300 lg:inline-flex dark:text-onboarding-neutral-300 dark:hover:bg-onboarding-neutral-800"
                          aria-label="Expand conversation list"
                          aria-expanded={showListSidebar}
                          title="Expand conversation list"
                        >
                          <PanelLeftOpen className="size-4" aria-hidden />
                        </button>
                      ) : null}
                      <PersonAvatar name={detail.prospect.name} url={detail.prospect.avatarUrl} size="lg" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h2 className="truncate text-base font-semibold lg:text-lg">{detail.prospect.name}</h2>
                          <span className="hidden size-2 rounded-full bg-onboarding-success-500 lg:inline-flex" aria-hidden />
                          {amplified ? (
                            <Badge variant="secondary" className="text-[10px] font-medium uppercase tracking-wide">
                              Amplified
                            </Badge>
                          ) : null}
                        </div>
                        <p className="truncate text-xs text-muted-foreground lg:text-sm">
                          <span className="lg:hidden">{detail.campaign.name}</span>
                          <span className="hidden lg:inline">
                            {[detail.prospect.title, detail.prospect.company].filter(Boolean).join(" at ") || "Prospect"}
                            {detail.prospect.location ? ` · ${detail.prospect.location}` : ""}
                          </span>
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5">
                      {detail.prospect.linkedinUrl ? (
                        <Button variant="ghost" size="icon" className="size-10 lg:size-8" asChild aria-label="Open LinkedIn profile">
                          <a href={detail.prospect.linkedinUrl} target="_blank" rel="noreferrer">
                            <ChannelLogo name="linkedin" className="size-5" />
                          </a>
                        </Button>
                      ) : null}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="hidden lg:inline-flex"
                        onClick={toggleAmplified}
                        aria-label={amplified ? "Exit amplified chat view" : "Enter amplified chat view"}
                        aria-pressed={amplified}
                        title={amplified ? "Exit amplified view (Esc)" : "Amplified chat view"}
                      >
                        {amplified ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="size-10 lg:size-8" aria-label="Conversation actions" />}>
                          <MoreHorizontal />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem render={<Link href={`/dashboard/prospects/${detail.leadId}`} />}>
                            View prospect
                          </DropdownMenuItem>
                          <DropdownMenuItem render={<Link href="/dashboard/campaigns" />}>
                            Open campaigns
                          </DropdownMenuItem>
                          <DropdownMenuItem className="hidden lg:flex" onClick={toggleAmplified}>
                            {amplified ? "Exit amplified view" : "Amplified chat view"}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  <div className={cn(
                    "mt-3 hidden gap-3 rounded-xl border border-border p-3 text-sm sm:grid-cols-2 lg:grid xl:grid-cols-[1fr_1.4fr_1fr_auto_auto] xl:items-center",
                    amplified && "xl:max-w-5xl",
                  )}>
                    <div>
                      <p className="text-xs text-muted-foreground">Lifecycle</p>
                      <p className="mt-1 flex items-center gap-1.5 font-medium">
                        <Check className="size-3.5 text-onboarding-success-500" />
                        {titleCase(detail.prospect.status)}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">Current campaign</p>
                      <p className="mt-1 flex min-w-0 font-medium text-onboarding-purple-600 dark:text-onboarding-purple-200">
                        <TruncatedWithTooltip text={detail.campaign.name} />
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Last activity</p>
                      <p className="mt-1 font-medium">
                        {detail.messages.length
                          ? relativeTimeLong(detail.messages[detail.messages.length - 1]!.occurredAt)
                          : "No activity"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Replied</p>
                      <p className="mt-1 font-medium">{hasInbound ? "Yes" : "No"}</p>
                    </div>
                    <Button variant="outline" size="sm" className="justify-self-start xl:justify-self-end" asChild>
                      <Link href={`/dashboard/prospects/${detail.leadId}`}>View prospect</Link>
                    </Button>
                  </div>
                </div>

                <div className="min-h-0 flex-1">
                  <MessageScrollerProvider>
                    <MessageScroller className="h-full">
                      <MessageScrollerViewport className={cn("px-3 py-3 lg:px-4 lg:py-4", amplified && "mx-auto w-full max-w-5xl px-5 sm:px-8")}>
                        <MessageScrollerContent>
                          {feedItems.map((item, index) => {
                            if (item.kind === "marker") {
                              return (
                                <MessageScrollerItem key={item.id} messageId={item.id}>
                                  <Marker variant="separator">
                                    <MarkerContent>{item.label}</MarkerContent>
                                  </Marker>
                                </MessageScrollerItem>
                              );
                            }

                            const isLastGroup = index === feedItems.length - 1;

                            return (
                              <MessageGroup key={item.id}>
                                {item.messages.map((entry, messageIndex) => {
                                  const inbound = entry.message.direction === "inbound";
                                  const isLastMessage =
                                    isLastGroup && messageIndex === item.messages.length - 1;

                                  return (
                                    <MessageScrollerItem
                                      key={entry.id}
                                      messageId={entry.id}
                                      scrollAnchor={isLastMessage}
                                    >
                                      <Message align={item.align}>
                                        <MessageAvatar>
                                          {entry.showAvatar ? (
                                            <PersonAvatar
                                              name={item.senderName}
                                              url={item.senderUrl}
                                              size="sm"
                                            />
                                          ) : (
                                            <span className="size-6" aria-hidden />
                                          )}
                                        </MessageAvatar>
                                        <MessageContent>
                                          {entry.showHeader ? (
                                            <MessageHeader>{item.senderName}</MessageHeader>
                                          ) : null}
                                          <Bubble
                                            align={item.align}
                                            variant={inbound ? "outline" : "tinted"}
                                            className={cn(
                                              amplified ? "max-w-[min(42rem,88%)]" : "max-w-[min(85%,20rem)] lg:max-w-[80%]",
                                              inbound &&
                                                "*:data-[slot=bubble-content]:border-onboarding-purple-200 dark:*:data-[slot=bubble-content]:border-onboarding-purple-400/40",
                                              !inbound &&
                                                "*:data-[slot=bubble-content]:bg-onboarding-purple-100 *:data-[slot=bubble-content]:text-onboarding-ink dark:*:data-[slot=bubble-content]:bg-onboarding-purple-500/25 dark:*:data-[slot=bubble-content]:text-onboarding-neutral-0",
                                            )}
                                          >
                                            <BubbleContent>{entry.message.content.message}</BubbleContent>
                                          </Bubble>
                                          {entry.message.content.attachments
                                            .filter(
                                              (attachment) =>
                                                attachment.type === "video" && attachment.videoUrl,
                                            )
                                            .map((attachment) => (
                                              <a
                                                key={attachment.videoUrl}
                                                href={attachment.videoUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="inline-flex items-center gap-1 px-3 text-xs text-onboarding-purple-600 underline dark:text-onboarding-purple-300"
                                              >
                                                Video attachment <ExternalLink className="size-3" />
                                              </a>
                                            ))}
                                          <MessageFooter>
                                            Sent via LinkedIn · {relativeTimeLong(entry.message.occurredAt)}
                                            {entry.message.origin === "operator" ? " · Operator" : ""}
                                          </MessageFooter>
                                        </MessageContent>
                                      </Message>
                                    </MessageScrollerItem>
                                  );
                                })}
                              </MessageGroup>
                            );
                          })}
                        </MessageScrollerContent>
                      </MessageScrollerViewport>
                      <MessageScrollerButton direction="end" />
                    </MessageScroller>
                  </MessageScrollerProvider>
                </div>

                <div className={cn("shrink-0 border-t border-border bg-onboarding-neutral-0 p-3 dark:bg-onboarding-neutral-900", amplified && "mx-auto w-full max-w-5xl px-5 sm:px-8")}>
                  {limitError || isLimitReached ? (
                    <p className="mb-2 text-xs font-medium text-onboarding-warning-900 dark:text-onboarding-warning-150">
                      {limitError || `Daily LinkedIn message limit reached. Sending resets at ${resetTime}.`}
                    </p>
                  ) : null}

                  {!detail.canReply ? (
                    <p className="text-sm text-muted-foreground">
                      A real inbound reply and an active campaign sender are required before an operator can reply.
                    </p>
                  ) : (
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <Tabs value={composerTab} onValueChange={(value) => setComposerTab(value as "reply" | "draft")}>
                          <TabsList variant="line" className="justify-start gap-1 rounded-none p-0">
                            <TabsTrigger value="reply" className="min-h-10 px-3 py-2 lg:min-h-0">Reply</TabsTrigger>
                            <TabsTrigger value="draft" className="min-h-10 gap-2 px-3 py-2 lg:min-h-0">
                              AI Draft
                              {!draftSeen ? <Badge className="bg-onboarding-purple-500 text-white">New</Badge> : null}
                            </TabsTrigger>
                          </TabsList>
                        </Tabs>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-10 shrink-0 lg:h-8"
                          disabled={isDrafting || isLimitReached}
                          onClick={() => void generateDraft()}
                        >
                          {isDrafting ? <Loader2 className="animate-spin" /> : <Sparkles />}
                          <span className="hidden sm:inline">Use AI to draft</span>
                          <span className="sm:hidden">AI</span>
                        </Button>
                      </div>

                      <Textarea
                        value={message}
                        onChange={(event) => setMessage(event.target.value)}
                        placeholder={composerTab === "draft" ? "Generate or edit an AI draft..." : "Type your message..."}
                        className={cn("min-h-[5.5rem] text-base lg:min-h-24 lg:text-sm", amplified && "min-h-36")}
                      />

                      <div className="flex items-center justify-between gap-2">
                        <p className="min-w-0 truncate text-xs text-muted-foreground">
                          {detail.sender?.accountName || "LinkedIn"}
                          {detail.senderLimit ? ` · ${detail.senderLimit.remaining}/${detail.senderLimit.limit}` : ""}
                        </p>
                        <Button
                          size="sm"
                          variant="brand"
                          className="h-11 min-w-28 gap-2 px-4 lg:h-8 lg:min-w-0"
                          disabled={isSending || !message.trim() || isLimitReached}
                          onClick={() => void sendReply()}
                        >
                          {isSending ? <Loader2 className="animate-spin" /> : <Send />}
                          Send
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
                {!showListSidebar ? (
                  <button
                    type="button"
                    onClick={toggleListSidebar}
                    className="mb-4 inline-flex size-9 items-center justify-center rounded-lg text-onboarding-neutral-600 transition-colors hover:bg-onboarding-neutral-100 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-onboarding-purple-300 dark:text-onboarding-neutral-300 dark:hover:bg-onboarding-neutral-800"
                    aria-label="Expand conversation list"
                    aria-expanded={showListSidebar}
                    title="Expand conversation list"
                  >
                    <PanelLeftOpen className="size-4" aria-hidden />
                  </button>
                ) : null}
                <MessageSquare className="size-8 text-muted-foreground" />
                <h2 className="mt-3 font-semibold">Choose a conversation</h2>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  Select a conversation to view the full message history and prospect context.
                </p>
              </div>
            )}
          </main>
        </div>
      </Card>
    </div>
  );
}
