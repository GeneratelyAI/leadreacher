import { requestOnboardingNavigation } from "@/features/onboarding/components/OnboardingTransitionController";

export const ONBOARDING_STEPS = [
  { value: "strategy", label: "Strategy" },
  { value: "discovery", label: "Discovery" },
  { value: "campaign-content", label: "Campaign Content" },
  { value: "personalized-video-style", label: "Personalized Video Style" },
  { value: "ai-video-style", label: "AI Video Style" },
  { value: "upload-video", label: "Upload Your Video" },
  { value: "upload-document", label: "Upload Document" },
  { value: "checkout", label: "Checkout" },
  { value: "channels", label: "Channels" },
] as const;

export const STRATEGY_SUBSTEPS = [
  "how-it-works",
  "targeting",
  "channels",
] as const;

export type OnboardingStepParam = (typeof ONBOARDING_STEPS)[number]["value"];
export type StrategySubstepParam = (typeof STRATEGY_SUBSTEPS)[number];

export function isOnboardingStep(value: string | null | undefined): value is OnboardingStepParam {
  return ONBOARDING_STEPS.some((step) => step.value === value);
}

export function isStrategySubstep(value: string | null | undefined): value is StrategySubstepParam {
  return STRATEGY_SUBSTEPS.some((substep) => substep === value);
}

export function getOnboardingStepIndex(step: OnboardingStepParam): number {
  return ONBOARDING_STEPS.findIndex((item) => item.value === step);
}

export function onboardingHref(step: OnboardingStepParam): string {
  return `/onboarding?step=${step}`;
}

export function strategyHref(substep: StrategySubstepParam): string {
  return `/onboarding?step=strategy&substep=${substep}`;
}

/**
 * Moves between already-rendered onboarding screens without requesting a new
 * server component payload. Direct loads still go through the server guard.
 */
export function navigateOnboarding(href: string, replace = false): void {
  if (typeof window === "undefined") return;

  const pathname = window.location.pathname;
  const destination = pathname === "/onboarding-preview"
    ? href.replace(/^\/onboarding/, "/onboarding-preview")
    : pathname === "/demo/onboarding"
      ? href.replace(/^\/onboarding/, "/demo/onboarding")
      : href;

  if (requestOnboardingNavigation(destination, replace)) return;

  if (replace) {
    window.history.replaceState(null, "", destination);
    return;
  }

  window.history.pushState(null, "", destination);
}
