"use client";

import { Download, Info } from "@/components/ui/icons";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Loading } from "@/components/ui/Loading";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAnalytics } from "../hooks/useAnalytics";
import { exportReport } from "../state/report-export";
import { AnalyticsFilters } from "../components/AnalyticsFilters";
import { AnalyticsKpis } from "../components/AnalyticsKpis";
import { AnalyticsCharts } from "../components/AnalyticsCharts";
import { AnalyticsPerformance } from "../components/AnalyticsPerformance";
import { AnalyticsInsights } from "../components/AnalyticsInsights";

export function Analytics() {
  const state = useAnalytics();
  const { analytics, insights, isLoading, error } = state;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-semibold tracking-tight">Analytics</h1>
            <Tooltip>
              <TooltipTrigger render={<span className="size-2 rounded-full bg-onboarding-success-500" aria-label="Live analytics" />} />
              <TooltipContent>Based on persisted messages and lead lifecycle data</TooltipContent>
            </Tooltip>
          </div>
          <p className="mt-2 max-w-2xl text-sm text-onboarding-neutral-600 dark:text-onboarding-neutral-400">
            Factual delivery and reply totals based on persisted messages and lead lifecycle data.
          </p>
        </div>
        <Button variant="secondary" onClick={() => exportReport(analytics)} disabled={!analytics || isLoading}>
          <Download /> Export report
        </Button>
      </div>

      {error ? (
        <div
          className="rounded-lg border border-onboarding-error-200 bg-onboarding-error-50 px-4 py-3 text-sm text-onboarding-error-700 dark:border-onboarding-error-500/40 dark:bg-onboarding-error-500/15 dark:text-onboarding-error-100"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      <AnalyticsKpis analytics={analytics} isLoading={isLoading} />

      <AnalyticsFilters {...state} />

      {isLoading && !analytics ? (
        <Card>
          <CardContent className="flex min-h-48 flex-col items-center justify-center text-sm text-muted-foreground">
            <Loading tone="brand" label="Loading analytics" className="-mb-4" />
            <span>Loading analytics</span>
          </CardContent>
        </Card>
      ) : analytics ? (
        <>
          <AnalyticsCharts analytics={analytics} />

          <AnalyticsPerformance analytics={analytics} />

          <AnalyticsInsights insights={insights} />
        </>
      ) : null}

      <div className="flex flex-col gap-2 rounded-xl border border-onboarding-purple-200 bg-onboarding-purple-50 px-4 py-3 text-sm text-onboarding-purple-800 sm:flex-row sm:items-center sm:justify-between dark:border-onboarding-purple-400/30 dark:bg-onboarding-purple-500/15 dark:text-onboarding-purple-100">
        <p className="inline-flex items-start gap-2 sm:items-center">
          <Info className="mt-0.5 size-4 shrink-0 text-onboarding-purple-600 dark:text-onboarding-purple-300 sm:mt-0" aria-hidden />
          Analytics only reflect persisted outreach and lead outcomes, with no forecasts or projected rates.
        </p>
      </div>
    </div>
  );
}
