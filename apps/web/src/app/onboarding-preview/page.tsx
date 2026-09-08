import { notFound } from "next/navigation";
import type { Viewport } from "next";
import { MobileReferencePreview } from "@/components/onboarding/MobileReferencePreview";
import { Preview } from "@/components/onboarding/Preview";
import {
  isOnboardingStep,
  isStrategySubstep,
  type OnboardingStepParam,
} from "@/components/onboarding/steps/steps";

type PreviewPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "light",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#ffffff" },
  ],
};

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function OnboardingPreviewPage({
  searchParams,
}: PreviewPageProps) {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.ENABLE_ONBOARDING_PREVIEW !== "true"
  ) {
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
    <div
      data-light-campaign-route
      className="onboarding-root min-h-dvh overflow-x-clip"
    >
      <MobileReferencePreview
        initialStep={initialStep}
        initialStrategySubstep={initialStrategySubstep}
      />
      <Preview />
    </div>
  );
}
