"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ApiError, apiFetch } from "@/lib/api";
import type { OverviewMode, DashboardOverview, AnalyticsResponse } from "../state/overview-model";

const MODE_STORAGE_KEY = "leadreacher.overview-mode";

export function useOverview() {
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<OverviewMode>("casual");
  const rangeQuery = useMemo(() => {
    const query = new URLSearchParams();
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    if (startDate && endDate) { query.set("startDate", startDate); query.set("endDate", endDate); }
    return query.toString();
  }, [searchParams]);

  useEffect(() => {
    const saved = window.localStorage.getItem(MODE_STORAGE_KEY);
    if (saved === "advanced") setMode("advanced");
  }, []);

  function updateMode(next: OverviewMode) {
    setMode(next);
    window.localStorage.setItem(MODE_STORAGE_KEY, next);
  }

  const overviewQuery = useQuery({ queryKey: ["dashboard", "overview", rangeQuery], queryFn: () => apiFetch<DashboardOverview>(`/dashboard/overview?${rangeQuery}`), placeholderData: keepPreviousData, staleTime: 30_000 });
  const analyticsQuery = useQuery({ queryKey: ["dashboard", "analytics", rangeQuery], queryFn: () => apiFetch<AnalyticsResponse>(`/dashboard/analytics?${rangeQuery}`), placeholderData: keepPreviousData, staleTime: 30_000 });
  const overview = overviewQuery.data ?? null;
  const analytics = analyticsQuery.data ?? null;
  const requestError = overviewQuery.error ?? analyticsQuery.error;
  const error = requestError instanceof ApiError && requestError.status === 401 ? "Your session has expired. Please sign in again." : requestError instanceof Error ? requestError.message : null;

  return { mode, updateMode, overviewQuery, analyticsQuery, overview, analytics, error };
}
