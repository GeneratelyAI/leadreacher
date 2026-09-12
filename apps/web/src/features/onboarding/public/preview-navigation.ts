import { mobileReferenceHref, mobileReferenceState, type MobileReferenceId } from "@/features/onboarding/state/mobile-reference";
import { onboardingHref, onboardingRouteFromPathname, type OnboardingRouteId } from "./navigation";

export function previewSelection(search: URLSearchParams, pathname = "/onboarding-preview") {
  const reference = mobileReferenceState(search.get("screen"));
  const routePath = pathname.replace(/^\/onboarding-preview/, "/onboarding");
  return {
    route: reference?.route ?? onboardingRouteFromPathname(routePath) ?? "how-leadreacher-works",
    reference,
  };
}

function preservedParams(search: URLSearchParams): URLSearchParams {
  const params = new URLSearchParams();
  for (const key of ["capture", "media"] as const) {
    const value = search.get(key);
    if (value) params.set(key, value);
  }
  return params;
}

export function previewRouteHref(search: URLSearchParams, route: OnboardingRouteId): string {
  const params = preservedParams(search);
  const query = params.toString();
  return `${onboardingHref(route).replace(/^\/onboarding/, "/onboarding-preview")}${query ? `?${query}` : ""}`;
}

export function previewMobileReferenceHref(id: MobileReferenceId | ""): string {
  return id ? mobileReferenceHref(id) : "/onboarding-preview/how-leadreacher-works";
}
