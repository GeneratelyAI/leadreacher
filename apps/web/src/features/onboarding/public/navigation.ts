import { requestOnboardingNavigation } from "@/features/onboarding/components/OnboardingTransitionController";

export const ONBOARDING_ROUTES = [
  { id: "how-leadreacher-works", label: "How LeadReacher Works", path: "/onboarding/how-leadreacher-works" },
  { id: "discovery", label: "Discovery", path: "/onboarding/discovery" },
  { id: "campaign-content", label: "Campaign Content", path: "/onboarding/campaign-content" },
  { id: "personalized-video", label: "Personalized Video", path: "/onboarding/campaign-content/personalized-video" },
  { id: "ai-video", label: "AI Video", path: "/onboarding/campaign-content/ai-video" },
  { id: "your-video", label: "Your Video", path: "/onboarding/campaign-content/your-video" },
  { id: "document", label: "Document", path: "/onboarding/campaign-content/document" },
  { id: "cta", label: "Message and CTA", path: "/onboarding/cta" },
  { id: "channels", label: "Channels", path: "/onboarding/channels" },
  { id: "checkout", label: "Checkout", path: "/onboarding/checkout" },
  { id: "connect-channels", label: "Connect Channels", path: "/onboarding/connect-channels" },
] as const;

export type OnboardingRouteId = (typeof ONBOARDING_ROUTES)[number]["id"];

const routeById = new Map<OnboardingRouteId, string>(ONBOARDING_ROUTES.map((route) => [route.id, route.path]));
const idByPath = new Map<string, OnboardingRouteId>(ONBOARDING_ROUTES.map((route) => [route.path, route.id]));

export function isOnboardingRoute(value: string | null | undefined): value is OnboardingRouteId {
  return ONBOARDING_ROUTES.some((route) => route.id === value);
}

export function onboardingHref(route: OnboardingRouteId): string {
  return routeById.get(route) ?? ONBOARDING_ROUTES[0].path;
}

export function onboardingRouteFromPathname(pathname: string): OnboardingRouteId | null {
  return idByPath.get(pathname.replace(/\/$/, "")) ?? null;
}

export function getOnboardingRouteIndex(route: OnboardingRouteId): number {
  const sharedStage = route === "personalized-video" || route === "ai-video" || route === "your-video" || route === "document"
    ? "personalized-video"
    : route;
  return ONBOARDING_ROUTES.findIndex((item) => item.id === sharedStage);
}

/**
 * Lets the persistent onboarding canvas animate before Next processes the
 * named route. Direct loads and browser history still pass through server guards.
 */
export function navigateOnboarding(href: string, replace = false): void {
  if (typeof window === "undefined") return;

  const destination = window.location.pathname.startsWith("/onboarding-preview")
    ? href.replace(/^\/onboarding/, "/onboarding-preview")
    : window.location.pathname.startsWith("/demo/onboarding")
      ? href.replace(/^\/onboarding/, "/demo/onboarding")
      : href;

  if (requestOnboardingNavigation(destination, replace)) return;
  if (replace) window.history.replaceState(null, "", destination);
  else window.history.pushState(null, "", destination);
}
