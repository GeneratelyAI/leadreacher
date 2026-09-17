"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Loading } from "@/components/ui/Loading";
import OnboardingFlow from "@/features/onboarding/public/flow";
import {
  onboardingRouteFromPathname,
  type OnboardingRouteId,
} from "@/features/onboarding/public/navigation";
import { Provider, useDemoOnboarding } from "../components/demo/Provider";

function DemoFlow({ route }: { route?: OnboardingRouteId }) {
  const { ready } = useDemoOnboarding();
  const pathname = usePathname();
  const [hydrated, setHydrated] = useState(false);
  const requestedRoute = onboardingRouteFromPathname(pathname.replace(/^\/demo\/onboarding/, "/onboarding"));
  const activeRoute = requestedRoute ?? route ?? "how-leadreacher-works";

  useEffect(() => {
    setHydrated(true);
    if (!requestedRoute && !route) {
      window.history.replaceState(null, "", "/demo/onboarding/how-leadreacher-works");
    }
  }, [requestedRoute, route]);

  if (!ready || !hydrated) {
    return <div className="grid min-h-dvh place-items-center"><Loading tone="brand" label="Loading demo workspace" /></div>;
  }
  return (
    <OnboardingFlow
      fixture
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
