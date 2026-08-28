import { notFound } from "next/navigation";
import OnboardingFlow from "@/components/onboarding/OnboardingFlow";
import { OnboardingPreviewToolbar } from "@/components/onboarding/OnboardingPreviewToolbar";
import {
  isOnboardingStep,
  isStrategySubstep,
  type OnboardingStepParam,
} from "@/components/onboarding/steps/steps";

type PreviewPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function OnboardingPreviewPage({ searchParams }: PreviewPageProps) {
  if (process.env.NODE_ENV === "production" && process.env.ENABLE_ONBOARDING_PREVIEW !== "true") {
    notFound();
  }

  const params = searchParams ? await searchParams : {};
  const requestedStep = first(params.step);
  const requestedSubstep = first(params.substep);
  const initialStep: OnboardingStepParam = isOnboardingStep(requestedStep)
    ? requestedStep
    : "strategy";
  const initialStrategySubstep = isStrategySubstep(requestedSubstep)
    ? requestedSubstep
    : "how-it-works";

  return (
    <div className="onboarding-root min-h-dvh overflow-x-clip">
      <OnboardingFlow
        preview
        initialStep={initialStep}
        initialStrategySubstep={initialStrategySubstep}
      />
      <OnboardingPreviewToolbar />
    </div>
  );
}
