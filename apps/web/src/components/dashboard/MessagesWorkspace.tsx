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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ApiError, apiFetch } from "@/lib/api";
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

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          conversation.unreadCount > 0 ? (
            <span
              className="mt-0.5 inline-flex min-w-5 shrink-0 items-center justify-center rounded-full bg-onboarding-error-500 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white"
              aria-label={label}
            />
          ) : (
            <span
              className={cn("mt-1 size-2 shrink-0 rounded-full", statusDotClass(conversation))}
              aria-label={label}
            />
          )
        }
      >
        {conversation.unreadCount > 0
          ? conversation.unreadCount > 99
            ? "99+"
            : conversation.unreadCount
          : null}
      </TooltipTrigger>
      <TooltipContent side="left" sideOffset={8} className="z-[70]">
        {label}
      </TooltipContent>
    </Tooltip>
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
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [counts, setCounts] = useState({ all: 0, unread: 0, needsReply: 0 });
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(conversationId ?? null);
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
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
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isDrafting, setIsDrafting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [limitError, setLimitError] = useState<string | null>(null);
  const [listSidebarOpen, setListSidebarOpen] = useState(true);
  const [amplified, setAmplified] = useState(false);
  const listOpenBeforeAmplify = useRef(true);

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

  const load = useCallback(async () => {
    setIsLoading(true);
    const params = new URLSearchParams({
      state,
      limit: String(PAGE_SIZE),
      offset: String((page - 1) * PAGE_SIZE),
    });
    if (query.trim()) params.set("query", query.trim());
    if (campaignFilter) params.set("campaignId", campaignFilter);
    try {
      const [list, campaignResponse] = await Promise.all([
        apiFetch<ConversationListResponse>(`/dashboard/conversations?${params.toString()}`),
        apiFetch<{ campaigns: CampaignOption[] }>("/campaigns"),
      ]);
      let rows = list.conversations;
      if (sortMode === "unread_first") {
        rows = [...rows].sort((left, right) => {
          if (right.unreadCount !== left.unreadCount) return right.unreadCount - left.unreadCount;
          return new Date(right.latestMessage.occurredAt).getTime() - new Date(left.latestMessage.occurredAt).getTime();
        });
      }
      setConversations(rows);
      setCounts(list.counts);
      setTotal(list.total);
      setCampaigns(campaignResponse.campaigns);
      setSelectedId((current) => {
        if (conversationId) return conversationId;
        if (current && rows.some((row) => row.id === current)) return current;
        return rows[0]?.id ?? null;
      });
      setError(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load conversations.");
    } finally {
      setIsLoading(false);
    }
  }, [campaignFilter, conversationId, page, query, sortMode, state]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [campaignFilter, query, state]);

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
      setError(requestError instanceof Error ? requestError.message : "Unable to load conversation.");
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
      setError(requestError instanceof Error ? requestError.message : "Unable to generate a draft.");
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
      await Promise.all([load(), loadDetail(detail.id)]);
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.code === "daily_message_limit") {
        setLimitError(requestError.message);
      } else {
        setError(requestError instanceof Error ? requestError.message : "Unable to send reply.");
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

  return (
    <div
      className={cn(
        "flex flex-col",
        amplified
          ? "fixed inset-x-0 bottom-0 top-[4.75rem] z-30 bg-onboarding-neutral-0 p-3 sm:p-4 dark:bg-onboarding-neutral-950 lg:left-[var(--dashboard-sidebar-width)]"
          : "h-[calc(100dvh-7.25rem)] min-h-[42rem] gap-3",
      )}
    >
      {!amplified ? (
        <div className="min-w-0">
          <h1 className="text-3xl font-semibold tracking-tight">Messages</h1>
          <p className="mt-1 truncate text-sm text-muted-foreground whitespace-nowrap">
            Operator inbox for your conversations. AI drafts are editable, and every reply is sent only after your explicit action.
          </p>
        </div>
      ) : null}

      {error ? (
        <div role="alert" className="rounded-lg border border-onboarding-error-200 bg-onboarding-error-50 px-4 py-3 text-sm text-onboarding-error-700 dark:border-onboarding-error-500/40 dark:bg-onboarding-error-500/15 dark:text-onboarding-error-100">
          {error}
        </div>
      ) : null}

      <Card className="flex min-h-0 flex-1 overflow-hidden shadow-onboarding-small">
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <div
            className={cn(
              "min-h-0 shrink-0 overflow-hidden transition-[width,height,opacity] duration-200 ease-out",
              showListSidebar
                ? "h-auto w-full border-b border-border opacity-100 lg:h-full lg:w-96 lg:border-r lg:border-b-0"
                : "pointer-events-none h-0 w-0 border-0 opacity-0 lg:h-full",
            )}
          >
            <aside className="flex h-full min-h-0 w-full flex-col lg:w-96">
            <div className="space-y-3 border-b border-border p-3">
              <div className="flex items-center justify-between gap-2">
                <Tabs value={state} onValueChange={(value) => setState(value as ConversationState)} className="min-w-0 flex-1">
                  <TabsList variant="line" className="w-full justify-start gap-1 rounded-none p-0">
                    <TabsTrigger value="all" className="flex-none px-3 py-2">
                      All <span className="text-xs text-muted-foreground">{counts.all}</span>
                    </TabsTrigger>
                    <TabsTrigger value="unread" className="flex-none px-3 py-2">
                      Unread <span className="text-xs text-muted-foreground">{counts.unread}</span>
                    </TabsTrigger>
                    <TabsTrigger value="needs_reply" className="flex-none px-3 py-2">
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

              <label className="flex h-9 items-center gap-2 rounded-lg border border-input px-3">
                <Search className="size-4 shrink-0 text-muted-foreground" />
                <span className="sr-only">Search conversations</span>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                  placeholder="Search conversations..."
                />
              </label>

              <div className="flex flex-wrap gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button size="sm" variant="ghost" className="h-8 gap-1.5 px-2.5" />
                    }
                  >
                    <Filter className="size-3.5" />
                    <span className="max-w-28 truncate">{selectedCampaignLabel}</span>
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
                      <Button size="sm" variant="ghost" className="h-8 gap-1.5 px-2.5" />
                    }
                  >
                    Sort by: {sortMode === "last_activity" ? "Last activity" : "Unread first"}
                    <ChevronDown className="size-3.5 opacity-70" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem onClick={() => setSortMode("last_activity")}>Last activity</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSortMode("unread_first")}>Unread first</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
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
                            "flex w-full gap-3 border-b border-border px-3 py-3 text-left transition-colors",
                            active
                              ? "bg-onboarding-purple-50 text-onboarding-ink dark:bg-onboarding-purple-900 dark:text-onboarding-neutral-0"
                              : "text-onboarding-ink hover:bg-onboarding-neutral-50 dark:text-onboarding-neutral-0 dark:hover:bg-onboarding-neutral-850",
                          )}
                        >
                          <PersonAvatar name={conversation.prospect.name} url={conversation.prospect.avatarUrl} />
                          <span className="min-w-0 flex-1">
                            <span className="flex items-baseline justify-between gap-2">
                              <span className="truncate font-semibold">{conversation.prospect.name}</span>
                              <time
                                className={cn(
                                  "shrink-0 text-[11px]",
                                  active
                                    ? "text-onboarding-neutral-600 dark:text-onboarding-neutral-400"
                                    : "text-onboarding-neutral-500 dark:text-onboarding-neutral-400",
                                )}
                              >
                                {relativeTime(conversation.latestMessage.occurredAt)}
                              </time>
                            </span>
                            <span
                              className={cn(
                                "mt-0.5 block truncate text-xs",
                                "text-onboarding-neutral-600 dark:text-onboarding-neutral-400",
                              )}
                            >
                              {conversation.prospect.title || conversation.prospect.company || "Prospect"}
                            </span>
                            <span
                              className={cn(
                                "mt-1 block truncate text-sm",
                                active
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

            <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2 text-xs text-muted-foreground">
              <span>
                Showing {total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1} to {Math.min(page * PAGE_SIZE, total)} of {total.toLocaleString()}
              </span>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} aria-label="Previous page">
                  <ChevronLeft />
                </Button>
                <span className="px-1 font-medium text-foreground">
                  {page}/{pageCount}
                </span>
                <Button variant="ghost" size="icon" disabled={page >= pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))} aria-label="Next page">
                  <ChevronRight />
                </Button>
              </div>
            </div>
            </aside>
          </div>

          <main className="flex min-h-0 min-w-0 flex-1 flex-col">
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
                <div className={cn("space-y-4 border-b border-border p-4", amplified && "px-5 sm:px-6")}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      {!showListSidebar ? (
                        <button
                          type="button"
                          onClick={toggleListSidebar}
                          className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-onboarding-neutral-600 transition-colors hover:bg-onboarding-neutral-100 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-onboarding-purple-300 dark:text-onboarding-neutral-300 dark:hover:bg-onboarding-neutral-800"
                          aria-label="Expand conversation list"
                          aria-expanded={showListSidebar}
                          title="Expand conversation list"
                        >
                          <PanelLeftOpen className="size-4" aria-hidden />
                        </button>
                      ) : null}
                      <PersonAvatar name={detail.prospect.name} url={detail.prospect.avatarUrl} size="lg" />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="truncate text-lg font-semibold">{detail.prospect.name}</h2>
                          <span className="size-2 rounded-full bg-onboarding-success-500" aria-hidden />
                          {amplified ? (
                            <Badge variant="secondary" className="text-[10px] font-medium uppercase tracking-wide">
                              Amplified
                            </Badge>
                          ) : null}
                        </div>
                        <p className="truncate text-sm text-muted-foreground">
                          {[detail.prospect.title, detail.prospect.company].filter(Boolean).join(" at ") || "Prospect"}
                          {detail.prospect.location ? ` · ${detail.prospect.location}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {detail.prospect.linkedinUrl ? (
                        <Button variant="ghost" size="icon" asChild aria-label="Open LinkedIn profile">
                          <a href={detail.prospect.linkedinUrl} target="_blank" rel="noreferrer">
                            <ChannelLogo name="linkedin" className="size-4" />
                          </a>
                        </Button>
                      ) : null}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={toggleAmplified}
                        aria-label={amplified ? "Exit amplified chat view" : "Enter amplified chat view"}
                        aria-pressed={amplified}
                        title={amplified ? "Exit amplified view (Esc)" : "Amplified chat view"}
                      >
                        {amplified ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="Conversation actions" />}>
                          <MoreHorizontal />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem render={<Link href={`/dashboard/prospects/${detail.leadId}`} />}>
                            View prospect
                          </DropdownMenuItem>
                          <DropdownMenuItem render={<Link href="/dashboard/campaigns" />}>
                            Open campaigns
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={toggleAmplified}>
                            {amplified ? "Exit amplified view" : "Amplified chat view"}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  <div className={cn(
                    "grid gap-3 rounded-xl border border-border p-3 text-sm sm:grid-cols-2 xl:grid-cols-[1fr_1.4fr_1fr_auto_auto] xl:items-center",
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
                      <MessageScrollerViewport className={cn("px-4 py-4", amplified && "mx-auto w-full max-w-5xl px-5 sm:px-8")}>
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
                                              amplified ? "max-w-[min(42rem,88%)]" : "max-w-[80%]",
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

                <div className={cn("border-t border-border p-3", amplified && "mx-auto w-full max-w-5xl px-5 sm:px-8")}>
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
                    <div className="space-y-3">
                      <Tabs value={composerTab} onValueChange={(value) => setComposerTab(value as "reply" | "draft")}>
                        <TabsList variant="line" className="justify-start gap-1 rounded-none p-0">
                          <TabsTrigger value="reply" className="px-3 py-2">Reply</TabsTrigger>
                          <TabsTrigger value="draft" className="gap-2 px-3 py-2">
                            AI Draft
                            {!draftSeen ? <Badge className="bg-onboarding-purple-500 text-white">New</Badge> : null}
                          </TabsTrigger>
                        </TabsList>
                      </Tabs>

                      <Textarea
                        value={message}
                        onChange={(event) => setMessage(event.target.value)}
                        placeholder={composerTab === "draft" ? "Generate or edit an AI draft..." : "Type your message..."}
                        className={cn("min-h-24", amplified && "min-h-36")}
                      />

                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs text-muted-foreground">
                          Send as {detail.sender?.accountName || "LinkedIn account"}
                          {detail.senderLimit ? ` · ${detail.senderLimit.remaining}/${detail.senderLimit.limit} remaining today` : ""}
                        </p>
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="outline" disabled={isDrafting || isLimitReached} onClick={() => void generateDraft()}>
                            {isDrafting ? <Loader2 className="animate-spin" /> : <Sparkles />}
                            Use AI to draft
                          </Button>
                          <div className="flex overflow-hidden rounded-lg">
                            <Button
                              size="sm"
                              variant="brand"
                              className="rounded-r-none"
                              disabled={isSending || !message.trim() || isLimitReached}
                              onClick={() => void sendReply()}
                            >
                              {isSending ? <Loader2 className="animate-spin" /> : <Send />}
                              Send
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                render={
                                  <Button
                                    size="sm"
                                    variant="brand"
                                    className="rounded-l-none border-l border-white/20 px-2"
                                    disabled={isSending || !message.trim() || isLimitReached}
                                    aria-label="Send options"
                                  />
                                }
                              >
                                <ChevronDown className="size-3.5" />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem disabled={isSending || !message.trim() || isLimitReached} onClick={() => void sendReply()}>
                                  Send now
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
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
