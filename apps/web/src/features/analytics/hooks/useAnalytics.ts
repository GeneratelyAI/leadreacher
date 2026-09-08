"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { AnalyticsResponse, AnalyticsInsights } from "../state/analytics-model";

export function useAnalytics() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const startDate = searchParams.get("startDate") ?? "";
  const endDate = searchParams.get("endDate") ?? "";
  const channelsParam = searchParams.get("channels") ?? "";
  const campaignIdParam = searchParams.get("campaignId") ?? "";

  const selectedChannels = useMemo(
    () =>
      [...new Set(channelsParam.split(",").map((value) => value.trim()).filter(Boolean))],
    [channelsParam],
  );

  const [campaignFilter, setCampaignFilter] = useState(campaignIdParam);
  const [granularity, setGranularity] = useState<"day" | "week">("day");

  useEffect(() => {
    setCampaignFilter(campaignIdParam);
  }, [campaignIdParam]);

  const setSelectedChannels = useCallback(
    (next: string[]) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next.length === 0) params.delete("channels");
      else params.set("channels", next.join(","));
      const query = params.toString();
      router.replace(query ? `/dashboard/analytics?${query}` : "/dashboard/analytics");
    },
    [router, searchParams],
  );

  const setCampaignFilterAndUrl = useCallback(
    (next: string) => {
      setCampaignFilter(next);
      const params = new URLSearchParams(searchParams.toString());
      if (!next) params.delete("campaignId");
      else params.set("campaignId", next);
      const query = params.toString();
      router.replace(query ? `/dashboard/analytics?${query}` : "/dashboard/analytics");
    },
    [router, searchParams],
  );

  const analyticsParams = useMemo(() => {
    const params = new URLSearchParams({ granularity });
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    if (campaignFilter) params.set("campaignId", campaignFilter);
    if (selectedChannels.length === 1) params.set("channels", selectedChannels[0] ?? "");
    else if (selectedChannels.length > 1) params.set("channels", selectedChannels.join(","));
    return params.toString();
  }, [campaignFilter, endDate, granularity, selectedChannels, startDate]);
  const analyticsQuery = useQuery({
    queryKey: ["dashboard", "analytics", analyticsParams],
    queryFn: () => apiFetch<AnalyticsResponse>(`/dashboard/analytics?${analyticsParams}`),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
  const insightsQuery = useQuery({
    queryKey: ["dashboard", "analytics-insights"],
    queryFn: () => apiFetch<AnalyticsInsights>("/dashboard/analytics/insights"),
    staleTime: 30_000,
    refetchInterval: (query) => query.state.data?.status === "aggregating" ? 2_500 : false,
  });
  const analytics = analyticsQuery.data ?? null;
  const insights = insightsQuery.data ?? null;
  const isLoading = analyticsQuery.isLoading && !analyticsQuery.data;
  const isRefreshing = analyticsQuery.isFetching && !!analyticsQuery.data;
  const error = analyticsQuery.error instanceof Error ? analyticsQuery.error.message : null;

  return { analytics, insights, isLoading, isRefreshing, error, campaignFilter, selectedChannels, granularity, setGranularity, setSelectedChannels, setCampaignFilterAndUrl };
}
