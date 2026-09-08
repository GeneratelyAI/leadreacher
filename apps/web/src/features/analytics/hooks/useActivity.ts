"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { groupByDay } from "../state/activity-format";
import { PAGE_SIZE, type ActivityTab, type ActivityResponse } from "../state/activity-model";

export function useActivity() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const startDate = searchParams.get("startDate") ?? "";
  const endDate = searchParams.get("endDate") ?? "";

  const [kind, setKind] = useState<ActivityTab>(() => {
    const value = searchParams.get("kind");
    if (value === "message" || value === "prospect" || value === "video" || value === "campaign") return value;
    return "all";
  });
  const [page, setPage] = useState(1);
  const [channelFilter, setChannelFilter] = useState("");
  const [campaignFilter, setCampaignFilter] = useState(() => searchParams.get("campaignId") ?? "");
  const activityParams = useMemo(() => {
    const params = new URLSearchParams({
      kind,
      limit: String(PAGE_SIZE),
      offset: String((page - 1) * PAGE_SIZE),
    });
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    if (channelFilter) params.set("channel", channelFilter);
    if (campaignFilter) params.set("campaignId", campaignFilter);
    return params.toString();
  }, [campaignFilter, channelFilter, endDate, kind, page, startDate]);
  const activityQuery = useQuery({
    queryKey: ["dashboard", "activity", activityParams],
    queryFn: () => apiFetch<ActivityResponse>(`/dashboard/activity?${activityParams}`),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
  const activity = useMemo(() => activityQuery.data?.activity ?? [], [activityQuery.data?.activity]);
  const total = activityQuery.data?.total ?? 0;
  const summary = activityQuery.data?.summary ?? null;
  const campaigns = activityQuery.data?.filters.campaigns ?? [];
  const channels = activityQuery.data?.filters.channels ?? [];
  const isLoading = activityQuery.isLoading && !activityQuery.data;
  const isRefreshing = activityQuery.isFetching && !!activityQuery.data;
  const error = activityQuery.error instanceof Error ? activityQuery.error.message : null;

  useEffect(() => {
    setPage(1);
  }, [kind, channelFilter, campaignFilter, startDate, endDate]);

  useEffect(() => {
    if (total <= page * PAGE_SIZE) return;
    const nextParams = new URLSearchParams(activityParams);
    nextParams.set("offset", String(page * PAGE_SIZE));
    const nextPageParams = nextParams.toString();
    void queryClient.prefetchQuery({
      queryKey: ["dashboard", "activity", nextPageParams],
      queryFn: () => apiFetch<ActivityResponse>(`/dashboard/activity?${nextPageParams}`),
      staleTime: 30_000,
    });
  }, [activityParams, page, queryClient, total]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const dayGroups = useMemo(() => groupByDay(activity), [activity]);

  function setVisualFilter(next: string) {
    if (!next) {
      setChannelFilter("");
      setCampaignFilter("");
      return;
    }
    if (next.startsWith("channel:")) {
      setChannelFilter(next.slice("channel:".length));
      setCampaignFilter("");
      return;
    }
    setCampaignFilter(next.slice("campaign:".length));
    setChannelFilter("");
  }

  return { activity, total, summary, campaigns, channels, isLoading, isRefreshing, error, pageCount, dayGroups, kind, setKind, page, setPage, channelFilter, campaignFilter, setVisualFilter };
}
