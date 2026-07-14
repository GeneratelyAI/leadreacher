"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { AnimatedStepPresence } from "@/components/onboarding/AnimatedStepPresence";
import CampaignTypeClient from "@/components/onboarding/steps/CampaignTypeClient";
import ChannelsClient from "@/components/onboarding/steps/ChannelsClient";
import CheckoutClient from "@/components/onboarding/steps/CheckoutClient";
import DiscoveryClient from "@/components/onboarding/steps/DiscoveryClient";
import StrategyClient from "@/components/onboarding/steps/StrategyClient";
import VideoDecisionClient from "@/components/onboarding/steps/VideoDecisionClient";
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
import { createClient } from "@/lib/supabase/client";

function DiscoveryBootstrapBridge({
  activeStep,
}: {
  activeStep: OnboardingStepParam;
}) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function claimAnonymousScrape(): Promise<void> {
      const anonScrapeId = window.localStorage.getItem("lr_anon_scrape_id")?.trim();
      // Do not let a previous account's session-scoped cache hydrate while
      // bootstrap is resolving the authenticated organization. If bootstrap
      // fails, Discovery intentionally falls back to the website URL gate.
      clearDiscoveryOrgScope();

      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
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
    return <div className="onboarding-page min-h-dvh" />;
  }

  return <DiscoveryClient activeStep={activeStep} />;
}

export default function OnboardingFlowClient({
  initialStep,
  initialStrategySubstep = "how-it-works",
}: {
  initialStep: OnboardingStepParam;
  initialStrategySubstep?: StrategySubstepParam;
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
    activeStepContent = (
      <DiscoveryBootstrapBridge activeStep={activeStep} />
    );
  } else if (activeStep === "strategy") {
    activeStepContent = (
      <StrategyClient
        activeStep={activeStep}
        substep={activeStrategySubstep}
      />
    );
  } else if (activeStep === "campaign-type") {
    activeStepContent = <CampaignTypeClient />;
  } else if (activeStep === "video-decision") {
    activeStepContent = <VideoDecisionClient />;
  } else if (activeStep === "checkout") {
    activeStepContent = <CheckoutClient />;
  } else {
    activeStepContent = <ChannelsClient />;
  }

  return (
    <AnimatedStepPresence transitionKey={activeStep} className="min-h-dvh">
      {activeStepContent}
    </AnimatedStepPresence>
  );
}
