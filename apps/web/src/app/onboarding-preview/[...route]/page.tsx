import { notFound } from "next/navigation";
import type { Viewport } from "next";
import { MobileReferencePreview } from "@/features/onboarding/public/mobile-reference-preview";
import { Preview } from "@/features/onboarding/public/preview";
import { isOnboardingRoute, onboardingRouteFromPathname } from "@/features/onboarding/public/navigation";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "light",
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#ffffff" }, { media: "(prefers-color-scheme: dark)", color: "#ffffff" }],
};

export default async function OnboardingPreviewRoutePage({ params }: { params: Promise<{ route: string[] }> }) {
  if (process.env.NODE_ENV === "production" && process.env.ENABLE_ONBOARDING_PREVIEW !== "true") notFound();
  const segments = (await params).route;
  const route = onboardingRouteFromPathname(`/onboarding/${segments.join("/")}`);
  if (!isOnboardingRoute(route)) notFound();
  return <div data-light-campaign-route className="onboarding-root min-h-dvh overflow-x-clip">
    <MobileReferencePreview route={route} />
    <Preview />
  </div>;
}
