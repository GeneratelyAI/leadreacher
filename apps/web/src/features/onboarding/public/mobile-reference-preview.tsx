"use client";

import { useLayoutEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthPreview } from "@/features/authentication/public/AuthPreview";
import {
  mobileReferenceWebsiteUrl,
  seedMobileReference,
} from "@/features/onboarding/public/preview-api";
import {
  mobileReferenceHref,
  mobileReferenceState,
} from "./mobile-reference";
import OnboardingFlow from "./flow";
import {
  isOnboardingRoute,
  type OnboardingRouteId,
} from "./navigation";

/** A fixture entry point, not a parallel application or production data fallback. */
export function MobileReferencePreview({
  route,
}: {
  route: OnboardingRouteId;
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
  if (reference?.route === "signup" || reference?.route === "login") {
    return (
      <AuthPreview
        mode={reference.route}
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
  const activeRoute = isOnboardingRoute(reference?.route) ? reference.route : route;
  return (
    <OnboardingFlow
      preview
      initialPreviewWebsiteUrl={
        screen ? mobileReferenceWebsiteUrl() : undefined
      }
      route={activeRoute}
    />
  );
}
