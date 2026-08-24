"use client";

import { dehydrate, hydrate, keepPreviousData, QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { apiStream } from "@/lib/api";

const DASHBOARD_EVENT_TYPES = new Set([
  "campaign.updated",
  "campaign.metrics.updated",
  "conversation.updated",
  "channel.updated",
  "video.updated",
  "activity.created",
]);
const STREAM_RECONNECT_DELAY_MS = 5_000;
const STREAM_FALLBACK_REFETCH_MS = 30_000;
const DASHBOARD_CACHE_TTL_MS = 10 * 60_000;
// v2 discards caches created while pending prefetches were serializable. A
// pending query can reject after hydration and makes React Query report an
// unhandled dehydration error even though the view can recover normally.
const DASHBOARD_CACHE_VERSION = "v2";
const PERSISTED_DASHBOARD_QUERY_TYPES = new Set([
  "chrome",
  "overview",
  "campaigns",
  "campaign",
  "prospects",
  "prospect",
  "conversations",
  "conversation",
  "activity",
  "channels",
  "analytics",
]);

export type DashboardEvent = {
  version: 1;
  id: string;
  orgId: string;
  type: "campaign.updated" | "campaign.metrics.updated" | "conversation.updated" | "channel.updated" | "video.updated" | "activity.created";
  resources: { campaignId?: string; campaignLeadId?: string; socialAccountId?: string; videoAssetId?: string };
  occurredAt: string;
};

type DashboardEventListener = (event: DashboardEvent) => void;
type DashboardEventSubscription = (listener: DashboardEventListener) => () => void;

const DashboardEventsContext = createContext<DashboardEventSubscription | null>(null);

export function parseDashboardEvent(frame: string): DashboardEvent | null {
  const line = frame.split("\n").find((item) => item.startsWith("data: "));
  if (!line) return null;
  try {
    const value: unknown = JSON.parse(line.slice(6));
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const event = value as Partial<DashboardEvent>;
    return event.version === 1 && typeof event.id === "string" && typeof event.type === "string" && DASHBOARD_EVENT_TYPES.has(event.type) && event.resources && typeof event.resources === "object"
      ? event as DashboardEvent
      : null;
  } catch {
    return null;
  }
}

function DashboardLiveEvents({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const listeners = useRef(new Set<DashboardEventListener>());
  const subscribe = useCallback<DashboardEventSubscription>((listener) => {
    listeners.current.add(listener);
    return () => listeners.current.delete(listener);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let stopped = false;
    let reconnectTimer: number | undefined;
    let fallbackTimer: number | undefined;
    const invalidateActiveDashboardQueries = () => {
      void queryClient.invalidateQueries({
        predicate: (query) => Array.isArray(query.queryKey) && query.queryKey[0] === "dashboard",
      });
    };
    const startFallbackRefetch = () => {
      if (fallbackTimer) return;
      fallbackTimer = window.setInterval(invalidateActiveDashboardQueries, STREAM_FALLBACK_REFETCH_MS);
    };
    const stopFallbackRefetch = () => {
      if (!fallbackTimer) return;
      window.clearInterval(fallbackTimer);
      fallbackTimer = undefined;
    };
    const invalidate = (event: DashboardEvent) => {
      void queryClient.invalidateQueries({ queryKey: ["dashboard", "chrome"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard", "overview"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard", "activity"] });
      if (event.type === "conversation.updated") {
        void queryClient.invalidateQueries({ queryKey: ["dashboard", "conversations"] });
      }
      if (event.type === "campaign.updated" || event.type === "campaign.metrics.updated" || event.type === "video.updated") {
        void queryClient.invalidateQueries({ queryKey: ["dashboard", "campaigns"] });
        void queryClient.invalidateQueries({ queryKey: ["dashboard", "analytics"] });
      }
      if (event.type === "channel.updated") {
        void queryClient.invalidateQueries({ queryKey: ["dashboard", "channels"] });
        void queryClient.invalidateQueries({ queryKey: ["social-accounts"] });
      }
      listeners.current.forEach((listener) => listener(event));
    };
    const connect = async () => {
      try {
        const response = await apiStream("/dashboard/events", controller.signal);
        if (!response.body) throw new Error("Dashboard event stream unavailable");
        // A reconnect only restores the transport. Refreshing every active
        // dashboard query here makes an intermittent network or browser
        // lifecycle pause look like a full-page update. Persisted events below
        // are the source of truth for targeted invalidation.
        stopFallbackRefetch();
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (!stopped) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const frames = buffer.split("\n\n");
          buffer = frames.pop() ?? "";
          frames.map(parseDashboardEvent).filter((event): event is DashboardEvent => event !== null).forEach(invalidate);
        }
        if (!stopped) throw new Error("Dashboard event stream closed");
      } catch {
        if (!stopped && !controller.signal.aborted) {
          startFallbackRefetch();
          reconnectTimer = window.setTimeout(() => void connect(), STREAM_RECONNECT_DELAY_MS);
        }
      }
    };
    void connect();
    return () => {
      stopped = true;
      controller.abort();
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      stopFallbackRefetch();
    };
  }, [queryClient]);

  return <DashboardEventsContext.Provider value={subscribe}>{children}</DashboardEventsContext.Provider>;
}

export function useDashboardEvents(listener: DashboardEventListener): void {
  const subscribe = useContext(DashboardEventsContext);
  useEffect(() => (subscribe ? subscribe(listener) : undefined), [listener, subscribe]);
}

/**
 * Dashboard data is short-lived operational data. Keeping it fresh enough for
 * operators while retaining it during navigation avoids blank page reloads.
 */
function dashboardCacheKey(scope: string): string {
  return `leadreacher:dashboard-cache:${DASHBOARD_CACHE_VERSION}:${scope}`;
}

function shouldPersistDashboardQuery(queryKey: readonly unknown[]): boolean {
  return queryKey[0] === "dashboard"
    && typeof queryKey[1] === "string"
    && PERSISTED_DASHBOARD_QUERY_TYPES.has(queryKey[1]);
}

function restoreDashboardCache(queryClient: QueryClient, scope: string): void {
  if (typeof window === "undefined") return;
  try {
    const raw = window.sessionStorage.getItem(dashboardCacheKey(scope));
    if (!raw) return;
    const persisted = JSON.parse(raw) as { savedAt?: unknown; state?: unknown };
    if (typeof persisted.savedAt !== "number" || Date.now() - persisted.savedAt > DASHBOARD_CACHE_TTL_MS || !persisted.state) {
      window.sessionStorage.removeItem(dashboardCacheKey(scope));
      return;
    }
    hydrate(queryClient, persisted.state);
  } catch {
    window.sessionStorage.removeItem(dashboardCacheKey(scope));
  }
}

function DashboardHydrationFallback() {
  return (
    <div className="h-dvh bg-app-canvas" aria-busy="true" aria-label="Loading workspace">
      <div className="mx-auto flex h-full w-full max-w-[104rem] items-center justify-center px-4">
        <div className="h-5 w-36 animate-pulse rounded bg-onboarding-neutral-100 dark:bg-onboarding-neutral-800" />
      </div>
    </div>
  );
}

/**
 * Keeps operational data through a browser refresh without retaining it after
 * the session ends. Form state and settings are intentionally not persisted.
 */
export function DashboardDataProvider({ children, scope }: { children: ReactNode; scope: string }) {
  const [queryClient] = useState(
    () => new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 60_000,
          gcTime: 15 * 60_000,
          placeholderData: keepPreviousData,
          retry: 1,
          refetchOnWindowFocus: false,
          refetchOnReconnect: true,
        },
      },
    }),
  );
  const [cacheRestored, setCacheRestored] = useState(false);

  useEffect(() => {
    restoreDashboardCache(queryClient, scope);
    setCacheRestored(true);
  }, [queryClient, scope]);

  useEffect(() => {
    if (!cacheRestored) return;
    const key = dashboardCacheKey(scope);
    let writeTimer: number | undefined;
    const persist = () => {
      window.clearTimeout(writeTimer);
      writeTimer = window.setTimeout(() => {
        try {
          const state = dehydrate(queryClient, {
            // Persist data, never an in-flight request. Navigation prefetches
            // are intentionally optimistic and may fail independently of the
            // active page; dehydrating one as pending causes a later rejection
            // to surface as a React Query console error during hydration.
            shouldDehydrateQuery: (query) => (
              query.state.status === "success" && shouldPersistDashboardQuery(query.queryKey)
            ),
          });
          window.sessionStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), state }));
        } catch {
          window.sessionStorage.removeItem(key);
        }
      }, 200);
    };
    const unsubscribe = queryClient.getQueryCache().subscribe(persist);
    persist();
    void queryClient.invalidateQueries({
      predicate: (query) => shouldPersistDashboardQuery(query.queryKey),
      refetchType: "active",
    });
    return () => {
      window.clearTimeout(writeTimer);
      unsubscribe();
    };
  }, [cacheRestored, queryClient, scope]);

  return (
    <QueryClientProvider client={queryClient}>
      {cacheRestored ? <DashboardLiveEvents>{children}</DashboardLiveEvents> : <DashboardHydrationFallback />}
    </QueryClientProvider>
  );
}
