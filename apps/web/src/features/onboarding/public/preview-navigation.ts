import {
  mobileReferenceHref,
  type MobileReferenceId,
} from "@/features/onboarding/state/mobile-reference";
import type { OnboardingStepParam, StrategySubstepParam } from "./navigation";

const FIXTURE_PARAMETERS = [
  "screen",
  "view",
  "review",
  "media",
  "edit",
  "placement",
  "completed",
] as const;

function withParams(params: URLSearchParams): string {
  const query = params.toString();
  return `/onboarding-preview${query ? `?${query}` : ""}`;
}

function withoutFixtureState(search: URLSearchParams): URLSearchParams {
  const params = new URLSearchParams(search);
  FIXTURE_PARAMETERS.forEach((parameter) => params.delete(parameter));
  return params;
}

/** Preview navigation is URL-only, so a copied URL reproduces the same scene. */
export function previewStepHref(search: URLSearchParams, step: OnboardingStepParam): string {
  const params = withoutFixtureState(search);
  params.set("step", step);
  if (step === "strategy") params.set("substep", "how-it-works");
  else params.delete("substep");
  return withParams(params);
}

export function previewStrategyHref(search: URLSearchParams, substep: StrategySubstepParam): string {
  const params = withoutFixtureState(search);
  params.set("step", "strategy");
  params.set("substep", substep);
  return withParams(params);
}

export function previewMobileReferenceHref(id: MobileReferenceId): string {
  return mobileReferenceHref(id);
}
