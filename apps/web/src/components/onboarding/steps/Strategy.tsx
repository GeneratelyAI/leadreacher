"use client";

import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  Info,
  Loader2,
  RefreshCw,
  TrendingUp,
  UserRound,
} from "@/components/ui/icons";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { StepMotion } from "@/components/onboarding/StepMotion";
import { ChannelLogo } from "@/components/onboarding/ChannelLogo";
import { OnboardingCard } from "@/components/onboarding/OnboardingCard";
import { LandingMotion } from "@/components/landing/LandingMotion";
import { AcquisitionWorkflowCarousel } from "@/components/landing/product-story/AcquisitionShowcase";
import { ActionBar } from "@/components/ui/ActionBar";
import { Button } from "@/components/ui/Button";
import { applyStoredTheme } from "@/hooks/useThemeMode";
import { ApiError, apiFetch, bootstrapCurrentOrganization } from "@/lib/api";
import {
  getChannelRecommendations,
  type ChannelRecommendation,
} from "@/lib/onboarding/channel-recommendations";
import { cn } from "@/lib/utils";
import {
  onboardingHref,
  navigateOnboarding,
  strategyHref,
  type StrategySubstepParam,
} from "./steps";

type ChannelKey = ChannelRecommendation["channel"];
type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
type JsonRecord = { [key: string]: JsonValue };

const STALE_AUDIENCE_RUN_TIMEOUT_MS = 6 * 60_000;
const MIN_INDUSTRY_BAR_WIDTH_PERCENT = 8;

type StrategyResponse = {
  id: string;
  orgId: string;
  icpDefinition: JsonValue;
  channels: JsonValue;
  updatedAt: string;
};

function selectedChannelsFromStrategy(strategy: StrategyResponse | null): ChannelKey[] {
  if (!strategy?.channels || typeof strategy.channels !== "object" || Array.isArray(strategy.channels)) return [];
  const selected = strategy.channels.selected;
  if (!Array.isArray(selected)) return [];
  return selected.filter((value): value is ChannelKey =>
    value === "linkedin" || value === "email" || value === "whatsapp" || value === "instagram" || value === "facebook"
  );
}

type AudienceAnalysis = {
  status: "running" | "completed" | "failed";
  source?: "apify" | "connected_linkedin";
  startedAt?: string;
  error?: string;
  companies: {
    status: "available" | "unavailable";
    reason?: string;
    totalFound: number;
    sampleSize: number;
  };
  decisionMakers: {
    totalFound: number;
    sampleSize: number;
  };
  reachability: {
    percentage: number;
    reachableProfiles: number;
    totalProfiles: number;
  };
  topIndustries: Array<{
    industry: string;
    count: number;
    percentage: number;
  }>;
  topBuyerPersonas: Array<{
    title: string;
    count: number;
  }>;
};

type StrategyBrief = {
  status: "ready";
  goal: string;
  market: string;
  audience: string;
  offer: string;
  valueProposition: string;
  decisionMakerRoles: string[];
  outreachAngles: Array<{
    title: string;
    description: string;
    opener: string;
  }>;
  executionPlan: Array<{
    step: number;
    title: string;
    description: string;
  }>;
  audienceSample?: {
    decisionMakers: number;
    topBuyerPersonas: string[];
  };
};

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toNumber(value: JsonValue | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function toStringValue(value: JsonValue | undefined): string {
  return typeof value === "string" ? value : "";
}

function getRecord(value: JsonValue | undefined): JsonRecord {
  return isRecord(value) ? value : {};
}

function stringArray(value: JsonValue | undefined): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function getAudienceAnalysis(strategy: StrategyResponse | null): AudienceAnalysis | null {
  const icpDefinition = getRecord(strategy?.icpDefinition);
  const analysis = getRecord(icpDefinition.audienceAnalysis);
  const status = analysis.status;
  if (status !== "running" && status !== "completed" && status !== "failed") {
    return null;
  }

  const companies = getRecord(analysis.companies);
  const decisionMakers = getRecord(analysis.decisionMakers);
  const reachability = getRecord(analysis.reachability);
  const topIndustries = Array.isArray(analysis.topIndustries)
    ? analysis.topIndustries.flatMap((item) => {
        if (!isRecord(item)) return [];
        const industry = toStringValue(item.industry);
        if (!industry) return [];
        return [{
          industry,
          count: toNumber(item.count),
          percentage: toNumber(item.percentage),
        }];
      })
    : [];
  const topBuyerPersonas = Array.isArray(analysis.topBuyerPersonas)
    ? analysis.topBuyerPersonas.flatMap((item) => {
        if (!isRecord(item)) return [];
        const title = toStringValue(item.title);
        if (!title) return [];
        return [{
          title,
          count: toNumber(item.count),
        }];
      })
    : [];

  return {
    status,
    source:
      analysis.source === "connected_linkedin" || analysis.source === "apify"
        ? analysis.source
        : undefined,
    startedAt: toStringValue(analysis.startedAt) || undefined,
    error: toStringValue(analysis.error) || undefined,
    companies: {
      status: toStringValue(companies.status) === "unavailable" ? "unavailable" : "available",
      reason: toStringValue(companies.reason) || undefined,
      totalFound: toNumber(companies.totalFound),
      sampleSize: toNumber(companies.sampleSize),
    },
    decisionMakers: {
      totalFound: toNumber(decisionMakers.totalFound),
      sampleSize: toNumber(decisionMakers.sampleSize),
    },
    reachability: {
      percentage: toNumber(reachability.percentage),
      reachableProfiles: toNumber(reachability.reachableProfiles),
      totalProfiles: toNumber(reachability.totalProfiles),
    },
    topIndustries,
    topBuyerPersonas,
  };
}

function getStrategyBrief(strategy: StrategyResponse | null): StrategyBrief | null {
  const icpDefinition = getRecord(strategy?.icpDefinition);
  const brief = getRecord(icpDefinition.strategyBrief);
  if (brief.status !== "ready") return null;

  const goal = toStringValue(brief.goal);
  const market = toStringValue(brief.market);
  const audience = toStringValue(brief.audience);
  const offer = toStringValue(brief.offer);
  const valueProposition = toStringValue(brief.valueProposition);
  const decisionMakerRoles = stringArray(brief.decisionMakerRoles);
  if (!goal || !market || !audience || !offer || !valueProposition || !decisionMakerRoles.length) {
    return null;
  }

  const outreachAngles = Array.isArray(brief.outreachAngles)
    ? brief.outreachAngles.flatMap((item) => {
        if (!isRecord(item)) return [];
        const title = toStringValue(item.title);
        const description = toStringValue(item.description);
        const opener = toStringValue(item.opener);
        return title && description && opener ? [{ title, description, opener }] : [];
      })
    : [];
  const executionPlan = Array.isArray(brief.executionPlan)
    ? brief.executionPlan.flatMap((item) => {
        if (!isRecord(item)) return [];
        const step = toNumber(item.step);
        const title = toStringValue(item.title);
        const description = toStringValue(item.description);
        return step && title && description ? [{ step, title, description }] : [];
      })
    : [];
  const audienceSample = getRecord(brief.audienceSample);

  return {
    status: "ready",
    goal,
    market,
    audience,
    offer,
    valueProposition,
    decisionMakerRoles,
    outreachAngles,
    executionPlan,
    ...(Object.keys(audienceSample).length > 0 && {
      audienceSample: {
        decisionMakers: toNumber(audienceSample.decisionMakers),
        topBuyerPersonas: stringArray(audienceSample.topBuyerPersonas),
      },
    }),
  };
}

function isStaleAudienceRun(analysis: AudienceAnalysis): boolean {
  if (analysis.status !== "running" || !analysis.startedAt) return false;
  const startedAt = Date.parse(analysis.startedAt);
  return Number.isFinite(startedAt) && Date.now() - startedAt > STALE_AUDIENCE_RUN_TIMEOUT_MS;
}

function strategyErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  if (/expected object|received null|body\//i.test(message)) {
    return "We couldn't start the audience analysis. Please retry.";
  }
  return message || "Unable to generate your strategy. Please retry.";
}

function ShellActions({
  canContinue,
  continueLabel = "Continue to next step",
  onBack,
  onContinue,
  className,
}: {
  canContinue: boolean;
  continueLabel?: string;
  onBack: () => void;
  onContinue: () => void;
  className?: string;
}) {
  return (
    <ActionBar
      className={className}
      leading={
        <Button type="button" variant="secondary" onClick={onBack} className="h-13 px-7 text-base">
          <ArrowLeft className="size-5" aria-hidden />
          Back
        </Button>
      }
      trailing={
        <Button
          type="button"
          variant="primary"
          disabled={!canContinue}
          onClick={onContinue}
          className="h-13 px-8 text-base sm:px-10"
        >
          {continueLabel}
          <ArrowRight className="size-5" aria-hidden />
        </Button>
      }
    />
  );
}

function ScreenHeader({
  title,
  subtitle,
  compact = false,
}: {
  title: string;
  subtitle: string;
  compact?: boolean;
}) {
  return (
    <div className="onboarding-screen-header mx-auto flex max-w-2xl flex-col items-center text-center">
      <h1 className={cn(
        "font-bold tracking-tight text-onboarding-ink dark:text-onboarding-neutral-0",
        compact ? "text-3xl" : "text-3xl sm:text-4xl",
      )}>
        {title}
      </h1>
      <p className={cn(
        "max-w-lg text-onboarding-neutral-600 dark:text-onboarding-neutral-400",
        compact ? "mt-3 text-sm leading-6" : "mt-4 text-base leading-7",
      )}>
        {subtitle}
      </p>
    </div>
  );
}

function HowItWorksScreen() {
  return (
    <section className="strategy-how-screen relative mx-auto flex w-full max-w-[92rem] flex-1 flex-col items-center justify-center overflow-hidden px-5 pt-36 pb-44 h-compact:justify-start h-compact:pt-32 lg:pt-32 lg:pb-28">
      <div
        className="pointer-events-none absolute top-[43%] left-1/2 -z-10 h-80 w-[min(72rem,90vw)] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse,rgba(111,76,255,.075),transparent_68%)] dark:bg-[radial-gradient(ellipse,rgba(124,92,255,.13),transparent_68%)]"
        aria-hidden
      />
      <ScreenHeader
        title="How LeadReacher works"
        subtitle="We turn your insights into conversations and qualified opportunities."
      />
      <LandingMotion>
        <AcquisitionWorkflowCarousel compact className="mt-3 w-full" />
      </LandingMotion>
    </section>
  );
}

function StrategyBriefContent({
  brief,
  audiencePending = false,
}: {
  brief: StrategyBrief;
  audiencePending?: boolean;
}) {
  return (
    <div className="strategy-brief-content text-left">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold tracking-[0.12em] text-brand-purple uppercase dark:text-brand-300">
            Your outreach strategy
          </p>
          <h2 className="mt-2 text-xl font-bold text-onboarding-ink dark:text-onboarding-neutral-0">
            A focused plan for {brief.audience}
          </h2>
        </div>
        {audiencePending ? (
          <span className="inline-flex rounded-full bg-brand-purple/8 px-3 py-1.5 text-xs font-semibold text-brand-purple dark:bg-brand-purple/20 dark:text-brand-100">
            Matching people will be found after connection
          </span>
        ) : null}
      </div>

      <p className="mt-3 max-w-3xl text-sm leading-6 text-onboarding-neutral-600 dark:text-onboarding-neutral-400">
        {brief.goal}
      </p>

      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold text-onboarding-ink dark:text-onboarding-neutral-0">Positioning</h3>
          <p className="mt-2 text-sm leading-6 text-onboarding-neutral-600 dark:text-onboarding-neutral-400">
            {brief.valueProposition}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {brief.decisionMakerRoles.map((role) => (
              <span
                key={role}
                className="rounded-full bg-onboarding-purple-50 px-3 py-1.5 text-xs font-semibold text-onboarding-purple-700 dark:bg-onboarding-purple-900/60 dark:text-onboarding-purple-100"
              >
                {role}
              </span>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-onboarding-ink dark:text-onboarding-neutral-0">Message angles</h3>
          <ul className="mt-2 space-y-2.5">
            {brief.outreachAngles.map((angle) => (
              <li key={angle.title} className="text-sm leading-5 text-onboarding-neutral-600 dark:text-onboarding-neutral-400">
                <span className="font-semibold text-onboarding-ink dark:text-onboarding-neutral-0">{angle.title}: </span>
                {angle.description}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <ol className="mt-6 grid gap-3 border-t border-neutral-200 pt-5 sm:grid-cols-3 dark:border-neutral-700">
        {brief.executionPlan.map((item) => (
          <li key={item.step} className="min-w-0">
            <span className="text-xs font-bold text-brand-purple dark:text-brand-300">{String(item.step).padStart(2, "0")}</span>
            <p className="mt-1 text-sm font-semibold text-onboarding-ink dark:text-onboarding-neutral-0">{item.title}</p>
            <p className="mt-1 text-xs leading-5 text-onboarding-neutral-600 dark:text-onboarding-neutral-400">{item.description}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

function LoadingStrategy({ strategyBrief }: { strategyBrief: StrategyBrief | null }) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const progressMessage =
    elapsedSeconds < 8
      ? "Preparing your audience filters"
      : elapsedSeconds < 25
        ? "Finding matching decision makers"
        : elapsedSeconds < 60
          ? "Reviewing profiles and reachability"
          : "The provider is processing your audience. You can leave this page and return safely.";

  return (
    <OnboardingCard className="mx-auto mt-8 w-full max-w-4xl px-6 py-8 sm:px-8" role="status" aria-live="polite">
      {strategyBrief ? <StrategyBriefContent brief={strategyBrief} audiencePending /> : null}
      <div className={cn("flex flex-col items-center text-center", strategyBrief && "mt-7 border-t border-neutral-200 pt-7 dark:border-neutral-700")}>
        <Loader2 className="size-9 animate-spin text-brand-purple" aria-hidden />
        <h2 className="mt-5 text-xl font-bold text-onboarding-ink dark:text-onboarding-neutral-0">
          Running your audience analysis
        </h2>
        <p className="mt-3 max-w-md text-sm leading-6 text-onboarding-neutral-600 dark:text-onboarding-neutral-400">
          {progressMessage}
        </p>
        <div className="mt-6 h-1.5 w-full max-w-sm overflow-hidden rounded-full bg-onboarding-neutral-100 dark:bg-onboarding-neutral-800">
          <span className="onboarding-analysis-progress block h-full w-2/5 rounded-full bg-gradient-to-r from-brand-purple to-violet-400" />
        </div>
      </div>
    </OnboardingCard>
  );
}

function friendlyAudienceError(message: string): string {
  if (/timed out|timeout/i.test(message)) {
    return "The audience provider did not finish in time. Retry and you can safely leave this page while it runs.";
  }
  return message.replace(/^Apify:\s*/i, "");
}

function StrategyError({
  message,
  onRetry,
  inProgress = false,
}: {
  message: string;
  onRetry: () => void;
  inProgress?: boolean;
}) {
  return (
    <OnboardingCard className="mx-auto mt-8 w-full max-w-3xl px-6 py-8 text-center sm:px-8" role="alert">
      {inProgress ? (
        <Loader2 className="mx-auto size-9 text-brand-purple" aria-hidden />
      ) : (
        <Info className="mx-auto size-9 text-red-500" aria-hidden />
      )}
      <h2 className="mt-4 text-xl font-bold text-onboarding-ink dark:text-onboarding-neutral-0">
        {inProgress ? "Audience analysis in progress" : "Audience analysis failed"}
      </h2>
      <p className="mt-3 text-sm leading-6 text-onboarding-neutral-600 dark:text-onboarding-neutral-400">
        {friendlyAudienceError(message)}
      </p>
      <Button
        type="button"
        variant="brand"
        onClick={onRetry}
        className="mt-6"
      >
        <RefreshCw className="size-4" aria-hidden />
        {inProgress ? "Check again" : "Retry analysis"}
      </Button>
    </OnboardingCard>
  );
}

function TargetingScreen({
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
              <div className="rounded-xl bg-brand-purple/8 p-2.5 text-brand-purple dark:bg-brand-purple/20 dark:text-brand-100">
                <Building2 className="size-6" aria-hidden />
              </div>
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
              <div className="rounded-xl bg-info-50 p-2.5 text-info-500 dark:bg-info-500/15 dark:text-blue-200">
                <UserRound className="size-6" aria-hidden />
              </div>
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
              <div className="rounded-xl bg-success-50 p-2.5 text-success-500 dark:bg-success-500/15 dark:text-emerald-200">
                <TrendingUp className="size-6" aria-hidden />
              </div>
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

function channelIcon(channel: ChannelKey): React.ReactNode {
  if (channel === "linkedin") {
    return <ChannelLogo name="linkedin" className="size-18" />;
  }
  if (channel === "whatsapp") {
    return <ChannelLogo name="whatsapp-mark" className="size-18" />;
  }
  if (channel === "instagram") {
    return <ChannelLogo name="instagram" className="size-16" />;
  }
  if (channel === "facebook") {
    return <ChannelLogo name="facebook" className="size-16" />;
  }
  return (
    <span className="inline-flex items-center gap-1" aria-label="Gmail and Outlook">
      <ChannelLogo name="gmail" className="size-7.5" />
      <ChannelLogo name="outlook" className="size-7.5" />
    </span>
  );
}

function ChannelsScreen({
  recommendations,
  selectedChannels,
  onToggle,
  isLoading,
  error,
}: {
  recommendations: ChannelRecommendation[];
  selectedChannels: ChannelKey[];
  onToggle: (channel: ChannelKey) => void;
  isLoading: boolean;
  error: string | null;
}) {
  if (isLoading) {
    return (
      <section className="strategy-channels-screen mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-5 pt-40 pb-44 h-compact:justify-start h-compact:pt-36 lg:pt-34 lg:pb-28">
        <ScreenHeader
          title="Choose your channels"
          subtitle="Loading the channels available for your campaign."
        />
      </section>
    );
  }

  if (error) {
    return (
      <section className="strategy-channels-screen mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-5 pt-40 pb-44 h-compact:justify-start h-compact:pt-36 lg:pt-34 lg:pb-28">
        <ScreenHeader
          title="Choose your channels"
          subtitle={error}
        />
      </section>
    );
  }

  const recommended = new Set(recommendations.slice(0, 2).map((item) => item.channel));
  const channels: Array<{ channel: ChannelKey; label: string; description: string }> = [
    { channel: "linkedin", label: "LinkedIn", description: "Reach professional decision-makers through your connected LinkedIn account." },
    { channel: "email", label: "Email", description: "Send approved email sequences through Gmail, Outlook, or another mailbox." },
    { channel: "whatsapp", label: "WhatsApp", description: "Start direct conversations with prospects who can be contacted on WhatsApp." },
    { channel: "instagram", label: "Instagram", description: "Reach prospects through approved Instagram direct messages." },
    { channel: "facebook", label: "Facebook Messenger", description: "Continue outreach through connected Messenger conversations." },
  ];
  const featured = channels.filter((item) => recommended.has(item.channel));
  const other = channels.filter((item) => !recommended.has(item.channel));

  const ChannelCard = ({ item, featuredCard = false }: { item: (typeof channels)[number]; featuredCard?: boolean }) => {
    const selected = selectedChannels.includes(item.channel);
    return (
      <button
        type="button"
        aria-pressed={selected}
        disabled={item.channel === "linkedin"}
        onClick={() => onToggle(item.channel)}
        className={cn(
          "strategy-channel-card onboarding-accent-card group relative flex min-h-36 w-full items-start gap-4 rounded-3xl border bg-white p-5 text-left transition-[border-color,box-shadow,transform] duration-150 dark:bg-onboarding-neutral-900",
          selected
            ? "border-onboarding-purple-500 shadow-[0_14px_34px_rgba(91,43,224,0.12)] dark:border-onboarding-purple-300"
            : "border-onboarding-neutral-150 hover:border-onboarding-purple-200 hover:shadow-onboarding-small dark:border-onboarding-neutral-750",
          item.channel === "linkedin" ? "cursor-default" : "hover:-translate-y-0.5",
          featuredCard ? "strategy-channel-card--featured sm:min-h-40" : "",
        )}
      >
        <span className="inline-flex size-14 shrink-0 items-center justify-center [&>*]:max-h-full [&>*]:max-w-full" aria-hidden>{channelIcon(item.channel)}</span>
        <span className="min-w-0 pt-0.5 pr-7">
          <span className="flex flex-wrap items-center gap-2.5">
            <span className="text-lg font-bold tracking-tight text-onboarding-ink dark:text-white sm:text-xl">{item.label}</span>
            {item.channel === "linkedin" ? (
              <span className="rounded-full bg-onboarding-purple-50 px-2.5 py-1 text-[0.65rem] font-bold tracking-wide text-onboarding-purple-700 uppercase dark:bg-onboarding-purple-900/50 dark:text-onboarding-purple-100">Required</span>
            ) : recommended.has(item.channel) ? (
              <span className="rounded-full bg-onboarding-purple-50 px-2.5 py-1 text-[0.65rem] font-bold tracking-wide text-onboarding-purple-700 uppercase dark:bg-onboarding-purple-900/50 dark:text-onboarding-purple-100">Recommended</span>
            ) : null}
          </span>
          <span className="mt-2 block max-w-md text-sm leading-5 text-onboarding-neutral-600 dark:text-onboarding-neutral-400">{item.description}</span>
        </span>
        <span className={cn(
          "absolute top-5 right-5 grid size-7 place-items-center rounded-lg border transition-colors",
          selected ? "border-onboarding-purple-600 bg-onboarding-purple-600 text-white" : "border-onboarding-neutral-250 text-transparent dark:border-onboarding-neutral-650",
        )} aria-hidden>
          <Check className="size-4.5" />
        </span>
      </button>
    );
  };

  return (
    <section className="strategy-channels-screen mx-auto flex w-full max-w-6xl flex-col justify-start px-5 pt-28 pb-4 sm:pt-30 lg:pt-28">
      <ScreenHeader
        title="Choose your channels"
        subtitle="Select where LeadReacher can reach prospects. We’ll prioritize the channels that best fit your campaign."
        compact
      />

      <div className="mx-auto mt-6 w-full max-w-6xl">
        {featured.length > 0 ? (
          <div>
            <h2 className="text-base font-bold text-onboarding-ink dark:text-white">Recommended for this campaign</h2>
            <div className="strategy-channel-grid mt-3 grid gap-4 md:grid-cols-2">{featured.map((item) => <ChannelCard key={item.channel} item={item} featuredCard />)}</div>
          </div>
        ) : null}
        <div className={featured.length > 0 ? "mt-6" : ""}>
          <h2 className="text-base font-bold text-onboarding-ink dark:text-white">Other available channels</h2>
          <div className="strategy-channel-grid mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{other.map((item) => <ChannelCard key={item.channel} item={item} />)}</div>
        </div>
        <div className="mt-5 flex items-center gap-2 text-sm font-semibold text-onboarding-neutral-600 dark:text-onboarding-neutral-300">
          <span className="grid size-6 place-items-center rounded-full bg-onboarding-purple-50 text-onboarding-purple-700 dark:bg-onboarding-purple-900/50 dark:text-onboarding-purple-100" aria-hidden>
            <Check className="size-3.5" />
          </span>
          <p>{selectedChannels.length} {selectedChannels.length === 1 ? "channel" : "channels"} selected</p>
        </div>
      </div>
    </section>
  );
}

export default function Strategy({
  substep = "how-it-works",
}: {
  substep?: StrategySubstepParam;
}) {
  useLayoutEffect(() => {
    applyStoredTheme();
  }, []);

  const [strategy, setStrategy] = useState<StrategyResponse | null>(null);
  const [isLoadingStrategy, setIsLoadingStrategy] = useState(
    substep === "targeting" || substep === "channels",
  );
  const [strategyError, setStrategyError] = useState<string | null>(null);
  const [strategyErrorInProgress, setStrategyErrorInProgress] = useState(false);
  const [selectedChannels, setSelectedChannels] = useState<ChannelKey[]>([]);
  const [isSavingChannels, setIsSavingChannels] = useState(false);
  const [channelSaveError, setChannelSaveError] = useState<string | null>(null);
  const channelsInitializedRef = useRef(false);
  const strategyRunRef = useRef<AbortController | null>(null);
  const strategyWarmupRef = useRef<AbortController | null>(null);

  const analysis = useMemo(() => getAudienceAnalysis(strategy), [strategy]);
  const strategyBrief = useMemo(() => getStrategyBrief(strategy), [strategy]);
  const recommendations = useMemo(() => getChannelRecommendations(strategy?.channels), [strategy]);

  useEffect(() => {
    if (substep !== "channels" || channelsInitializedRef.current || !strategy) return;
    const persisted = selectedChannelsFromStrategy(strategy);
    const defaults = persisted.length > 0
      ? persisted
      : recommendations.slice(0, 2).map((item) => item.channel);
    setSelectedChannels([...new Set<ChannelKey>(["linkedin", ...defaults])]);
    channelsInitializedRef.current = true;
  }, [recommendations, strategy, substep]);

  const pollForStrategy = useCallback(async (orgId: string, signal: AbortSignal) => {
    for (let attempt = 0; attempt < 180; attempt += 1) {
      await new Promise<void>((resolve) => {
        const timer = window.setTimeout(resolve, 2000);
        signal.addEventListener("abort", () => {
          window.clearTimeout(timer);
          resolve();
        }, { once: true });
      });
      if (signal.aborted) return null;
      const current = await apiFetch<StrategyResponse>(`/strategy/${orgId}`, { signal });
      if (signal.aborted) return null;
      setStrategy(current);
      const currentAnalysis = getAudienceAnalysis(current);
      if (currentAnalysis?.status === "completed") return current;
      if (currentAnalysis?.status === "failed") {
        throw new Error(currentAnalysis.error ?? "Audience analysis failed.");
      }
    }

    throw new Error(
      "Audience analysis is taking longer than expected. You can safely retry it.",
    );
  }, []);

  const loadStrategy = useCallback(async (
    forceGenerate: boolean,
    allowGenerate = true,
    signal: AbortSignal,
  ) => {
    setIsLoadingStrategy(true);
    setStrategyError(null);
    setStrategyErrorInProgress(false);
    try {
      const { orgId } = await bootstrapCurrentOrganization();
      if (signal.aborted) return;
      let current: StrategyResponse | null = null;

      if (!forceGenerate) {
        try {
          current = await apiFetch<StrategyResponse>(`/strategy/${orgId}`, { signal });
        } catch (error) {
          if (!(error instanceof ApiError) || error.status !== 404) {
            throw error;
          }
        }
      }

      const currentAnalysis = getAudienceAnalysis(current);
      if (currentAnalysis?.status === "completed") {
        setStrategy(current);
        return;
      }
      if (currentAnalysis?.status === "running" && !isStaleAudienceRun(currentAnalysis)) {
        await pollForStrategy(orgId, signal);
        return;
      }
      // A persisted failure belongs to the previous attempt. Entering the
      // targeting step starts a clean run instead of flashing stale failure UI.
      if (!allowGenerate && !forceGenerate) {
        setStrategy(current);
        setStrategyError("No completed audience analysis is available yet.");
        return;
      }

      const generated = await apiFetch<StrategyResponse>("/strategy/generate", {
        method: "POST",
        signal,
        body: JSON.stringify(forceGenerate ? { force: true } : {}),
      });
      if (signal.aborted) return;
      const generatedAnalysis = getAudienceAnalysis(generated);
      setStrategy(generated);
      if (generatedAnalysis?.status === "running") {
        await pollForStrategy(orgId, signal);
        return;
      }
      if (generatedAnalysis?.status === "failed") {
        setStrategyError(strategyErrorMessage(generatedAnalysis.error));
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setStrategyErrorInProgress(true);
        try {
          const { orgId } = await bootstrapCurrentOrganization();
          if (signal.aborted) return;
          await pollForStrategy(orgId, signal);
          setStrategyErrorInProgress(false);
          return;
        } catch (pollError) {
          if (signal.aborted) return;
          setStrategyError(strategyErrorMessage(pollError));
          return;
        }
      }
      if (signal.aborted) return;
      setStrategyError(strategyErrorMessage(error));
    } finally {
      if (!signal.aborted) setIsLoadingStrategy(false);
    }
  }, [pollForStrategy]);

  const startStrategyRun = useCallback((forceGenerate: boolean, allowGenerate = true) => {
    strategyRunRef.current?.abort();
    const controller = new AbortController();
    strategyRunRef.current = controller;
    void loadStrategy(forceGenerate, allowGenerate, controller.signal);
  }, [loadStrategy]);

  const warmStrategy = useCallback(async (signal: AbortSignal) => {
    try {
      const { orgId } = await bootstrapCurrentOrganization();
      if (signal.aborted) return;
      const current = await apiFetch<StrategyResponse>(`/strategy/${orgId}`, { signal });
      if (signal.aborted) return;
      setStrategy(current);

      const currentAnalysis = getAudienceAnalysis(current);
      if (
        currentAnalysis?.status === "completed" ||
        (currentAnalysis?.status === "running" && !isStaleAudienceRun(currentAnalysis)) ||
        currentAnalysis?.status === "failed"
      ) {
        return;
      }

      const generated = await apiFetch<StrategyResponse>("/strategy/generate", {
        method: "POST",
        signal,
        body: JSON.stringify({}),
      });
      if (!signal.aborted) setStrategy(generated);
    } catch (error) {
      // Discovery can be incomplete on a direct URL. The targeting screen
      // owns customer-facing failures; this pre-warm must stay invisible.
      if (signal.aborted || (error instanceof ApiError && (error.status === 404 || error.status === 409))) {
        return;
      }
      console.warn("Unable to pre-warm strategy generation", error);
    }
  }, []);

  useEffect(() => {
    if (substep !== "how-it-works") return;

    const controller = new AbortController();
    strategyWarmupRef.current?.abort();
    strategyWarmupRef.current = controller;
    void warmStrategy(controller.signal);

    return () => {
      controller.abort();
      if (strategyWarmupRef.current === controller) {
        strategyWarmupRef.current = null;
      }
    };
  }, [substep, warmStrategy]);

  useEffect(() => {
    if (substep !== "targeting" && substep !== "channels") {
      return;
    }

    const controller = new AbortController();
    strategyRunRef.current?.abort();
    strategyRunRef.current = controller;
    void loadStrategy(false, substep === "targeting", controller.signal);

    return () => {
      controller.abort();
      if (strategyRunRef.current === controller) {
        strategyRunRef.current = null;
      }
    };
  }, [loadStrategy, substep]);

  function handleBack() {
    if (substep === "how-it-works") {
      navigateOnboarding(onboardingHref("discovery"));
      return;
    }
    if (substep === "targeting") {
      navigateOnboarding(strategyHref("how-it-works"));
      return;
    }
    navigateOnboarding(strategyHref("targeting"));
  }

  async function handleContinue() {
    if (substep === "how-it-works") {
      navigateOnboarding(strategyHref("targeting"));
      return;
    }
    if (substep === "targeting") {
      navigateOnboarding(strategyHref("channels"));
      return;
    }
    if (!strategy || selectedChannels.length === 0 || isSavingChannels) return;
    setIsSavingChannels(true);
    setChannelSaveError(null);
    try {
      const updated = await apiFetch<StrategyResponse>(`/strategy/${strategy.orgId}/channels`, {
        method: "PATCH",
        body: JSON.stringify({ channels: selectedChannels }),
      });
      setStrategy(updated);
      navigateOnboarding(onboardingHref("campaign-type"));
    } catch (saveError) {
      setChannelSaveError(strategyErrorMessage(saveError));
    } finally {
      setIsSavingChannels(false);
    }
  }

  function handleRetry() {
    startStrategyRun(true);
  }

  const canContinue =
    substep === "how-it-works" ||
    (substep === "channels" && selectedChannels.length > 0 && !strategyError && !isSavingChannels) ||
    Boolean(analysis?.status === "completed" && recommendations.length > 0);

  const shellActions = (
    <ShellActions
      className={substep === "channels" ? "strategy-channels-actions" : undefined}
      canContinue={canContinue}
      continueLabel={substep === "channels" ? (isSavingChannels ? "Saving channels..." : `Continue with ${selectedChannels.length} ${selectedChannels.length === 1 ? "channel" : "channels"}`) : "Continue to next step"}
      onBack={handleBack}
      onContinue={() => void handleContinue()}
    />
  );

  let activeSubstepContent: React.ReactNode;
  if (substep === "how-it-works") {
    activeSubstepContent = <HowItWorksScreen />;
  } else if (substep === "targeting") {
    activeSubstepContent = (
      <TargetingScreen
        analysis={analysis}
        strategyBrief={strategyBrief}
        isLoading={isLoadingStrategy}
        error={strategyError}
        errorInProgress={strategyErrorInProgress}
        onRetry={handleRetry}
      />
    );
  } else {
    activeSubstepContent = (
      <ChannelsScreen
        recommendations={recommendations}
        selectedChannels={selectedChannels}
        onToggle={(channel) => {
          if (channel === "linkedin") return;
          setSelectedChannels((current) => current.includes(channel) ? current.filter((item) => item !== channel) : [...current, channel]);
        }}
        isLoading={isLoadingStrategy}
        error={strategyError ?? channelSaveError}
      />
    );
  }

  return (
    <div className="onboarding-page relative flex min-h-dvh w-full flex-col">

      <StepMotion
        transitionKey={substep}
        className={cn(
          "flex min-h-0 flex-1 flex-col",
          substep === "channels" && "strategy-channels-composition lg:justify-center",
        )}
      >
        {activeSubstepContent}
        {substep === "channels" ? shellActions : null}
      </StepMotion>

      {substep === "channels" ? null : shellActions}
    </div>
  );
}
