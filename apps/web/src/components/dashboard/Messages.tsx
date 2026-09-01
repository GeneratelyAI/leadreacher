"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  BellDot,
  ChevronDown,
  ChevronLeft,
  CircleCheck,
  Inbox as InboxIcon,
  Loader2,
  Megaphone,
  MessageSquare,
  MoreHorizontal,
  Search,
  Send,
  Sparkles,
} from "@/components/ui/icons";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Filter as VisualFilter, type FilterGroup } from "@/components/dashboard/Filter";
import { VideoAttachment } from "@/components/dashboard/VideoAttachment";
import { useDashboardEvents } from "@/components/providers/DashboardDataProvider";
import { ChannelLogo } from "@/components/onboarding/ChannelLogo";
import { channelDisplayName, DashboardChannelLogo } from "@/components/dashboard/ChannelIdentity";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button } from "@/components/ui/Button";
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
  channel: string;
  prospect: { name: string; title: string; company: string; avatarUrl: string | null };
  campaign: { id: string; name: string };
  sender: { id: string; accountName: string; avatarUrl: string | null; platform: string; status: string; unipileId: string | null } | null;
  latestMessage: { id: string; content: string; direction: string; origin: string; occurredAt: string };
  unreadCount: number;
  needsReply: boolean;
};

type ConversationDetail = {
  id: string;
  leadId: string;
  status: string;
  chatId: string | null;
  channel: string;
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
  sender: { id: string; accountName: string; avatarUrl: string | null; platform: string; status: string; unipileId: string | null } | null;
  senderLimit: { limit: number; remaining: number; resetAt: string } | null;
  canReply: boolean;
  canStartConversation: boolean;
  nextCursor: string | null;
  messages: Array<{
    id: string;
    channel: string;
    direction: string;
    origin: string;
    status: string;
    content: { message: string; attachments: Array<{ type: string; videoUrl?: string; thumbnailUrl?: string; filename?: string }> };
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

const PAGE_SIZE = 25;

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
        className="mt-0.5 inline-flex min-w-5 shrink-0 items-center justify-center rounded-full bg-onboarding-error-700 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white"
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

function InboxNavigation({
  state,
  counts,
  onStateChange,
  channels,
  channelFilter,
  onChannelFilterChange,
}: {
  state: ConversationState;
  counts: ConversationListResponse["counts"];
  onStateChange: (state: ConversationState) => void;
  channels: string[];
  channelFilter: string;
  onChannelFilterChange: (channel: string) => void;
}) {
  const navigationItems: Array<{
    value: ConversationState;
    label: string;
    count: number;
    icon: typeof InboxIcon;
  }> = [
    { value: "all", label: "All messages", count: counts.all, icon: InboxIcon },
    { value: "unread", label: "Unread", count: counts.unread, icon: BellDot },
    { value: "needs_reply", label: "Needs reply", count: counts.needsReply, icon: CircleCheck },
  ];

  return (
    <aside className="messages-inbox-rail hidden h-full min-w-0 w-full flex-col border-r border-border bg-muted/20">
      <div className="border-b border-border px-4 py-4">
        <p className="text-base font-semibold text-foreground">Inbox</p>
      </div>
      <nav className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-2 py-3" aria-label="Inbox navigation">
        <div className="space-y-1">
          {navigationItems.map(({ value, label, count, icon: Icon }) => {
            const active = state === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => onStateChange(value)}
                className={cn(
                  "flex h-9 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-sm transition-colors",
                  active
                    ? "bg-onboarding-purple-50 font-medium text-onboarding-purple-700 dark:bg-onboarding-purple-900/35 dark:text-onboarding-purple-100"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                <span className="min-w-0 flex-1 truncate">{label}</span>
                <span className="text-xs tabular-nums text-muted-foreground">{count}</span>
              </button>
            );
          })}
        </div>

        {channels.length ? (
          <div className="space-y-1">
            <p className="px-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Channels</p>
            <button
              type="button"
              onClick={() => onChannelFilterChange("")}
              className={cn(
                "flex h-9 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-sm transition-colors",
                !channelFilter
                  ? "bg-onboarding-purple-50 font-medium text-onboarding-purple-700 dark:bg-onboarding-purple-900/35 dark:text-onboarding-purple-100"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <MessageSquare className="size-4 shrink-0" aria-hidden />
              <span className="truncate">All channels</span>
            </button>
            {channels.map((channel) => {
              const active = channel === channelFilter;
              return (
                <button
                  key={channel}
                  type="button"
                  onClick={() => onChannelFilterChange(channel)}
                  className={cn(
                    "flex h-9 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-sm transition-colors",
                    active
                      ? "bg-onboarding-purple-50 font-medium text-onboarding-purple-700 dark:bg-onboarding-purple-900/35 dark:text-onboarding-purple-100"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <DashboardChannelLogo platform={channel} className="size-4" />
                  <span className="min-w-0 flex-1 truncate">{channelDisplayName(channel)}</span>
                </button>
              );
            })}
          </div>
        ) : null}
      </nav>
    </aside>
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
  platform: string;
  messages: FeedMessage[];
};
type FeedItem = FeedMarker | FeedGroup;

function buildFeedItems(
  messages: ConversationDetail["messages"],
  prospect: { name: string; avatarUrl: string | null },
  sender: { accountName: string; avatarUrl: string | null } | null,
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
    const name = inbound ? prospect.name : sender?.accountName || "You";
    const url = inbound ? prospect.avatarUrl : sender?.avatarUrl ?? null;

    if (!openGroup || openGroup.align !== align) {
      flushGroup();
      openGroup = {
        kind: "group",
        id: `group-${message.id}`,
        align,
        senderName: name,
        senderUrl: url,
        platform: message.channel,
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

export function Messages({ conversationId }: { conversationId?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const routedConversationId = conversationId ?? searchParams.get("conversationId");
  const [selectedId, setSelectedId] = useState<string | null>(routedConversationId);
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [message, setMessage] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const [query, setQuery] = useState("");
  const [state, setState] = useState<ConversationState>(() => {
    const raw = searchParams.get("state");
    return raw === "unread" || raw === "needs_reply" ? raw : "all";
  });
  const [campaignFilter, setCampaignFilter] = useState(() => searchParams.get("campaignId") ?? "");
  const [channelFilter, setChannelFilter] = useState(() => searchParams.get("channel") ?? "");
  const [sortMode, setSortMode] = useState<SortMode>("last_activity");
  const [composerTab, setComposerTab] = useState<"reply" | "draft">("reply");
  const [draftSeen, setDraftSeen] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isDrafting, setIsDrafting] = useState(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const liveState: "connecting" | "live" | "polling" = "live";
  const [failedMessage, setFailedMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [limitError, setLimitError] = useState<string | null>(null);
  const [amplified, setAmplified] = useState(false);
  const conversationListRef = useRef<HTMLDivElement | null>(null);
  const conversationListEndRef = useRef<HTMLDivElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const latestInboundByConversationRef = useRef(new Map<string, string | null>());
  const queryClient = useQueryClient();
  const debouncedQuery = useDebouncedValue(query.trim(), 300);

  const conversationParams = useMemo(() => {
    const params = new URLSearchParams({
      state,
      limit: String(PAGE_SIZE),
    });
    if (debouncedQuery) params.set("query", debouncedQuery);
    if (campaignFilter) params.set("campaignId", campaignFilter);
    if (channelFilter) params.set("channel", channelFilter);
    return params.toString();
  }, [campaignFilter, channelFilter, debouncedQuery, state]);

  const conversationsQuery = useInfiniteQuery({
    queryKey: ["dashboard", "conversations", conversationParams],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams(conversationParams);
      params.set("offset", String(pageParam));
      return apiFetch<ConversationListResponse>(`/dashboard/conversations?${params.toString()}`);
    },
    getNextPageParam: (lastPage) => {
      const nextOffset = lastPage.offset + lastPage.limit;
      return nextOffset < lastPage.total ? nextOffset : undefined;
    },
    staleTime: 30_000,
    refetchInterval: false,
    refetchIntervalInBackground: false,
  });
  const {
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = conversationsQuery;
  const campaignsQuery = useQuery({
    queryKey: ["campaigns", "options"],
    queryFn: () => apiFetch<{ campaigns: CampaignOption[] }>("/campaigns"),
    staleTime: 60_000,
  });

  const conversations = useMemo(() => {
    const rows = conversationsQuery.data?.pages.flatMap((page) => page.conversations) ?? [];
    if (sortMode !== "unread_first") return rows;
    return [...rows].sort((left, right) => {
      if (right.unreadCount !== left.unreadCount) return right.unreadCount - left.unreadCount;
      return new Date(right.latestMessage.occurredAt).getTime() - new Date(left.latestMessage.occurredAt).getTime();
    });
  }, [conversationsQuery.data?.pages, sortMode]);
  const counts = conversationsQuery.data?.pages[0]?.counts ?? { all: 0, unread: 0, needsReply: 0 };
  const campaigns = campaignsQuery.data?.campaigns ?? [];
  const isLoading = conversationsQuery.isLoading && !conversationsQuery.data;
  const error = actionError ?? (conversationsQuery.error instanceof Error ? conversationsQuery.error.message : null);

  useEffect(() => {
    if (!amplified) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setAmplified(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [amplified]);

  function toggleAmplified() {
    setAmplified((current) => !current);
  }

  const showListSidebar = !amplified;

  useEffect(() => {
    if (!conversationsQuery.data) return;
    setSelectedId((current) => {
      if (routedConversationId) return routedConversationId;
      if (current && conversations.some((row) => row.id === current)) return current;
      // The API returns conversations newest first, so the Messages route opens the latest thread.
      return conversations[0]?.id ?? null;
    });
  }, [conversations, conversationsQuery.data, routedConversationId]);

  useEffect(() => {
    const root = conversationListRef.current;
    const target = conversationListEndRef.current;
    if (!root || !target || !hasNextPage) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && !isFetchingNextPage) {
          void fetchNextPage();
        }
      },
      { root, rootMargin: "160px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  useEffect(() => {
    setSelectedId(routedConversationId ?? null);
  }, [routedConversationId]);

  const playReplySound = useCallback(() => {
    if (document.visibilityState !== "visible") return;
    const AudioContextConstructor = window.AudioContext;
    const context = audioContextRef.current ?? new AudioContextConstructor();
    audioContextRef.current = context;
    void context.resume().then(() => {
      const start = context.currentTime;
      for (const [offset, frequency] of [[0, 660], [0.1, 880]] as const) {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = "sine";
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0.0001, start + offset);
        gain.gain.exponentialRampToValueAtTime(0.08, start + offset + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.11);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(start + offset);
        oscillator.stop(start + offset + 0.12);
      }
    }).catch(() => undefined);
  }, []);

  const loadDetail = useCallback(async (id: string, background = false) => {
    const queryKey = ["dashboard", "conversation", id] as const;
    const cached = queryClient.getQueryData<{ conversation: ConversationDetail }>(queryKey);

    if (cached) {
      setDetail(cached.conversation);
      setIsDetailLoading(false);
    } else if (!background) {
      setIsDetailLoading(true);
    }

    try {
      const result = await queryClient.fetchQuery({
        queryKey,
        queryFn: () => apiFetch<{ conversation: ConversationDetail }>(`/dashboard/conversations/${id}`),
        staleTime: background ? 0 : 30_000,
      });
      const latestInbound = [...result.conversation.messages].reverse().find((item) => item.direction === "inbound")?.id ?? null;
      const previousInbound = latestInboundByConversationRef.current.get(id);
      if (background && latestInbound && previousInbound !== undefined && previousInbound !== latestInbound) {
        playReplySound();
      }
      latestInboundByConversationRef.current.set(id, latestInbound);
      setDetail(result.conversation);
      setLimitError(null);
      if (!background) {
        setMessage(window.localStorage.getItem(`leadreacher-chat-draft:${id}`) ?? "");
        setComposerTab("reply");
        setDraftSeen(false);
        setIdempotencyKey(crypto.randomUUID());
      }
    } catch (requestError) {
      if (!background) {
        setActionError(requestError instanceof Error ? requestError.message : "Unable to load conversation.");
      }
    } finally {
      if (!background) setIsDetailLoading(false);
    }
  }, [playReplySound, queryClient]);

  useEffect(() => {
    if (!selectedId) return;
    const key = `leadreacher-chat-draft:${selectedId}`;
    if (message) window.localStorage.setItem(key, message);
    else window.localStorage.removeItem(key);
  }, [message, selectedId]);

  useDashboardEvents(useCallback((event) => {
    if (event.type !== "conversation.updated" || !selectedId) return;
    if (event.resources.campaignLeadId === selectedId) void loadDetail(selectedId, true);
  }, [loadDetail, selectedId]));

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId);
    else setDetail(null);
  }, [loadDetail, selectedId]);


  async function loadOlderMessages() {
    if (!detail?.nextCursor || isLoadingOlder) return;
    setIsLoadingOlder(true);
    try {
      const result = await apiFetch<{ messages: ConversationDetail["messages"]; nextCursor: string | null }>(
        `/dashboard/conversations/${detail.id}/messages?cursor=${encodeURIComponent(detail.nextCursor)}&limit=50`,
      );
      setDetail((current) => current ? {
        ...current,
        messages: [...result.messages, ...current.messages],
        nextCursor: result.nextCursor,
      } : current);
    } finally {
      setIsLoadingOlder(false);
    }
  }

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
    const sentMessage = message.trim();
    const temporaryId = `pending:${idempotencyKey}`;
    const occurredAt = new Date().toISOString();
    setDetail((current) => current ? {
      ...current,
      messages: [...current.messages, {
        id: temporaryId,
        channel: current.channel,
        direction: "outbound",
        origin: "operator",
        status: "queued",
        content: { message: sentMessage, attachments: [] },
        occurredAt,
      }],
    } : current);
    setMessage("");
    window.localStorage.removeItem(`leadreacher-chat-draft:${detail.id}`);
    setIsSending(true);
    setLimitError(null);
    try {
      const action = detail.canStartConversation ? "start" : "replies";
      await apiFetch(`/dashboard/conversations/${detail.id}/${action}`, {
        method: "POST",
        body: JSON.stringify({ message: sentMessage, idempotencyKey }),
      });
      setDetail((current) => current ? {
        ...current,
        messages: current.messages.map((item) => item.id === temporaryId ? { ...item, status: "sent" } : item),
      } : current);
      setFailedMessage(null);
      setIdempotencyKey(crypto.randomUUID());
      setComposerTab("reply");
      void conversationsQuery.refetch();
      void queryClient.invalidateQueries({ queryKey: ["dashboard", "chrome"] });
      void loadDetail(detail.id, true);
    } catch (requestError) {
      setDetail((current) => current ? {
        ...current,
        messages: current.messages.map((item) => item.id === temporaryId ? { ...item, status: "failed" } : item),
      } : current);
      setFailedMessage(sentMessage);
      if (requestError instanceof ApiError && requestError.code === "daily_message_limit") {
        const resetAt = requestError.details?.resetAt;
        const resetMessage = typeof resetAt === "string"
          ? `Daily LinkedIn message limit reached. Sending resets at ${new Intl.DateTimeFormat(undefined, {
              hour: "numeric",
              minute: "2-digit",
            }).format(new Date(resetAt))}.`
          : requestError.message;
        setLimitError(resetMessage);
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

  const feedItems = useMemo(
    () =>
      detail
        ? buildFeedItems(
            detail.messages,
            detail.prospect,
            detail.sender,
          )
        : [],
    [detail],
  );
  const resetTime = detail?.senderLimit
    ? new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(detail.senderLimit.resetAt))
    : null;
  const isLimitReached = Boolean(detail?.senderLimit && detail.senderLimit.remaining <= 0);
  const availableChannels = useMemo(
    () => [...new Set(conversations.map((conversation) => conversation.channel))].sort(),
    [conversations],
  );
  const campaignFilterGroups: FilterGroup[] = campaigns.length
    ? [{
      label: "Campaigns",
      options: campaigns.map((campaign) => ({
        value: campaign.id,
        label: campaign.name,
      })),
    }]
    : [];
  const channelFilterGroups: FilterGroup[] = availableChannels.length
    ? [{
      label: "Channels",
      options: availableChannels.map((channel) => ({
        value: channel,
        label: channelDisplayName(channel),
        icon: <DashboardChannelLogo platform={channel} className="size-5" />,
      })),
    }]
    : [];

  function selectConversation(id: string) {
    setSelectedId(id);
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("conversationId", id);
    router.push(`/dashboard/messages?${nextParams.toString()}`);
  }

  function backToList() {
    setSelectedId(null);
    setDetail(null);
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete("conversationId");
    const query = nextParams.toString();
    router.push(query ? `/dashboard/messages?${query}` : "/dashboard/messages");
  }

  const mobileThreadOpen = Boolean(selectedId);

  return (
    <div
      className={cn(
        "flex flex-col",
        amplified
          ? "fixed inset-x-0 bottom-[var(--dashboard-bottom-nav-height,0px)] top-[4.75rem] z-30 bg-onboarding-neutral-0 p-3 sm:p-4 dark:bg-onboarding-neutral-950 lg:bottom-0 lg:left-[var(--dashboard-sidebar-width)]"
          : "h-full min-h-0 gap-0",
      )}
    >
      {error ? (
        <div role="alert" className="mx-4 mb-3 rounded-lg border border-onboarding-error-200 bg-onboarding-error-50 px-4 py-3 text-sm text-onboarding-error-700 lg:mx-0 dark:border-onboarding-error-500/40 dark:bg-onboarding-error-500/15 dark:text-onboarding-error-100">
          {error}
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div
          className={cn(
            "messages-workspace flex min-h-0 flex-1 flex-col",
            amplified && "messages-workspace--amplified",
          )}
        >
          {!amplified ? (
            <InboxNavigation
              state={state}
              counts={counts}
              onStateChange={setState}
              channels={availableChannels}
              channelFilter={channelFilter}
              onChannelFilterChange={setChannelFilter}
            />
          ) : null}
          <div
            className={cn(
              "messages-conversation-list relative flex min-h-0 flex-col overflow-hidden transition-[width,height,opacity] duration-200 ease-out",
              showListSidebar
                ? "h-full w-full border-r border-border opacity-100"
                : "pointer-events-none h-0 w-0 border-0 opacity-0 lg:h-full",
              mobileThreadOpen && "max-[479px]:hidden",
            )}
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 right-0 z-20 w-px bg-onboarding-neutral-300 dark:bg-onboarding-neutral-700"
            />
            <aside className="flex h-full min-h-0 w-full flex-col">
            <div className="space-y-2.5 border-b border-border px-3 py-3">
              <div className="flex items-center justify-between gap-2">
                <Tabs value={state} onValueChange={(value) => setState(value as ConversationState)} className="min-w-0 flex-1 min-[480px]:hidden">
                  <TabsList variant="line" className="w-full justify-start gap-0 overflow-hidden rounded-none p-0">
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
                <p className="hidden min-w-0 flex-1 truncate text-sm font-semibold text-foreground min-[480px]:block">Messages</p>
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
                <VisualFilter
                  value={channelFilter}
                  groups={channelFilterGroups}
                  onValueChange={setChannelFilter}
                  allLabel="All channels"
                  allIcon={<MessageSquare className="size-5" aria-hidden />}
                  aria-label="Filter conversations by channel"
                  className="h-9 min-w-0 max-w-44 px-2.5 text-xs lg:hidden"
                  menuWidth="22rem"
                />
                <VisualFilter
                  value={campaignFilter}
                  groups={campaignFilterGroups}
                  onValueChange={setCampaignFilter}
                  allLabel="All campaigns"
                  allIcon={<Megaphone className="size-5" aria-hidden />}
                  aria-label="Filter conversations by campaign"
                  className="h-9 min-w-0 max-w-48 px-2.5 text-xs"
                  menuWidth="22rem"
                />

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

            <div ref={conversationListRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
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
                          onPointerEnter={() => {
                            void queryClient.prefetchQuery({
                              queryKey: ["dashboard", "conversation", conversation.id],
                              queryFn: () => apiFetch<{ conversation: ConversationDetail }>(`/dashboard/conversations/${conversation.id}`),
                              staleTime: 30_000,
                            });
                          }}
                          onFocus={() => {
                            void queryClient.prefetchQuery({
                              queryKey: ["dashboard", "conversation", conversation.id],
                              queryFn: () => apiFetch<{ conversation: ConversationDetail }>(`/dashboard/conversations/${conversation.id}`),
                              staleTime: 30_000,
                            });
                          }}
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
                              <DashboardChannelLogo platform={conversation.channel} accountName={conversation.sender?.accountName} className="mr-1 inline-flex size-3.5 align-[-2px]" />
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
              <div ref={conversationListEndRef} className="flex h-12 items-center justify-center" aria-live="polite">
                {isFetchingNextPage ? (
                  <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Loading more conversations" />
                ) : null}
              </div>
            </div>
            </aside>
          </div>
          <main
            className={cn(
              "messages-thread flex min-h-0 min-w-0 flex-1 flex-col",
              !mobileThreadOpen && "max-[479px]:hidden",
            )}
          >
            {isDetailLoading && !detail ? (
              <div className="relative flex flex-1 items-center justify-center text-sm text-muted-foreground">
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
                      <PersonAvatar name={detail.prospect.name} url={detail.prospect.avatarUrl} size="lg" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h2 className="truncate text-base font-semibold lg:text-lg">{detail.prospect.name}</h2>
                          <Badge variant="secondary" className="hidden gap-1.5 capitalize sm:inline-flex">
                            <DashboardChannelLogo platform={detail.channel} accountName={detail.sender?.accountName} className="size-3.5" />
                            {channelDisplayName(detail.channel, detail.sender?.accountName)}
                          </Badge>
                          <span className="hidden size-2 rounded-full bg-onboarding-success-500 lg:inline-flex" aria-hidden />
                          <span className="hidden text-[10px] font-medium text-muted-foreground lg:inline">
                            {liveState === "live" ? "Live" : liveState === "connecting" ? "Connecting" : "Reconnecting"}
                          </span>
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
                      <DropdownMenu>
                        <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="size-10 lg:size-8" aria-label="Conversation actions" />}>
                          <MoreHorizontal weight="regular" />
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

                </div>

                <div className="min-h-0 flex-1">
                  <MessageScrollerProvider>
                    <MessageScroller className="h-full">
                      <MessageScrollerViewport className={cn("px-3 py-3 lg:px-4 lg:py-4", amplified && "mx-auto w-full max-w-5xl px-5 sm:px-8")}>
                        <MessageScrollerContent>
                          {detail.nextCursor ? (
                            <div className="flex justify-center pb-3">
                              <Button variant="ghost" size="sm" disabled={isLoadingOlder} onClick={() => void loadOlderMessages()}>
                                {isLoadingOlder ? <Loader2 className="animate-spin" /> : null}
                                Load older messages
                              </Button>
                            </div>
                          ) : null}
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
                                            <span className="relative inline-flex">
                                              <PersonAvatar
                                                name={item.senderName}
                                                url={item.senderUrl}
                                                size="sm"
                                              />
                                              <DashboardChannelLogo
                                                platform={item.platform}
                                                accountName={item.senderName}
                                                className="absolute -right-1 -bottom-1 size-3.5 rounded-sm ring-2 ring-background"
                                              />
                                            </span>
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
                                              <VideoAttachment
                                                key={attachment.videoUrl}
                                                src={attachment.videoUrl!}
                                                poster={attachment.thumbnailUrl}
                                                filename={attachment.filename}
                                              />
                                            ))}
                                          <MessageFooter>
                                            {entry.message.direction === "inbound" ? "Received" : titleCase(entry.message.status)} via {titleCase(entry.message.channel)} · {relativeTimeLong(entry.message.occurredAt)}
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

                <div className={cn("dashboard-chat-composer shrink-0 border-t border-border bg-onboarding-neutral-0 p-3 dark:bg-onboarding-neutral-900", amplified && "mx-auto w-full max-w-5xl px-5 sm:px-8")}>
                  {limitError || isLimitReached ? (
                    <p className="mb-2 text-xs font-medium text-onboarding-warning-900 dark:text-onboarding-warning-150">
                      {limitError || `Daily LinkedIn message limit reached. Sending resets at ${resetTime}.`}
                    </p>
                  ) : null}
                  {failedMessage ? (
                    <div className="mb-2 flex items-center justify-between gap-3 rounded-md bg-onboarding-error-50 px-3 py-2 text-xs text-onboarding-error-700 dark:bg-onboarding-error-950 dark:text-onboarding-error-200">
                      <span>Message failed to send.</span>
                      <Button variant="ghost" size="sm" onClick={() => { setMessage(failedMessage); setFailedMessage(null); setIdempotencyKey(crypto.randomUUID()); }}>
                        Retry
                      </Button>
                    </div>
                  ) : null}

                  {!detail.canReply && !detail.canStartConversation ? (
                    <p className="text-sm text-muted-foreground">
                      A real inbound reply and an active campaign sender are required before an operator can reply.
                    </p>
                  ) : (
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        {detail.canStartConversation ? (
                          <p className="text-sm font-medium">Start conversation</p>
                        ) : (
                          <>
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
                          </>
                        )}
                      </div>

                      <Textarea
                        value={message}
                        onChange={(event) => setMessage(event.target.value)}
                        placeholder={detail.canStartConversation ? "Write the first LinkedIn message..." : composerTab === "draft" ? "Generate or edit an AI draft..." : "Type your message..."}
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
                <MessageSquare className="size-8 text-muted-foreground" />
                <h2 className="mt-3 font-semibold">Choose a conversation</h2>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  Select a conversation to view the full message history and prospect context.
                </p>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
