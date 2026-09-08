"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { StepMotion } from "@/features/onboarding/components/StepMotion";
import { OnboardingTransitionController } from "@/features/onboarding/components/OnboardingTransitionController";
import { OnboardingChrome } from "@/features/onboarding/components/OnboardingChrome";
import { CampaignCanvas } from "./canvas";
import { Button } from "@/components/ui/Button";
import { Loading } from "@/components/ui/Loading";
import AiVideoStyle from "@/features/onboarding/components/steps/AiVideoStyle";
import Channels from "@/features/onboarding/components/steps/Channels";
import Checkout from "@/features/onboarding/components/steps/Checkout";
import CampaignContent from "@/features/onboarding/components/steps/CampaignContent";
import Discovery from "@/features/onboarding/components/steps/Discovery";
import HowItWorks from "@/features/onboarding/components/steps/HowItWorks";
import PersonalizedVideoStyle from "@/features/onboarding/components/steps/PersonalizedVideoStyle";
import Strategy from "@/features/onboarding/components/steps/Strategy";
import UploadYourVideo from "@/features/onboarding/components/steps/UploadYourVideo";
import UploadDocument from "@/features/onboarding/components/steps/UploadDocument";
import {
  isOnboardingStep,
  isStrategySubstep,
  type OnboardingStepParam,
  type StrategySubstepParam,
} from "@/features/onboarding/public/navigation";
import { bootstrapOrganization } from "@/lib/api";
import { defaultOrgNameFromEmail } from "@/features/organizations/public/naming";
import {
  clearDiscoveryOrgScope,
  promoteAnonymousDiscoveryCache,
} from "@/features/onboarding/public/discovery-cache";
import { getBrowserSession } from "@/platform/auth/client";

function OnboardingBootstrapBridge({ children }: { children: ReactNode }) {
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
        <div className="flex flex-col items-center text-sm text-onboarding-neutral-600 dark:text-onboarding-neutral-400">
          <Loading tone="brand" label="Loading your workspace" className="-mb-4" />
          <p>Loading your workspace...</p>
        </div>
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

  return <>{children}</>;
}

export default function OnboardingFlow({
  initialStep,
  initialStrategySubstep = "how-it-works",
  preview = false,
  initialPreviewWebsiteUrl,
}: {
  initialStep: OnboardingStepParam;
  initialStrategySubstep?: StrategySubstepParam;
  preview?: boolean;
  initialPreviewWebsiteUrl?: string;
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
    activeStepContent = <Discovery />;
  } else if (activeStep === "strategy") {
    activeStepContent = activeStrategySubstep === "how-it-works"
      ? <HowItWorks />
      : <Strategy substep={activeStrategySubstep} />;
  } else if (activeStep === "campaign-content") {
    activeStepContent = <CampaignContent />;
  } else if (activeStep === "personalized-video-style") {
    activeStepContent = <PersonalizedVideoStyle preview={preview} placeholderPreview={preview && searchParams.get("media") === "placeholder"} />;
  } else if (activeStep === "ai-video-style") {
    activeStepContent = <AiVideoStyle preview={preview} placeholderPreview={preview && searchParams.get("media") === "placeholder"} initialStyle={preview && searchParams.get("screen") === "10" ? "casual" : undefined} />;
  } else if (activeStep === "upload-video") {
    activeStepContent = <UploadYourVideo preview={preview} selectedFileFixture={preview && searchParams.get("screen") === "11"} />;
  } else if (activeStep === "upload-document") {
    activeStepContent = <UploadDocument preview={preview} selectedFileFixture={preview && searchParams.get("screen") === "12"} />;
  } else if (activeStep === "checkout") {
    activeStepContent = <Checkout />;
  } else {
    activeStepContent = <Channels />;
  }

  const sceneKey = activeStep === "strategy" ? `strategy:${activeStrategySubstep}` : activeStep === "discovery" && searchParams.get("view") === "website" ? "website" : activeStep;

  const scene = (
    <CampaignCanvas initialWebsiteUrl={preview ? initialPreviewWebsiteUrl : undefined}>
      {activeStep === "discovery" || activeStep === "campaign-content" || activeStep === "personalized-video-style" || activeStep === "ai-video-style" || activeStep === "upload-video" || activeStep === "upload-document" || (activeStep === "strategy" && activeStrategySubstep === "how-it-works") ? null : <OnboardingChrome />}
      <OnboardingTransitionController sceneKey={sceneKey}>
        <StepMotion
          transitionKey={sceneKey}
          className="onboarding-flow-step h-dvh min-h-0"
          fitViewport={activeStep !== "discovery" && activeStep !== "campaign-content" && activeStep !== "personalized-video-style" && activeStep !== "ai-video-style" && activeStep !== "upload-video" && activeStep !== "upload-document" && !(activeStep === "strategy" && activeStrategySubstep === "how-it-works")}
        >
          {activeStepContent}
        </StepMotion>
      </OnboardingTransitionController>
    </CampaignCanvas>
  );

  return preview ? scene : <OnboardingBootstrapBridge>{scene}</OnboardingBootstrapBridge>;
}
