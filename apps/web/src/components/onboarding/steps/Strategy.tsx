"use client";

import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Building2,
  Check,
  FileText,
  Info,
  Loader2,
  Mail,
  Megaphone,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Send,
  Sparkles,
  TrendingUp,
  UserRound,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { StepMotion } from "@/components/onboarding/StepMotion";
import { ChannelLogo } from "@/components/onboarding/ChannelLogo";
import { OnboardingBadge } from "@/components/onboarding/OnboardingBadge";
import { OnboardingCard } from "@/components/onboarding/OnboardingCard";
import { OnboardingChrome } from "@/components/onboarding/OnboardingChrome";
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
  type OnboardingStepParam,
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
}: {
  canContinue: boolean;
  continueLabel?: string;
  onBack: () => void;
  onContinue: () => void;
}) {
  return (
    <ActionBar
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
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
      <OnboardingBadge icon={icon} />
      <h1 className="mt-5 text-3xl font-bold tracking-tight text-onboarding-ink sm:text-4xl dark:text-onboarding-neutral-0">
        {title}
      </h1>
      <p className="mt-4 max-w-lg text-base leading-7 text-onboarding-neutral-600 dark:text-onboarding-neutral-400">
        {subtitle}
      </p>
    </div>
  );
}

const WORK_CARDS = [
  {
    title: "Create Content",
    body: "We craft personalized messages and videos that resonate.",
    icon: FileText,
  },
  {
    title: "Find Buyers",
    body: "We identify high-fit companies, roles, and decision makers most likely to engage.",
    icon: Users,
  },
  {
    title: "Choose Channels",
    body: "We score every channel to find where your buyers are most active.",
    icon: BarChart3,
  },
  {
    title: "Launch Outreach",
    body: "We launch the multi-channel sequence and route replies back to you.",
    icon: Send,
  },
] as const;

function PreviewAvatar({
  src,
  className,
  showStatus = false,
}: {
  src: string;
  className?: string;
  showStatus?: boolean;
}) {
  return (
    <span className={cn("relative inline-flex shrink-0 rounded-full ring-2 ring-white", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        className="size-full rounded-full object-cover"
        aria-hidden
      />
      {showStatus ? (
        <span className="absolute right-0 bottom-0 size-2.5 rounded-full border-2 border-white bg-emerald-400" aria-hidden />
      ) : null}
    </span>
  );
}

function WorkCardPreview({ index }: { index: number }) {
  if (index === 0) {
    return (
      <div className="strategy-preview strategy-preview--content">
        <div className="strategy-preview__surface">
          <span className="strategy-preview__line strategy-preview__line--long" aria-hidden />
          <span className="strategy-preview__line strategy-preview__line--short" aria-hidden />
        </div>
        <span className="strategy-preview__chip strategy-preview__chip--play">
          <Play className="size-4 fill-current" aria-hidden />
        </span>
        <span className="strategy-preview__chip strategy-preview__chip--pencil">
          <Pencil className="size-3.5" aria-hidden />
        </span>
      </div>
    );
  }

  if (index === 1) {
    return (
      <div className="strategy-preview strategy-preview--buyers">
        <div className="strategy-preview__avatars">
          <PreviewAvatar src="/landing/portraits/prospect-44.webp" className="size-8" showStatus />
          <PreviewAvatar src="/landing/portraits/prospect-32.webp" className="strategy-preview__avatar--overlap size-8" />
          <PreviewAvatar src="/landing/portraits/prospect-68.webp" className="strategy-preview__avatar--overlap size-8" />
          <span className="strategy-preview__plus-avatar">
            <Plus className="size-4" aria-hidden />
          </span>
        </div>
        <div className="strategy-preview__profile">
          <span className="strategy-preview__person-chip">
            <UserRound className="size-4" aria-hidden />
          </span>
          <span className="strategy-preview__profile-line" aria-hidden />
          <span className="strategy-preview__check-chip">
            <Check className="size-4" aria-hidden />
          </span>
        </div>
      </div>
    );
  }

  if (index === 2) {
    return (
      <div className="strategy-preview strategy-preview--channels">
        <span className="strategy-preview__social-chip strategy-preview__social-chip--linkedin">
          <ChannelLogo name="linkedin" className="size-10" />
        </span>
        <span className="strategy-preview__social-chip strategy-preview__social-chip--whatsapp">
          <ChannelLogo name="whatsapp" className="size-6" />
        </span>
        <span className="strategy-preview__social-chip strategy-preview__social-chip--email">
          <Mail className="size-5" aria-hidden />
        </span>
        <span className="strategy-preview__social-chip strategy-preview__social-chip--plus">
          <Plus className="size-5" aria-hidden />
        </span>
      </div>
    );
  }

  return (
    <div className="strategy-preview strategy-preview--launch">
      <div className="strategy-preview__surface">
        <PreviewAvatar src="/landing/portraits/prospect-46.webp" className="size-8" showStatus />
        <div className="strategy-preview__launch-lines">
          <span className="strategy-preview__launch-line" aria-hidden />
          <span className="strategy-preview__launch-line strategy-preview__launch-line--short" aria-hidden />
        </div>
      </div>
      <span className="strategy-preview__chip strategy-preview__chip--send">
        <Send className="size-5 fill-current" aria-hidden />
      </span>
    </div>
  );
}

function HowItWorksScreen() {
  return (
    <section className="mx-auto flex w-full max-w-7xl flex-1 flex-col items-center justify-center px-5 pt-40 pb-44 h-compact:justify-start h-compact:pt-36 lg:pt-34 lg:pb-28">
      <ScreenHeader
        icon={<Sparkles className="size-8" aria-hidden />}
        title="How LeadReacher works"
        subtitle="We turn your insights into conversations and qualified opportunities."
      />

      <div className="mt-10 grid w-full grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {WORK_CARDS.map((card, index) => {
          const Icon = card.icon;
          return (
            <OnboardingCard
              key={card.title}
              className="app-card--interactive onboarding-work-card relative min-h-80 overflow-visible px-6 py-7 text-center"
            >
              {index < WORK_CARDS.length - 1 ? (
                <span className="onboarding-work-connector" aria-hidden>
                  <span className="onboarding-work-connector__line" />
                  <span className="onboarding-work-connector__dot" />
                  <span className="onboarding-work-connector__line" />
                </span>
              ) : null}
              <span className="onboarding-work-card__number">
                {index + 1}
              </span>
              <div className="onboarding-work-card__icon-orbit mx-auto mt-4">
                <span className="onboarding-work-card__icon-surface">
                  <Icon className="size-10" aria-hidden />
                </span>
              </div>
              <h2 className="mt-7 text-xl font-bold tracking-tight text-onboarding-ink dark:text-onboarding-neutral-0">
                {card.title}
              </h2>
              <p className="mt-3 text-sm leading-6 text-onboarding-neutral-600 dark:text-onboarding-neutral-400">
                {card.body}
              </p>
              <WorkCardPreview index={index} />
            </OnboardingCard>
          );
        })}
      </div>
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
    <div className="text-left">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold tracking-[0.12em] text-brand-purple uppercase">
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
            <span className="text-xs font-bold text-brand-purple">{String(item.step).padStart(2, "0")}</span>
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
      <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-5 pt-40 pb-44 h-compact:justify-start h-compact:pt-36 lg:pt-34 lg:pb-28">
        <ScreenHeader
          icon={<Users className="size-8" aria-hidden />}
          title="Who we're targeting"
          subtitle="Here's the audience we identified as the best fit for your business."
        />
        <LoadingStrategy strategyBrief={strategyBrief} />
      </section>
    );
  }

  if (error || !analysis || analysis.status !== "completed") {
    return (
      <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-5 pt-40 pb-44 h-compact:justify-start h-compact:pt-36 lg:pt-34 lg:pb-28">
        <ScreenHeader
          icon={<Users className="size-8" aria-hidden />}
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
      <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-5 pt-40 pb-44 h-compact:justify-start h-compact:pt-36 lg:pt-34 lg:pb-28">
        <ScreenHeader
          icon={<Users className="size-8" aria-hidden />}
          title="Your target audience"
          subtitle="The strategy is ready. Prospect results will come from your connected LinkedIn account."
        />
        <OnboardingCard className="mx-auto mt-8 w-full max-w-4xl px-6 py-7 sm:px-8">
          {strategyBrief ? <StrategyBriefContent brief={strategyBrief} audiencePending /> : null}
          <div className="mt-7 grid gap-4 border-t border-neutral-200 pt-7 dark:border-neutral-700 md:grid-cols-[1fr_auto] md:items-center">
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
    <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-5 pt-40 pb-44 h-compact:justify-start h-compact:pt-36 lg:pt-34 lg:pb-28">
      <ScreenHeader
        icon={<Users className="size-8" aria-hidden />}
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
    return <ChannelLogo name="linkedin" className="size-14" />;
  }
  if (channel === "whatsapp") {
    return <ChannelLogo name="whatsapp-mark" className="size-14" />;
  }
  if (channel === "instagram") {
    return <ChannelLogo name="instagram" className="size-12" />;
  }
  if (channel === "facebook") {
    return <ChannelLogo name="facebook" className="size-12" />;
  }
  return (
    <span className="inline-flex items-center gap-1.5" aria-label="Gmail and Outlook">
      <ChannelLogo name="gmail" className="size-9" />
      <ChannelLogo name="outlook" className="size-9" />
    </span>
  );
}

function ChannelsScreen({
  recommendations,
  isLoading,
  error,
}: {
  recommendations: ChannelRecommendation[];
  isLoading: boolean;
  error: string | null;
}) {
  if (isLoading) {
    return (
      <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-5 pt-40 pb-44 h-compact:justify-start h-compact:pt-36 lg:pt-34 lg:pb-28">
        <ScreenHeader
          icon={<Megaphone className="size-8" aria-hidden />}
          title="Recommended channels"
          subtitle="Loading your channel recommendations."
        />
      </section>
    );
  }

  if (error || recommendations.length === 0) {
    return (
      <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-5 pt-40 pb-44 h-compact:justify-start h-compact:pt-36 lg:pt-34 lg:pb-28">
        <ScreenHeader
          icon={<Megaphone className="size-8" aria-hidden />}
          title="Recommended channels"
          subtitle={error ?? "Channel recommendations are not available yet."}
        />
      </section>
    );
  }

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-5 pt-40 pb-44 h-compact:justify-start h-compact:pt-36 lg:pt-34 lg:pb-28">
      <ScreenHeader
        icon={<Megaphone className="size-8" aria-hidden />}
        title="Recommended channels"
        subtitle="These channels are proven to work best for reaching your audience based on our analysis."
      />

      <OnboardingCard className="mx-auto mt-8 w-full max-w-4xl px-6 py-8 sm:px-8">
        <div className="divide-y divide-neutral-100 dark:divide-white/18">
          {recommendations.map((item, index) => (
            <article key={item.channel} className="grid grid-cols-[2.5rem_4.5rem_minmax(0,1fr)] gap-5 py-6 first:pt-2 last:pb-2 md:grid-cols-[2.5rem_5rem_minmax(0,1fr)_11rem]">
              <span className="mt-3 inline-flex size-9 items-center justify-center rounded-full bg-brand-purple text-sm font-bold text-white">
                {index + 1}
              </span>
              <span className="inline-flex size-16 items-center justify-center">
                {channelIcon(item.channel)}
              </span>
              <div className="min-w-0">
                <h2 className="text-xl font-bold text-neutral-950 dark:text-onboarding-neutral-0">{item.label}</h2>
                <p className="mt-1 max-w-md text-sm leading-6 text-neutral-600 dark:text-onboarding-neutral-300">
                  {item.description}
                </p>
              </div>
              <div className="col-span-3 flex flex-col items-start gap-3 md:col-span-1 md:items-end">
                <span className="rounded-full bg-emerald-50 px-4 py-1.5 text-sm font-bold text-emerald-600 dark:bg-emerald-100 dark:text-emerald-800">
                  {item.confidence}% Confidence
                </span>
                <span className="flex items-center gap-2 text-sm text-neutral-600 dark:text-onboarding-neutral-300">
                  <Check className="size-4 text-brand-purple dark:text-onboarding-purple-300" aria-hidden />
                  {item.tag}
                </span>
              </div>
            </article>
          ))}
        </div>
      </OnboardingCard>

      <p className="mt-5 flex items-center justify-center gap-2 text-sm text-neutral-500 dark:text-onboarding-neutral-300">
        <Info className="size-4" aria-hidden />
        Confidence scores reflect channel fit before prospect enrichment.
      </p>
    </section>
  );
}

export default function Strategy({
  activeStep = "strategy",
  substep = "how-it-works",
}: {
  activeStep?: OnboardingStepParam;
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
  const strategyRunRef = useRef<AbortController | null>(null);
  const strategyWarmupRef = useRef<AbortController | null>(null);

  const analysis = useMemo(() => getAudienceAnalysis(strategy), [strategy]);
  const strategyBrief = useMemo(() => getStrategyBrief(strategy), [strategy]);
  const recommendations = useMemo(() => getChannelRecommendations(strategy?.channels), [strategy]);

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

  function handleContinue() {
    if (substep === "how-it-works") {
      navigateOnboarding(strategyHref("targeting"));
      return;
    }
    if (substep === "targeting") {
      navigateOnboarding(strategyHref("channels"));
      return;
    }
    navigateOnboarding(onboardingHref("campaign-type"));
  }

  function handleRetry() {
    startStrategyRun(true);
  }

  const canContinue =
    substep === "how-it-works" ||
    (substep === "channels" && recommendations.length > 0 && !strategyError) ||
    Boolean(analysis?.status === "completed" && recommendations.length > 0);

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
        isLoading={isLoadingStrategy}
        error={strategyError}
      />
    );
  }

  return (
    <div className="onboarding-page relative flex min-h-dvh w-full flex-col">
      <OnboardingChrome activeStep={activeStep} />

      <StepMotion transitionKey={substep} className="flex min-h-0 flex-1 flex-col">
        {activeSubstepContent}
      </StepMotion>

      <ShellActions
        canContinue={canContinue}
        onBack={handleBack}
        onContinue={handleContinue}
      />
    </div>
  );
}
