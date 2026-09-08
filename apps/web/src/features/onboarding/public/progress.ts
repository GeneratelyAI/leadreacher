import {
  getOnboardingStepIndex,
  type OnboardingStepParam,
  type StrategySubstepParam,
} from "@/features/onboarding/public/navigation";

type ResumeStrategy = {
  audienceAnalysisComplete: boolean;
  campaignType: string | null;
  videoConfig: unknown;
  introductionSeen?: boolean;
  prospectsApproved?: boolean;
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

function needsUploadedVideo(videoConfig: unknown): boolean {
  if (!videoConfig || typeof videoConfig !== "object" || Array.isArray(videoConfig)) {
    return true;
  }

  const config = videoConfig as Record<string, unknown>;
  return config.source !== "uploaded" || typeof config.uploadedVideoUrl !== "string" || !config.uploadedVideoUrl;
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

  if (!input.strategy.audienceAnalysisComplete && input.strategy.prospectsApproved !== true && !input.strategy.campaignType) {
    if (input.strategy.introductionSeen) return { step: "discovery" };
    return { step: "strategy", strategySubstep: "how-it-works" };
  }

  if (input.strategy.prospectsApproved === false) return input.strategy.introductionSeen
    ? { step: "discovery" } : { step: "strategy", strategySubstep: "how-it-works" };

  if (!input.strategy.campaignType) {
    return { step: "campaign-content" };
  }

  if (
    input.strategy.campaignType === "personalized_outreach" &&
    needsVideoStyle(input.strategy.videoConfig)
  ) {
    return { step: "personalized-video-style" };
  }

  if (
    input.strategy.campaignType === "ai_video_ad" &&
    needsVideoStyle(input.strategy.videoConfig)
  ) {
    return { step: "ai-video-style" };
  }

  if (
    input.strategy.campaignType === "uploaded_video" &&
    needsUploadedVideo(input.strategy.videoConfig)
  ) {
    return { step: "upload-video" };
  }

  if (input.strategy.videoConfig === null || input.strategy.videoConfig === undefined) {
    return { step: "campaign-content" };
  }

  if (input.subscriptionStatus !== "active") {
    return { step: "checkout" };
  }

  // Both an unfinished channel connection and a completed onboarding end on
  // the Channels screen: it remains the safe place to connect or review
  // required outreach channels.
  return { step: "channels" };
}
