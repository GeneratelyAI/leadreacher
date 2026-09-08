"use client";

import { useLayoutEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthPreview } from "@/components/auth/AuthPreview";
import {
  mobileReferenceWebsiteUrl,
  seedMobileReference,
} from "@/lib/onboarding/preview-api";
import {
  mobileReferenceHref,
  mobileReferenceState,
} from "@/lib/onboarding/mobile-reference";
import OnboardingFlow from "./OnboardingFlow";
import {
  isOnboardingStep,
  type OnboardingStepParam,
  type StrategySubstepParam,
} from "./steps/steps";

/** A fixture entry point, not a parallel application or production data fallback. */
export function MobileReferencePreview({
  initialStep,
  initialStrategySubstep,
}: {
  initialStep: OnboardingStepParam;
  initialStrategySubstep: StrategySubstepParam;
}) {
  const params = useSearchParams();
  const router = useRouter();
  const reference = mobileReferenceState(params.get("screen"));
  const [initialized, setInitialized] = useState<string | null>(null);
  const screen = reference?.id ?? null;
  useLayoutEffect(() => {
    if (!screen) return;
    seedMobileReference(screen);
    setInitialized(screen);
  }, [screen]);

  if (screen && initialized !== screen)
    return (
      <div
        className="min-h-dvh bg-white"
        role="status"
        aria-label="Preparing local preview"
      />
    );
  if (reference?.step === "signup" || reference?.step === "login") {
    return (
      <AuthPreview
        mode={reference.step}
        onComplete={() => router.push(mobileReferenceHref("03"))}
        campaign={{
          site: {
            label: "acme.example",
            iconUrl: "/logo/leadreacher_icon_colored.svg",
          },
          fields: [],
          status: "learning",
          statusLabel: "Website added",
        }}
      />
    );
  }
  const step = isOnboardingStep(reference?.step) ? reference.step : initialStep;
  return (
    <OnboardingFlow
      preview
      initialPreviewWebsiteUrl={
        screen ? mobileReferenceWebsiteUrl() : undefined
      }
      initialStep={step}
      initialStrategySubstep={initialStrategySubstep}
    />
  );
}
