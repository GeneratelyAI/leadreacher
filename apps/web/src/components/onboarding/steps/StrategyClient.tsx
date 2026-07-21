"use client";

import { useRouter } from "next/navigation";
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
import { AnimatedStepPresence } from "@/components/onboarding/AnimatedStepPresence";
import { ChannelLogo } from "@/components/onboarding/ChannelLogo";
import { HeroBadge } from "@/components/onboarding/HeroBadge";
import { OnboardingCard } from "@/components/onboarding/OnboardingCard";
import { OnboardingChrome } from "@/components/onboarding/OnboardingChrome";
import { Button } from "@/components/ui/Button";
import { applyStoredTheme } from "@/hooks/useThemeMode";
import { ApiError, apiFetch, bootstrapOrganization } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  onboardingHref,
  strategyHref,
  type OnboardingStepParam,
  type StrategySubstepParam,
} from "./steps";

type ChannelKey = "linkedin" | "email" | "whatsapp";
type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
type JsonRecord = { [key: string]: JsonValue };

type StrategyResponse = {
  id: string;
  orgId: string;
  icpDefinition: JsonValue;
  channels: JsonValue;
  updatedAt: string;
};

type AudienceAnalysis = {
  status: "completed" | "failed";
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

type ChannelRecommendation = {
  channel: ChannelKey;
  label: string;
  confidence: number;
  signalCount: number;
  totalProfiles: number;
  tag: string;
  description: string;
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

function getAudienceAnalysis(strategy: StrategyResponse | null): AudienceAnalysis | null {
  const icpDefinition = getRecord(strategy?.icpDefinition);
  const analysis = getRecord(icpDefinition.audienceAnalysis);
  const status = analysis.status;
  if (status !== "completed" && status !== "failed") {
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

function getChannelRecommendations(strategy: StrategyResponse | null): ChannelRecommendation[] {
  const channels = getRecord(strategy?.channels);
  if (!Array.isArray(channels.recommendations)) {
    return [];
  }

  return channels.recommendations.flatMap((item) => {
    if (!isRecord(item)) return [];
    const channel = toStringValue(item.channel);
    if (channel !== "linkedin" && channel !== "email" && channel !== "whatsapp") {
      return [];
    }

    return [{
      channel,
      label: toStringValue(item.label) || channel,
      confidence: toNumber(item.confidence),
      signalCount: toNumber(item.signalCount),
      totalProfiles: toNumber(item.totalProfiles),
      tag: toStringValue(item.tag),
      description: toStringValue(item.description),
    }];
  });
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
    <div className="pointer-events-none fixed inset-x-0 bottom-7 z-30 flex items-center justify-between px-6 sm:px-10">
      <Button
        type="button"
        variant="secondary"
        onClick={onBack}
        className="pointer-events-auto h-13 px-7 text-base"
      >
        <ArrowLeft className="size-5" aria-hidden />
        Back
      </Button>
      <Button
        type="button"
        variant="brand"
        disabled={!canContinue}
        onClick={onContinue}
        className="pointer-events-auto h-13 px-8 text-base sm:px-10"
      >
        {continueLabel}
        <ArrowRight className="size-5" aria-hidden />
      </Button>
    </div>
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
      <HeroBadge icon={icon} />
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
          <PreviewAvatar src="https://randomuser.me/api/portraits/women/44.jpg" className="size-8" showStatus />
          <PreviewAvatar src="https://randomuser.me/api/portraits/men/32.jpg" className="strategy-preview__avatar--overlap size-8" />
          <PreviewAvatar src="https://randomuser.me/api/portraits/women/68.jpg" className="strategy-preview__avatar--overlap size-8" />
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
          <ChannelLogo name="linkedin" className="size-5" />
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
        <PreviewAvatar src="https://randomuser.me/api/portraits/men/46.jpg" className="size-8" showStatus />
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
    <section className="mx-auto flex w-full max-w-7xl flex-1 flex-col items-center justify-center px-5 pb-28 pt-28 lg:pt-34">
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

function LoadingStrategy() {
  return (
    <OnboardingCard className="mx-auto mt-8 flex w-full max-w-3xl flex-col items-center px-6 py-8 text-center sm:px-8">
      <Loader2 className="size-9 animate-spin text-brand-purple" aria-hidden />
      <h2 className="mt-5 text-xl font-bold text-neutral-950">
        Running your audience analysis
      </h2>
      <p className="mt-3 max-w-md text-sm leading-6 text-neutral-600">
        We&apos;re querying Apify for matching companies and decision makers. This can take several seconds.
      </p>
    </OnboardingCard>
  );
}

function StrategyError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <OnboardingCard className="mx-auto mt-8 w-full max-w-3xl px-6 py-8 text-center sm:px-8">
      <Info className="mx-auto size-9 text-red-500" aria-hidden />
      <h2 className="mt-4 text-xl font-bold text-neutral-950">Audience analysis failed</h2>
      <p className="mt-3 text-sm leading-6 text-neutral-600">{message}</p>
      <Button
        type="button"
        variant="brand"
        onClick={onRetry}
        className="mt-6"
      >
        <RefreshCw className="size-4" aria-hidden />
        Retry analysis
      </Button>
    </OnboardingCard>
  );
}

function TargetingScreen({
  analysis,
  isLoading,
  error,
  onRetry,
}: {
  analysis: AudienceAnalysis | null;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  if (isLoading) {
    return (
      <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-5 pb-28 pt-28 lg:pt-34">
        <ScreenHeader
          icon={<Users className="size-8" aria-hidden />}
          title="Who we're targeting"
          subtitle="Here's the audience we identified as the best fit for your business."
        />
        <LoadingStrategy />
      </section>
    );
  }

  if (error || !analysis || analysis.status !== "completed") {
    return (
      <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-5 pb-28 pt-28 lg:pt-34">
        <ScreenHeader
          icon={<Users className="size-8" aria-hidden />}
          title="Who we're targeting"
          subtitle="Here's the audience we identified as the best fit for your business."
        />
        <StrategyError
          message={error ?? analysis?.error ?? "No completed audience analysis is available yet."}
          onRetry={onRetry}
        />
      </section>
    );
  }

  const maxIndustryCount = Math.max(...analysis.topIndustries.map((item) => item.count), 1);
  const companiesUnavailable = analysis.companies.status === "unavailable";

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-5 pb-28 pt-28 lg:pt-34">
      <ScreenHeader
        icon={<Users className="size-8" aria-hidden />}
        title="Who we're targeting"
        subtitle="Here's the audience we identified as the best fit for your business."
      />

      <OnboardingCard className="mx-auto mt-8 w-full max-w-4xl px-6 py-8 sm:px-8">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* Companies Metric */}
          <div className="metric-card">
            <div className="flex items-start justify-between">
              <div>
                <div className="metric-value">
                  {companiesUnavailable ? (
                    <span className="status-badge status-unavailable">Unavailable</span>
                  ) : (
                    analysis.companies.totalFound.toLocaleString()
                  )}
                </div>
                <div className="metric-label mt-2">Companies Found</div>
              </div>
              <div className="rounded-xl bg-brand-purple/8 p-2.5 text-brand-purple dark:bg-brand-purple/20 dark:text-brand-100">
                <Building2 className="size-6" aria-hidden />
              </div>
            </div>
            <div className="metric-hint mt-4">
              {companiesUnavailable
                ? "Decision-maker data remains available"
                : `${analysis.companies.sampleSize.toLocaleString()} sampled`}
            </div>
          </div>

          {/* Decision Makers Metric */}
          <div className="metric-card">
            <div className="flex items-start justify-between">
              <div>
                <div className="metric-value">{analysis.decisionMakers.totalFound.toLocaleString()}</div>
                <div className="metric-label mt-2">Decision Makers</div>
              </div>
              <div className="rounded-xl bg-info-50 p-2.5 text-info-500 dark:bg-info-500/15 dark:text-blue-200">
                <UserRound className="size-6" aria-hidden />
              </div>
            </div>
            <div className="metric-hint mt-4">
              {analysis.decisionMakers.sampleSize.toLocaleString()} profiles sampled
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
                        style={{ width: `${Math.max(8, percentageWidth(item.count, maxIndustryCount))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-neutral-200 pt-8 dark:border-neutral-700 md:border-t-0 md:border-l md:border-t-0 md:pl-8 md:pt-0">
            <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">Top Buyer Personas</h2>
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
    return <ChannelLogo name="linkedin" className="size-9" />;
  }
  if (channel === "whatsapp") {
    return <ChannelLogo name="whatsapp" className="size-9" />;
  }
  return <i className="fa-solid fa-envelope text-[1.9rem] leading-none" aria-hidden />;
}

function channelIconClass(channel: ChannelKey): string {
  if (channel === "linkedin") return "onboarding-channel-logo--linkedin";
  if (channel === "whatsapp") return "onboarding-channel-logo--whatsapp";
  return "onboarding-channel-logo--email";
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
      <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-5 pb-28 pt-28 lg:pt-34">
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
      <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-5 pb-28 pt-28 lg:pt-34">
        <ScreenHeader
          icon={<Megaphone className="size-8" aria-hidden />}
          title="Recommended channels"
          subtitle={error ?? "Channel recommendations are not available yet."}
        />
      </section>
    );
  }

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-5 pb-28 pt-28 lg:pt-34">
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
              <span
                className={cn(
                  "inline-flex size-16 items-center justify-center rounded-onboarding shadow-onboarding-button",
                  channelIconClass(item.channel),
                )}
              >
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
        Confidence scores are based on reachability and engagement potential.
      </p>
    </section>
  );
}

export default function StrategyClient({
  activeStep = "strategy",
  substep = "how-it-works",
}: {
  activeStep?: OnboardingStepParam;
  substep?: StrategySubstepParam;
}) {
  useLayoutEffect(() => {
    applyStoredTheme();
  }, []);

  const router = useRouter();
  const [strategy, setStrategy] = useState<StrategyResponse | null>(null);
  const [isLoadingStrategy, setIsLoadingStrategy] = useState(false);
  const [strategyError, setStrategyError] = useState<string | null>(null);
  const generationStartedRef = useRef(false);

  const analysis = useMemo(() => getAudienceAnalysis(strategy), [strategy]);
  const recommendations = useMemo(() => getChannelRecommendations(strategy), [strategy]);

  const loadStrategy = useCallback(async (forceGenerate: boolean, allowGenerate = true) => {
    setIsLoadingStrategy(true);
    setStrategyError(null);
    try {
      const { orgId } = await bootstrapOrganization("LeadReacher");
      let current: StrategyResponse | null = null;

      if (!forceGenerate) {
        try {
          current = await apiFetch<StrategyResponse>(`/strategy/${orgId}`);
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
      if (currentAnalysis?.status === "failed" && !forceGenerate) {
        setStrategy(current);
        setStrategyError(currentAnalysis.error ?? "Audience analysis failed.");
        return;
      }
      if (!allowGenerate && !forceGenerate) {
        setStrategy(current);
        setStrategyError("No completed audience analysis is available yet.");
        return;
      }

      const generated = await apiFetch<StrategyResponse>("/strategy/generate", {
        method: "POST",
      });
      const generatedAnalysis = getAudienceAnalysis(generated);
      setStrategy(generated);
      if (generatedAnalysis?.status === "failed") {
        setStrategyError(generatedAnalysis.error ?? "Audience analysis failed.");
      }
    } catch (error) {
      setStrategyError(
        error instanceof Error
          ? error.message
          : "Unable to generate your strategy. Please retry.",
      );
    } finally {
      setIsLoadingStrategy(false);
    }
  }, []);

  useEffect(() => {
    if (
      (substep !== "targeting" && substep !== "channels") ||
      generationStartedRef.current
    ) {
      return;
    }
    generationStartedRef.current = true;
    void loadStrategy(false, substep === "targeting");
  }, [loadStrategy, substep]);

  function handleBack() {
    if (substep === "how-it-works") {
      router.push(onboardingHref("discovery"));
      return;
    }
    if (substep === "targeting") {
      router.push(strategyHref("how-it-works"));
      return;
    }
    router.push(strategyHref("targeting"));
  }

  function handleContinue() {
    if (substep === "how-it-works") {
      router.push(strategyHref("targeting"));
      return;
    }
    if (substep === "targeting") {
      router.push(strategyHref("channels"));
      return;
    }
    router.push(onboardingHref("campaign-type"));
  }

  function handleRetry() {
    generationStartedRef.current = true;
    void loadStrategy(true);
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
        isLoading={isLoadingStrategy}
        error={strategyError}
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
    <div className="onboarding-page relative flex h-dvh min-h-dvh w-full flex-col overflow-y-auto">
      <OnboardingChrome activeStep={activeStep} />

      <AnimatedStepPresence transitionKey={substep} className="flex min-h-0 flex-1 flex-col">
        {activeSubstepContent}
      </AnimatedStepPresence>

      <ShellActions
        canContinue={canContinue}
        onBack={handleBack}
        onContinue={handleContinue}
      />
    </div>
  );
}
