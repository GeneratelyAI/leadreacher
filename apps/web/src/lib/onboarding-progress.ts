import type { OnboardingStepParam, StrategySubstepParam } from "@/components/onboarding/steps/steps";

type ResumeStrategy = {
  audienceAnalysisComplete: boolean;
  campaignType: string | null;
  videoConfig: unknown;
};

export type OnboardingResumeTarget = {
  step: OnboardingStepParam;
  strategySubstep?: StrategySubstepParam;
};

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
    return { step: "campaign-type" };
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
