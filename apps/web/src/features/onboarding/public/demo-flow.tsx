"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Loading } from "@/components/ui/Loading";
import Form from "@/features/authentication/public/Form";
import Layout from "@/features/authentication/public/Layout";
import OnboardingFlow from "@/features/onboarding/public/flow";
import {
  onboardingRouteFromPathname,
  type OnboardingRouteId,
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
          window.history.replaceState(null, "", "/demo/onboarding/how-leadreacher-works");
        }}
      />
    </Layout>
  );
}

function DemoFlow({ route }: { route?: OnboardingRouteId }) {
  const { ready } = useDemoOnboarding();
  const pathname = usePathname();
  const [hydrated, setHydrated] = useState(false);
  const activeRoute = onboardingRouteFromPathname(pathname.replace(/^\/demo\/onboarding/, "/onboarding")) ?? route;

  useEffect(() => setHydrated(true), []);

  if (!ready || !hydrated) {
    return <div className="grid min-h-dvh place-items-center"><Loading tone="brand" label="Loading demo workspace" /></div>;
  }
  if (!activeRoute) return <DemoSignup />;

  return (
    <OnboardingFlow
      preview
      route={activeRoute}
    />
  );
}

export default function DemoOnboarding({ defaultWebsite, route }: { defaultWebsite?: string; route?: OnboardingRouteId }) {
  return (
    <Provider defaultWebsite={defaultWebsite}>
      <Suspense fallback={<div className="min-h-dvh" />}><DemoFlow route={route} /></Suspense>
    </Provider>
  );
}
