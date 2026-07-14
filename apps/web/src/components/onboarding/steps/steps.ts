export const ONBOARDING_STEPS = [
  { value: "discovery", label: "Discovery" },
  { value: "strategy", label: "Strategy" },
  { value: "campaign-type", label: "Campaign Type" },
  { value: "video-decision", label: "Video Decision" },
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
