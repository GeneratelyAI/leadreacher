"use client";

import { Building2, RefreshCw, TrendingUp, UserRound } from "@/components/ui/icons";
import { Button } from "@/components/ui/Button";
import { OnboardingCard } from "../OnboardingCard";
import { ScreenHeader } from "./Chrome";
import { StrategyBriefContent } from "./Brief";
import { LoadingStrategy, StrategyError } from "./Feedback";
import type { AudienceAnalysis, StrategyBrief } from "../../state/strategy-model";

const MIN_INDUSTRY_BAR_WIDTH_PERCENT = 8;

export function TargetingScreen({
  analysis,
  strategyBrief,
  isLoading,
  error,
  errorInProgress,
  onRetry,
}: {
  analysis: AudienceAnalysis | null;
  strategyBrief: StrategyBrief | null;
  isLoading: boolean;
  error: string | null;
  errorInProgress: boolean;
  onRetry: () => void;
}) {
  if (isLoading) {
    return (
      <section className="strategy-targeting-screen mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-5 pt-40 pb-44 h-compact:justify-start h-compact:pt-36 lg:pt-34 lg:pb-28">
        <ScreenHeader
          title="Who we're targeting"
          subtitle="Here's the audience we identified as the best fit for your business."
        />
        <LoadingStrategy strategyBrief={strategyBrief} />
      </section>
    );
  }

  if (error || !analysis || analysis.status !== "completed") {
    return (
      <section className="strategy-targeting-screen mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-5 pt-40 pb-44 h-compact:justify-start h-compact:pt-36 lg:pt-34 lg:pb-28">
        <ScreenHeader
          title="Who we're targeting"
          subtitle="Here's the audience we identified as the best fit for your business."
        />
        <StrategyError
          message={error ?? analysis?.error ?? "No completed audience analysis is available yet."}
          inProgress={errorInProgress}
          onRetry={onRetry}
        />
        {strategyBrief ? (
          <OnboardingCard className="mx-auto mt-5 w-full max-w-4xl px-6 py-7 sm:px-8">
            <StrategyBriefContent brief={strategyBrief} />
          </OnboardingCard>
        ) : null}
      </section>
    );
  }

  if (analysis.source === "connected_linkedin") {
    const roles = strategyBrief?.decisionMakerRoles ?? [];
    return (
      <section className="strategy-targeting-screen mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-5 pt-40 pb-44 h-compact:justify-start h-compact:pt-36 lg:pt-34 lg:pb-28">
        <ScreenHeader
          title="Your target audience"
          subtitle="The strategy is ready. Prospect results will come from your connected LinkedIn account."
        />
        <OnboardingCard className="mx-auto mt-8 w-full max-w-4xl px-6 py-7 sm:px-8">
          {strategyBrief ? <StrategyBriefContent brief={strategyBrief} audiencePending /> : null}
          <div className="strategy-connection-plan mt-7 grid gap-4 border-t border-neutral-200 pt-7 dark:border-neutral-700 md:grid-cols-[minmax(0,1fr)_minmax(18rem,26rem)] md:items-center">
            <div>
              <p className="text-sm font-semibold text-onboarding-ink dark:text-onboarding-neutral-0">
                Decision makers to find after connection
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {roles.map((role) => (
                  <span key={role} className="rounded-full bg-brand-purple/8 px-3 py-1.5 text-sm font-medium text-brand-purple dark:bg-brand-purple/20 dark:text-brand-100">
                    {role}
                  </span>
                ))}
              </div>
            </div>
            <div className="rounded-lg border border-brand-purple/15 bg-brand-purple/5 px-4 py-3 text-sm text-neutral-600 dark:border-brand-purple/30 dark:bg-brand-purple/10 dark:text-neutral-300">
              Connect LinkedIn in Channels. After setup, we will find matching prospects and place them in campaign review.
            </div>
          </div>
        </OnboardingCard>
      </section>
    );
  }

  const maxIndustryCount = Math.max(...analysis.topIndustries.map((item) => item.count), 1);
  const companiesUnavailable = analysis.companies.status === "unavailable";

  return (
    <section className="strategy-targeting-screen mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-5 pt-40 pb-44 h-compact:justify-start h-compact:pt-36 lg:pt-34 lg:pb-28">
      <ScreenHeader
        title="Who we're targeting"
        subtitle="Here's the audience we identified as the best fit for your business."
      />

      <OnboardingCard className="mx-auto mt-8 w-full max-w-4xl px-6 py-8 sm:px-8">
        {strategyBrief ? (
          <>
            <StrategyBriefContent brief={strategyBrief} />
            <div className="my-8 border-t border-neutral-200 dark:border-neutral-700" />
          </>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Your reviewed audience sample is ready. You can re-run it after refining Discovery.
          </p>
          <Button type="button" variant="secondary" size="sm" onClick={onRetry}>
            <RefreshCw className="size-4" aria-hidden />
            Run new sample
          </Button>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* Companies Metric */}
          <div className="metric-card">
            <div className="flex items-start justify-between">
              <div>
                <div className="metric-value">
                  {companiesUnavailable ? (
                    <span className="status-badge bg-onboarding-purple-50 text-onboarding-purple-700 dark:bg-onboarding-purple-900 dark:text-onboarding-purple-100">
                      Next step
                    </span>
                  ) : (
                    analysis.companies.totalFound.toLocaleString()
                  )}
                </div>
                <div className="metric-label mt-2">
                  {companiesUnavailable ? "Company research" : "Companies found"}
                </div>
              </div>
              <Building2 className="size-6 shrink-0 text-brand-purple dark:text-brand-100" aria-hidden />
            </div>
            <div className="metric-hint mt-4">
              {companiesUnavailable
                ? "Enriched after setup"
                : `${analysis.companies.sampleSize.toLocaleString()} sampled`}
            </div>
          </div>

          {/* Decision Makers Metric */}
          <div className="metric-card">
            <div className="flex items-start justify-between">
              <div>
                <div className="metric-value">{analysis.decisionMakers.sampleSize.toLocaleString()}</div>
                <div className="metric-label mt-2">Profiles ready to review</div>
              </div>
              <UserRound className="size-6 shrink-0 text-info-500 dark:text-blue-200" aria-hidden />
            </div>
            <div className="metric-hint mt-4">
              Reviewed sample from your target roles
            </div>
          </div>

          {/* Reachability Metric */}
          <div className="metric-card">
            <div className="flex items-start justify-between">
              <div>
                <div className="metric-value">{analysis.reachability.percentage}%</div>
                <div className="metric-label mt-2">Reachability</div>
              </div>
              <TrendingUp className="size-6 shrink-0 text-success-500 dark:text-emerald-200" aria-hidden />
            </div>
            <div className="metric-hint mt-4">
              {analysis.reachability.reachableProfiles}/{analysis.reachability.totalProfiles} with email
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-8 border-t border-neutral-200 pt-8 dark:border-neutral-700 md:grid-cols-2">
          <div>
            <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">Top Industries</h2>
            {companiesUnavailable ? (
              <div className="mt-6 rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-700 dark:bg-neutral-800">
                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                  {analysis.companies.reason ??
                    "Company-level data is unavailable for this audience."}
                </p>
              </div>
            ) : (
              <div className="mt-6 space-y-3">
                {analysis.topIndustries.map((item) => (
                  <div key={item.industry} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">{item.industry}</span>
                      <span className="text-xs font-semibold text-brand-purple dark:text-brand-100">{item.percentage}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-neutral-200 dark:bg-neutral-700">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-brand-purple to-brand-purple-light transition-all duration-base ease-brand"
                        style={{
                          width: `${Math.max(
                            MIN_INDUSTRY_BAR_WIDTH_PERCENT,
                            percentageWidth(item.count, maxIndustryCount),
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-neutral-200 pt-8 dark:border-neutral-700 md:border-t-0 md:border-l md:border-t-0 md:pl-8 md:pt-0">
            <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">Titles in this sample</h2>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
              These are the current titles returned for review, not final buyer personas.
            </p>
            <div className="mt-6 flex flex-col gap-2">
              {analysis.topBuyerPersonas.map((item) => (
                <div
                  key={item.title}
                  className="badge badge-info flex items-center justify-between rounded-lg px-4 py-2.5"
                >
                  <span className="font-medium">{item.title}</span>
                  <span className="text-xs opacity-75">{item.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </OnboardingCard>
    </section>
  );
}

function percentageWidth(value: number, max: number): number {
  return max > 0 ? Math.round((value / max) * 100) : 0;
}
