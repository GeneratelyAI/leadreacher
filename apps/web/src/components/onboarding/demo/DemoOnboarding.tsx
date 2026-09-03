"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loading } from "@/components/ui/Loading";
import AuthForm from "@/components/auth/AuthForm";
import AuthLayout from "@/components/auth/AuthLayout";
import OnboardingFlow from "@/components/onboarding/OnboardingFlow";
import {
  isOnboardingStep,
  isStrategySubstep,
  type OnboardingStepParam,
} from "@/components/onboarding/steps/steps";
import { DemoOnboardingProvider, useDemoOnboarding } from "./DemoOnboardingProvider";

function DemoSignup() {
  const { dispatch } = useDemoOnboarding();

  return (
    <AuthLayout>
      <AuthForm
        mode="signup"
        demo
        onDemoComplete={({ fullName, email }) => {
          dispatch({ type: "complete-signup", name: fullName, email });
          window.history.replaceState(null, "", "/demo/onboarding?step=discovery");
        }}
      />
    </AuthLayout>
  );
}

function DemoFlow() {
  const searchParams = useSearchParams();
  const { ready } = useDemoOnboarding();
  const [hydrated, setHydrated] = useState(false);
  const requestedStep = searchParams.get("step");
  const requestedSubstep = searchParams.get("substep");

  useEffect(() => setHydrated(true), []);

  useEffect(() => {
    if (ready && !requestedStep) window.history.replaceState(null, "", "/demo/onboarding?step=signup");
  }, [ready, requestedStep]);

  if (!ready || !hydrated) {
    return <div className="grid min-h-dvh place-items-center"><Loading tone="brand" label="Loading demo workspace" /></div>;
  }
  if (!requestedStep || requestedStep === "signup") return <DemoSignup />;

  const initialStep: OnboardingStepParam = isOnboardingStep(requestedStep) ? requestedStep : "discovery";
  return (
    <OnboardingFlow
      preview
      initialStep={initialStep}
      initialStrategySubstep={isStrategySubstep(requestedSubstep) ? requestedSubstep : "how-it-works"}
    />
  );
}

export default function DemoOnboarding({ defaultWebsite }: { defaultWebsite?: string }) {
  return (
    <DemoOnboardingProvider defaultWebsite={defaultWebsite}>
      <Suspense fallback={<div className="min-h-dvh" />}><DemoFlow /></Suspense>
    </DemoOnboardingProvider>
  );
}
