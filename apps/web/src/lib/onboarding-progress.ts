import {
  getOnboardingStepIndex,
  type OnboardingStepParam,
  type StrategySubstepParam,
} from "@/components/onboarding/steps/steps";

type ResumeStrategy = {
  audienceAnalysisComplete: boolean;
  campaignType: string | null;
  videoConfig: unknown;
};

function needsVideoStyle(videoConfig: unknown): boolean {
  if (!videoConfig || typeof videoConfig !== "object" || Array.isArray(videoConfig)) {
    return true;
  }

  const config = videoConfig as Record<string, unknown>;
  if (config.enabled !== true) return false;

  const tone = config.tone;
  return tone !== "professional" && tone !== "casual" && tone !== "aggressive";
}

export type OnboardingResumeTarget = {
  step: OnboardingStepParam;
  strategySubstep?: StrategySubstepParam;
};

export function resolveAllowedOnboardingStep(
  requested: OnboardingStepParam | null,
  earned: OnboardingStepParam,
): OnboardingStepParam {
  if (!requested) return earned;

  return getOnboardingStepIndex(requested) <= getOnboardingStepIndex(earned)
    ? requested
    : earned;
}

export function resolveOnboardingResumeTarget(input: {
  strategy: ResumeStrategy | null;
  subscriptionStatus: string | null | undefined;
}): OnboardingResumeTarget {
  if (!input.strategy) {
    return { step: "discovery" };
  }

  if (!input.strategy.audienceAnalysisComplete) {
    return { step: "strategy", strategySubstep: "how-it-works" };
  }

  if (!input.strategy.campaignType) {
    return { step: "campaign-content" };
  }


  if (
    input.strategy.campaignType === "personalized_outreach" &&
    needsVideoStyle(input.strategy.videoConfig)
  ) {
    return { step: "personalized-video-style" };
  }

  if (input.strategy.videoConfig === null || input.strategy.videoConfig === undefined) {
    return { step: "video-decision" };
  }

  if (input.subscriptionStatus !== "active") {
    return { step: "checkout" };
  }

  // Both an unfinished channel connection and a completed onboarding end on
  // the Channels screen: it remains the safe place to connect or review
  // required outreach channels.
  return { step: "channels" };
}
