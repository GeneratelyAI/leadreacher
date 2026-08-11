"use client";

import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
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
    let hasConnected = false;
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
        if (hasConnected) invalidateActiveDashboardQueries();
        hasConnected = true;
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
export function DashboardQueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            gcTime: 5 * 60_000,
            retry: 1,
            refetchOnWindowFocus: true,
          },
        },
      }),
  );

  return <QueryClientProvider client={queryClient}><DashboardLiveEvents>{children}</DashboardLiveEvents></QueryClientProvider>;
}
