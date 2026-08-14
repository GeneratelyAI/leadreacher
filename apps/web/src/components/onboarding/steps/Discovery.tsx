"use client";

import { ArrowRight, Brain, Globe, Lock, PenLine, Sparkles } from "@/components/ui/icons";
import { type FormEvent, useEffect, useLayoutEffect, useRef, useState } from "react";
import { CampaignSummary } from "@/components/onboarding/CampaignSummary";
import { OnboardingBadge } from "@/components/onboarding/OnboardingBadge";
import { OnboardingCard } from "@/components/onboarding/OnboardingCard";
import { OnboardingChrome } from "@/components/onboarding/OnboardingChrome";
import { AiRecommendation } from "@/components/onboarding/AiRecommendation";
import { Button } from "@/components/ui/Button";
import { ActionInputBar } from "@/components/ui/action-input-bar";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  EMPTY_DISCOVERY_SUMMARY,
  type ChatMessage,
  type DiscoverySummary,
} from "@/hooks/useDiscovery";
import { applyStoredTheme } from "@/hooks/useThemeMode";
import {
  type WebsiteScrapeStatus,
  useWebsiteScrapeStatus,
} from "@/hooks/useWebsiteScrapeStatus";
import { apiFetch } from "@/lib/api";
import {
  discoveryScrapeSourceKey,
  getDiscoveryOrgScope,
  isDiscoveryScrapeCacheForOrg,
  readDiscoveryScrapeCache,
} from "@/lib/discovery-scrape-cache";
import { cleanWebsiteDomain } from "@/lib/website-url";
import { navigateOnboarding, strategyHref, type OnboardingStepParam } from "./steps";

const SHOW_CAMPAIGN_PILL = false;
const AI_RECOMMENDATION_TYPING_INTERVAL_MS = 18;

function limitRecommendationWords(text: string, maximum = 20): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= maximum) {
    return text.trim();
  }

  return `${words.slice(0, maximum).join(" ")}…`;
}

function buildAiRecommendation(summary: DiscoverySummary): string {
  const audience = summary.idealCustomer.trim() || "your ideal customers";
  const industry = summary.industry.trim();
  const offer = summary.businessModel.trim() || "your solution";
  const differentiator =
    summary.strengths.trim() || "a differentiated approach";

  return limitRecommendationWords(
    `We use ${differentiator} to help ${audience}${industry ? ` in ${industry}` : ""} get more value from ${offer}.`,
  );
}

function summaryFromStoredScrape(): DiscoverySummary {
  if (typeof window === "undefined") {
    return EMPTY_DISCOVERY_SUMMARY;
  }

  try {
    const cached = readDiscoveryScrapeCache();
    const orgId = getDiscoveryOrgScope();
    if (!isDiscoveryScrapeCacheForOrg(cached, orgId)) {
      return EMPTY_DISCOVERY_SUMMARY;
    }

    return {
      ...EMPTY_DISCOVERY_SUMMARY,
      businessModel: cached.offer ?? "",
      industry: cached.market ?? "",
      idealCustomer: cached.audience ?? "",
      strengths: cached.value ?? "",
      nextStep: cached.strategyStatus ?? "",
      websiteEnriched: true,
    };
  } catch {
    return EMPTY_DISCOVERY_SUMMARY;
  }
}

function summaryFromScrapeStatus(status: WebsiteScrapeStatus): DiscoverySummary {
  const websiteEnriched = Boolean(
    status.offer ||
      status.market ||
      status.audience ||
      status.value ||
      status.strategyStatus,
  );

  return {
    ...EMPTY_DISCOVERY_SUMMARY,
    businessModel: status.offer,
    industry: status.market,
    idealCustomer: status.audience,
    strengths: status.value,
    nextStep: status.strategyStatus,
    websiteEnriched,
  };
}

export default function Discovery({
  activeStep = "discovery",
}: {
  activeStep?: OnboardingStepParam;
}) {
  useLayoutEffect(() => {
    applyStoredTheme();
  }, []);

  const [input, setInput] = useState("");
  const [isCompleting, setIsCompleting] = useState(false);
  const [isTypingRecommendation, setIsTypingRecommendation] = useState(false);
  const [completionError, setCompletionError] = useState<string | null>(null);
  const [summary, setSummary] = useState<DiscoverySummary>(summaryFromStoredScrape);
  const [websiteInput, setWebsiteInput] = useState("");
  const [websiteInputError, setWebsiteInputError] = useState<string | null>(null);
  const [isWebsiteStatusReady, setIsWebsiteStatusReady] = useState(false);
  const previousScrapeSourceRef = useRef<string | null>(null);
  const recommendationTypingTimerRef = useRef<number | null>(null);
  const {
    status: scrapeStatus,
    hasStoredUrl,
    loading: isScrapeLoading,
    message: scrapeMessage,
    websiteUrl,
    start: startWebsiteScrape,
    retry: retryWebsiteScrape,
  } = useWebsiteScrapeStatus({ context: "authenticated" });

  useEffect(() => {
    if (websiteUrl && !websiteInput) {
      setWebsiteInput(websiteUrl);
    }
  }, [websiteInput, websiteUrl]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setIsWebsiteStatusReady(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    return () => {
      if (recommendationTypingTimerRef.current !== null) {
        window.clearTimeout(recommendationTypingTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const nextSummary = summaryFromScrapeStatus(scrapeStatus);
    const sourceKey = discoveryScrapeSourceKey(
      getDiscoveryOrgScope(),
      scrapeStatus.url,
    );

    setSummary((current) => {
      // The authenticated controller is module-scoped. Until its current org
      // scope is known, a snapshot may still belong to the last signed-in
      // account and must not merge into this user's summary.
      if (!sourceKey) {
        return current;
      }

      if (sourceKey && sourceKey !== previousScrapeSourceRef.current) {
        return nextSummary;
      }

      return {
        ...current,
        businessModel: current.businessModel || nextSummary.businessModel,
        industry: current.industry || nextSummary.industry,
        idealCustomer: current.idealCustomer || nextSummary.idealCustomer,
        strengths: current.strengths || nextSummary.strengths,
        nextStep: current.nextStep || nextSummary.nextStep,
        websiteEnriched: current.websiteEnriched || nextSummary.websiteEnriched,
      };
    });

    if (sourceKey) {
      previousScrapeSourceRef.current = sourceKey;
    }
  }, [scrapeStatus]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = input.trim();
    if (!value || isCompleting) {
      return;
    }

    setCompletionError(null);
    setIsCompleting(true);

    try {
      const nextSummary: DiscoverySummary = {
        ...summary,
        strengths: value,
        nextStep:
          summary.nextStep ||
          "Generate an outreach strategy based on the business differentiator.",
      };
      const messages: ChatMessage[] = [
        {
          role: "user",
          content: `Competitive advantage: ${value}`,
          timestamp: new Date(),
        },
      ];
      const result = await apiFetch<{ strategyId: string }>("/discovery/complete", {
        method: "POST",
        body: JSON.stringify({
          summary: nextSummary,
          messages: messages.map((message) => ({
            role: message.role,
            content: message.content,
          })),
        }),
      });

      window.localStorage.setItem("lr_strategy_id", result.strategyId);
      setSummary(nextSummary);
      navigateOnboarding(strategyHref("how-it-works"));
    } catch (error) {
      setCompletionError(
        error instanceof Error
          ? error.message
          : "Unable to save your discovery responses. Please try again.",
      );
    } finally {
      setIsCompleting(false);
    }
  }

  async function handleWebsiteSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanedDomain = cleanWebsiteDomain(websiteInput);
    if (!cleanedDomain) {
      setWebsiteInputError("Enter your website URL to continue.");
      return;
    }

    setWebsiteInputError(null);
    window.localStorage.setItem("lr_website_url", cleanedDomain);
    if (scrapeStatus.status === "failed") {
      await retryWebsiteScrape();
    } else {
      await startWebsiteScrape();
    }
  }

  function handleUseRecommendation() {
    const recommendation = buildAiRecommendation(summary);
    if (recommendationTypingTimerRef.current !== null) {
      window.clearTimeout(recommendationTypingTimerRef.current);
    }

    setInput("");
    setIsTypingRecommendation(true);
    let characterIndex = 0;

    const typeNextCharacter = () => {
      characterIndex += 1;
      setInput(recommendation.slice(0, characterIndex));

      if (characterIndex < recommendation.length) {
        recommendationTypingTimerRef.current = window.setTimeout(
          typeNextCharacter,
          AI_RECOMMENDATION_TYPING_INTERVAL_MS,
        );
        return;
      }

      recommendationTypingTimerRef.current = null;
      setIsTypingRecommendation(false);
      window.requestAnimationFrame(() => {
        document.getElementById("competitive-advantage")?.focus();
      });
    };

    typeNextCharacter();
  }

  function handleInputChange(value: string) {
    if (recommendationTypingTimerRef.current !== null) {
      window.clearTimeout(recommendationTypingTimerRef.current);
      recommendationTypingTimerRef.current = null;
      setIsTypingRecommendation(false);
    }
    setInput(value);
  }

  const hasCachedWebsiteSummary = summary.websiteEnriched;
  const isWebsiteGatePending =
    !hasCachedWebsiteSummary &&
    (!isWebsiteStatusReady ||
      isScrapeLoading ||
      (hasStoredUrl &&
        (scrapeStatus.status === "idle" || scrapeStatus.status === "running")));
  const shouldShowWebsiteGate =
    !isWebsiteGatePending &&
    !hasCachedWebsiteSummary &&
    (!hasStoredUrl || scrapeStatus.status === "failed");

  return (
    <div className="onboarding-page relative min-h-dvh w-full overflow-y-auto">
      <OnboardingChrome activeStep={activeStep} />

      {SHOW_CAMPAIGN_PILL ? (
        <aside className="fixed top-24 right-6 z-20 hidden w-80 lg:block">
          <OnboardingCard className="overflow-hidden" aria-live="polite">
            <div className="border-b border-onboarding-neutral-150 px-4 py-3 dark:border-onboarding-neutral-750">
              <p className="text-sm font-semibold text-onboarding-ink dark:text-onboarding-neutral-0">
                Your Campaign
              </p>
              <p className="mt-1 text-xs text-onboarding-neutral-500 dark:text-onboarding-neutral-400">
                Built from the information you&apos;ve shared.
              </p>
            </div>
            <CampaignSummary summary={summary} />
          </OnboardingCard>
        </aside>
      ) : null}

      {isWebsiteGatePending ? (
        <section className="flex min-h-dvh flex-col items-center justify-center px-5 pt-40 pb-24 h-compact:justify-start h-compact:pt-36 lg:pt-28">
          <OnboardingCard className="flex w-full max-w-xl flex-col items-center px-8 py-10 text-center sm:px-10" role="status" aria-live="polite">
            <OnboardingBadge className="animate-pulse" icon={<Sparkles className="size-6" />} />
            <h1 className="mt-6 text-3xl font-bold tracking-tight text-onboarding-ink sm:text-4xl dark:text-onboarding-neutral-0">
              Analyzing your website
            </h1>
            <p className="mt-4 max-w-md text-base leading-7 text-onboarding-neutral-600 dark:text-onboarding-neutral-400">
              We&apos;re building your acquisition brief. This can take a minute.
            </p>
          </OnboardingCard>
        </section>
      ) : shouldShowWebsiteGate ? (
        <section className="flex min-h-dvh flex-col items-center justify-center px-5 pt-40 pb-24 h-compact:justify-start h-compact:pt-36 lg:pt-28">
          <OnboardingCard className="flex w-full max-w-xl flex-col items-center px-8 py-10 text-center sm:px-10">
            <OnboardingBadge icon={<Globe className="size-6" />} />
            <h1 className="mt-6 text-3xl font-bold tracking-tight text-onboarding-ink sm:text-4xl dark:text-onboarding-neutral-0">
              What&apos;s your website?
            </h1>
            <p className="mt-4 max-w-md text-base leading-7 text-onboarding-neutral-600 dark:text-onboarding-neutral-400">
              {scrapeStatus.status === "failed"
                ? "We couldn't analyze that website. Check the address and try again."
                : "We'll use it to personalize your outreach strategy."}
            </p>
            <form onSubmit={handleWebsiteSubmit} className="mt-8 w-full">
              <Label htmlFor="discovery-website-url" className="sr-only">
                Company website
              </Label>
              <div className="relative">
                <Globe
                  className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-onboarding-purple-500"
                  aria-hidden
                />
                <Input
                  id="discovery-website-url"
                  type="text"
                  inputMode="url"
                  autoComplete="url"
                  placeholder="Company website"
                  value={websiteInput}
                  onChange={(event) => setWebsiteInput(event.target.value)}
                  disabled={isScrapeLoading}
                  aria-invalid={Boolean(websiteInputError)}
                  aria-describedby={websiteInputError ? "discovery-website-url-error" : undefined}
                  className="h-14 rounded-onboarding pr-14 pl-12 text-base shadow-onboarding-small"
                />
                <Button
                  type="submit"
                  variant="brand"
                  size="icon"
                  disabled={isScrapeLoading || !websiteInput.trim()}
                  className="absolute top-1/2 right-2 -translate-y-1/2 rounded-onboarding-pill"
                  aria-label="Analyze website"
                >
                  <ArrowRight className="size-4" aria-hidden />
                </Button>
              </div>
              {websiteInputError ? (
                <p id="discovery-website-url-error" role="alert" className="mt-1.5 text-[0.8125rem] text-onboarding-error-500">{websiteInputError}</p>
              ) : null}
              {!websiteInputError && scrapeMessage ? (
                <p className="mt-2 text-sm text-onboarding-error-500" role="alert">
                  {scrapeMessage}
                </p>
              ) : null}
            </form>
            <p className="mt-8 flex items-center justify-center gap-2 text-sm text-onboarding-neutral-500 dark:text-onboarding-neutral-400">
              <Lock className="size-4" aria-hidden />
              Your information is secure and private
            </p>
          </OnboardingCard>
        </section>
      ) : (
        <section className="flex min-h-dvh flex-col items-center justify-center px-5 pt-40 pb-24 h-compact:justify-start h-compact:pt-36 lg:pt-28">
          <div className="mx-auto flex w-full max-w-3xl flex-col items-center text-center">
            <PageHeader
              className="mx-auto"
              icon={<Brain className="size-7" aria-hidden />}
              eyebrow="Acquisition brief"
              title="One more thing..."
              description="Before we generate your outreach strategy, tell us what makes your business different."
            />
            <ActionInputBar
              id="competitive-advantage"
              value={input}
              onValueChange={handleInputChange}
              onSubmit={handleSubmit}
              placeholder="Describe your competitive advantage"
              submitLabel="Submit competitive advantage"
              disabled={isCompleting || isTypingRecommendation}
              loading={isCompleting}
              errorMessage={completionError}
              className="mt-10 max-w-2xl"
              leadingIcon={<PenLine className="size-5" aria-hidden />}
            />
            {!input.trim() && !isCompleting ? (
              <AiRecommendation
                recommendation={buildAiRecommendation(summary)}
                onUse={handleUseRecommendation}
                disabled={isCompleting || isTypingRecommendation}
                className="w-full max-w-2xl"
              />
            ) : null}
            <p className="mt-8 flex items-center justify-center gap-2 text-sm text-onboarding-neutral-500 dark:text-onboarding-neutral-400">
              <Lock className="size-4" aria-hidden />
              Your information is secure and private
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
