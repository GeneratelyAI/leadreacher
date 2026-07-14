"use client";

import { useRouter } from "next/navigation";
import { ArrowRight, Globe, Lock, Sparkles } from "lucide-react";
import { type FormEvent, useEffect, useLayoutEffect, useRef, useState } from "react";
import { CampaignSummaryPanel } from "@/components/onboarding/CampaignSummaryPanel";
import { HeroBadge } from "@/components/onboarding/HeroBadge";
import { OnboardingCard } from "@/components/onboarding/OnboardingCard";
import { OnboardingChrome } from "@/components/onboarding/OnboardingChrome";
import { OnboardingField } from "@/components/onboarding/OnboardingField";
import { Button } from "@/components/ui/Button";
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
import { strategyHref, type OnboardingStepParam } from "./steps";

const SHOW_CAMPAIGN_PILL = false;

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

export default function DiscoveryClient({
  activeStep = "discovery",
}: {
  activeStep?: OnboardingStepParam;
}) {
  useLayoutEffect(() => {
    applyStoredTheme();
  }, []);

  const router = useRouter();
  const [input, setInput] = useState("");
  const [isCompleting, setIsCompleting] = useState(false);
  const [completionError, setCompletionError] = useState<string | null>(null);
  const [summary, setSummary] = useState<DiscoverySummary>(summaryFromStoredScrape);
  const [websiteInput, setWebsiteInput] = useState("");
  const [websiteInputError, setWebsiteInputError] = useState<string | null>(null);
  const [isWebsiteStatusReady, setIsWebsiteStatusReady] = useState(false);
  const previousScrapeSourceRef = useRef<string | null>(null);
  const {
    status: scrapeStatus,
    hasStoredUrl,
    loading: isScrapeLoading,
    start: startWebsiteScrape,
  } = useWebsiteScrapeStatus({ context: "authenticated" });

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setIsWebsiteStatusReady(true));
    return () => window.cancelAnimationFrame(frame);
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
      router.push(strategyHref("how-it-works"));
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
    await startWebsiteScrape();
  }

  const hasCachedWebsiteSummary = summary.websiteEnriched;
  const isWebsiteGatePending =
    !hasStoredUrl &&
    !hasCachedWebsiteSummary &&
    (!isWebsiteStatusReady || isScrapeLoading);
  const shouldShowWebsiteGate =
    !isWebsiteGatePending && !hasStoredUrl && !hasCachedWebsiteSummary;

  return (
    <div className="onboarding-page relative h-dvh min-h-dvh w-full">
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
            <CampaignSummaryPanel summary={summary} />
          </OnboardingCard>
        </aside>
      ) : null}

      {isWebsiteGatePending ? (
        <section className="flex h-full min-h-0 flex-col items-center justify-center px-5 pt-24 pb-12">
          <OnboardingCard className="flex w-full max-w-xl flex-col items-center px-8 py-10 text-center sm:px-10">
            <HeroBadge className="animate-pulse" icon={<Sparkles className="size-6" />} />
          </OnboardingCard>
        </section>
      ) : shouldShowWebsiteGate ? (
        <section className="flex h-full min-h-0 flex-col items-center justify-center px-5 pt-24 pb-12">
          <OnboardingCard className="flex w-full max-w-xl flex-col items-center px-8 py-10 text-center sm:px-10">
            <HeroBadge icon={<Globe className="size-6" />} />
            <h1 className="mt-6 text-3xl font-bold tracking-tight text-onboarding-ink sm:text-4xl dark:text-onboarding-neutral-0">
              What&apos;s your website?
            </h1>
            <p className="mt-4 max-w-md text-base leading-7 text-onboarding-neutral-600 dark:text-onboarding-neutral-400">
              We&apos;ll use it to personalize your outreach strategy.
            </p>
            <form onSubmit={handleWebsiteSubmit} className="mt-8 w-full">
              <OnboardingField
                id="discovery-website-url"
                label="Company website"
                value={websiteInput}
                onChange={(event) => setWebsiteInput(event.target.value)}
                disabled={isScrapeLoading}
                error={websiteInputError}
                leading={<Globe className="size-5" aria-hidden />}
                trailing={
                  <Button
                    type="submit"
                    variant="brand"
                    size="icon"
                    disabled={isScrapeLoading || !websiteInput.trim()}
                    className="rounded-onboarding-pill"
                    aria-label="Analyze website"
                  >
                    <ArrowRight className="size-4" aria-hidden />
                  </Button>
                }
              />
            </form>
            <p className="mt-8 flex items-center justify-center gap-2 text-sm text-onboarding-neutral-500 dark:text-onboarding-neutral-400">
              <Lock className="size-4" aria-hidden />
              Your information is secure and private
            </p>
          </OnboardingCard>
        </section>
      ) : (
        <section className="flex h-full min-h-0 flex-col items-center justify-center px-5 pt-24 pb-12">
          <div className="mx-auto flex w-full max-w-3xl flex-col items-center text-center">
            <HeroBadge icon={<Sparkles className="size-7" />} />
            <h1 className="mt-6 text-3xl font-bold tracking-tight text-onboarding-ink sm:text-4xl dark:text-onboarding-neutral-0">
              One more thing...
            </h1>
            <p className="mt-5 max-w-xl text-base leading-8 text-onboarding-neutral-600 dark:text-onboarding-neutral-400">
              Before we generate your outreach strategy, tell us what makes your
              business different.
            </p>
            <form onSubmit={handleSubmit} className="mt-10 w-full max-w-2xl">
              <OnboardingField
                id="competitive-advantage"
                label="Describe your competitive advantage"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                disabled={isCompleting}
                error={completionError}
                trailing={
                  <Button
                    type="submit"
                    variant="brand"
                    size="icon"
                    disabled={isCompleting || !input.trim()}
                    className="rounded-onboarding-pill"
                    aria-label="Submit competitive advantage"
                  >
                    <ArrowRight className="size-4" aria-hidden />
                  </Button>
                }
              />
            </form>
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
