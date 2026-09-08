"use client";

import { Clock3, CircleAlert, ShieldCheck } from "@/components/ui/icons";
import { Frame } from "@/components/dashboard/Frame";
import { useShell } from "@/components/dashboard/Shell";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useOverview } from "../hooks/useOverview";
import { greeting, accountFirstName } from "../state/overview-format";
import { OverviewModeSwitcher } from "../components/OverviewModeSwitcher";
import { OverviewSkeleton, CasualOverview, AdvancedOverview } from "../components/OverviewScenes";

export function Overview() {
  const { memberName } = useShell();
  const { mode, updateMode, overviewQuery, analyticsQuery, overview, analytics, error } = useOverview();

  return (
    <Frame className="min-w-0">
      <div className="relative mb-5 grid gap-4 lg:min-h-14 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <div className="min-w-0">
          <h1 className="text-[1.35rem] font-semibold leading-tight tracking-tight sm:text-[1.75rem]">{greeting()}, <span className="break-words">{accountFirstName(overview, memberName)}</span> <span aria-hidden>👋</span></h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground"><span className={cn("size-2 rounded-full", overview?.engine.status === "running" ? "bg-onboarding-success-500" : overview?.engine.status === "needs_attention" ? "bg-onboarding-warning-500" : "bg-onboarding-purple-500")} />{overview?.engine.detail ?? "Loading your workspace status."}</p>
        </div>
        <div className="lg:absolute lg:left-1/2 lg:-translate-x-1/2"><OverviewModeSwitcher mode={mode} onChange={updateMode} /></div>
        <div className="hidden justify-self-end lg:block"><Badge variant="outline" className="h-9 gap-2 px-3"><Clock3 className="size-3.5" />{overviewQuery.isFetching || analyticsQuery.isFetching ? "Refreshing" : "Data up to date"}</Badge></div>
      </div>

      {error ? <div className="mb-4 flex items-start gap-3 rounded-lg border border-onboarding-error-500/30 bg-onboarding-error-50 p-4 text-sm text-onboarding-error-900 dark:bg-onboarding-error-900 dark:text-onboarding-error-50" role="alert"><CircleAlert className="mt-0.5 size-4 shrink-0" /><div><p className="font-semibold">Unable to load overview</p><p className="mt-1">{error}</p></div></div> : null}
      {!overview && overviewQuery.isLoading ? <OverviewSkeleton /> : overview ? mode === "casual" ? <CasualOverview overview={overview} analytics={analytics} /> : <AdvancedOverview overview={overview} analytics={analytics} /> : null}

      {overview ? <footer className="mt-4 flex flex-col gap-2 rounded-lg border border-app-border bg-app-chrome px-4 py-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between"><span className="inline-flex items-center gap-2"><ShieldCheck className="size-4 text-onboarding-success-500" />{overview.engine.label}</span><span>{overviewQuery.isFetching || analyticsQuery.isFetching ? "Updating workspace data" : "Workspace data synchronized"}</span></footer> : null}
    </Frame>
  );
}
