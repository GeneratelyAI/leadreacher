"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loading } from "@/components/ui/Loading";
import Form from "@/features/authentication/public/Form";
import Layout from "@/features/authentication/public/Layout";
import OnboardingFlow from "@/features/onboarding/public/flow";
import {
  isOnboardingStep,
  isStrategySubstep,
  type OnboardingStepParam,
} from "@/features/onboarding/public/navigation";
import { Provider, useDemoOnboarding } from "../components/demo/Provider";

function DemoSignup() {
  const { dispatch } = useDemoOnboarding();

  return (
    <Layout>
      <Form
        mode="signup"
        demo
        onDemoComplete={({ fullName, email }) => {
          dispatch({ type: "complete-signup", name: fullName, email });
          window.history.replaceState(null, "", "/demo/onboarding?step=strategy&substep=how-it-works");
        }}
      />
    </Layout>
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
    <Provider defaultWebsite={defaultWebsite}>
      <Suspense fallback={<div className="min-h-dvh" />}><DemoFlow /></Suspense>
    </Provider>
  );
}
