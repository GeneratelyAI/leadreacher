"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { StepMotion } from "@/components/onboarding/StepMotion";
import { OnboardingChrome } from "@/components/onboarding/OnboardingChrome";
import { Button } from "@/components/ui/Button";
import CampaignGoal from "@/components/onboarding/steps/CampaignGoal";
import Channels from "@/components/onboarding/steps/Channels";
import Checkout from "@/components/onboarding/steps/Checkout";
import Discovery from "@/components/onboarding/steps/Discovery";
import Strategy from "@/components/onboarding/steps/Strategy";
import VideoSetup from "@/components/onboarding/steps/VideoSetup";
import {
  isOnboardingStep,
  isStrategySubstep,
  type OnboardingStepParam,
  type StrategySubstepParam,
} from "@/components/onboarding/steps/steps";
import { bootstrapOrganization } from "@/lib/api";
import { defaultOrgNameFromEmail } from "@/lib/auth/org-name";
import {
  clearDiscoveryOrgScope,
  promoteAnonymousDiscoveryCache,
} from "@/lib/discovery-scrape-cache";
import { getBrowserSession } from "@/lib/supabase/client";

function DiscoveryBootstrapBridge() {
  const [ready, setReady] = useState(false);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function claimAnonymousScrape(): Promise<void> {
      const anonScrapeId = window.localStorage.getItem("lr_anon_scrape_id")?.trim();
      // Do not let a previous account's session-scoped cache hydrate while
      // bootstrap is resolving the authenticated organization. If bootstrap
      // fails, Discovery intentionally falls back to the website URL gate.
      clearDiscoveryOrgScope();

      try {
        const session = await getBrowserSession();
        const user = session?.user;
        if (!user?.email) return;

        const bootstrap = await bootstrapOrganization(
          defaultOrgNameFromEmail(user.email),
          anonScrapeId || undefined,
        );
        promoteAnonymousDiscoveryCache(
          bootstrap.orgId,
          anonScrapeId || null,
          bootstrap.scrapeStatus,
        );
        window.localStorage.removeItem("lr_anon_scrape_id");
        window.localStorage.removeItem("lr_website_url");
      } catch (error) {
        if (!cancelled) {
          setBootstrapError(
            error instanceof Error
              ? error.message
              : "Unable to load your workspace.",
          );
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    }

    void claimAnonymousScrape();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) {
    return (
      <div
        className="onboarding-page flex min-h-dvh items-center justify-center px-5"
        role="status"
        aria-live="polite"
      >
        <p className="text-sm text-onboarding-neutral-600 dark:text-onboarding-neutral-400">Loading your workspace...</p>
      </div>
    );
  }

  if (bootstrapError) {
    return (
      <div className="onboarding-page flex min-h-dvh items-center justify-center px-5">
        <div className="w-full max-w-md text-center" role="alert">
          <h1 className="text-2xl font-semibold text-onboarding-ink dark:text-onboarding-neutral-0">
            We couldn&apos;t load your workspace
          </h1>
          <p className="mt-3 text-sm leading-6 text-onboarding-neutral-600 dark:text-onboarding-neutral-400">
            {bootstrapError}
          </p>
          <Button className="mt-6" variant="brand" onClick={() => window.location.reload()}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  return <Discovery />;
}

export default function OnboardingFlow({
  initialStep,
  initialStrategySubstep = "how-it-works",
  preview = false,
}: {
  initialStep: OnboardingStepParam;
  initialStrategySubstep?: StrategySubstepParam;
  preview?: boolean;
}) {
  const searchParams = useSearchParams();
  const queryStep = searchParams.get("step");
  const querySubstep = searchParams.get("substep");
  const activeStep = isOnboardingStep(queryStep) ? queryStep : initialStep;
  const activeStrategySubstep = isStrategySubstep(querySubstep)
    ? querySubstep
    : initialStrategySubstep;

  let activeStepContent: ReactNode;
  if (activeStep === "discovery") {
    activeStepContent = preview
      ? <Discovery />
      : <DiscoveryBootstrapBridge />;
  } else if (activeStep === "strategy") {
    activeStepContent = (
      <Strategy
        substep={activeStrategySubstep}
      />
    );
  } else if (activeStep === "campaign-type") {
    activeStepContent = <CampaignGoal />;
  } else if (activeStep === "video-decision") {
    activeStepContent = <VideoSetup />;
  } else if (activeStep === "checkout") {
    activeStepContent = <Checkout />;
  } else {
    activeStepContent = <Channels />;
  }

  return (
    <>
      <OnboardingChrome activeStep={activeStep} />
      <StepMotion
        transitionKey={activeStep === "strategy" ? `strategy:${activeStrategySubstep}` : activeStep}
        className="min-h-dvh"
      >
        {activeStepContent}
      </StepMotion>
    </>
  );
}
