import { notFound } from "next/navigation";
import type { Viewport } from "next";
import { MobileReferencePreview } from "@/features/onboarding/public/mobile-reference-preview";
import { Preview } from "@/features/onboarding/public/preview";
import {
  isOnboardingRoute,
} from "@/features/onboarding/public/navigation";
import { mobileReferenceState } from "@/features/onboarding/public/mobile-reference";

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
  const reference = mobileReferenceState(first(params.screen));
  const route = isOnboardingRoute(reference?.route) ? reference.route : "how-leadreacher-works";

  return (
    <div
      data-light-campaign-route
      className="onboarding-root min-h-dvh overflow-x-clip"
    >
      <MobileReferencePreview
        route={route}
      />
      <Preview />
    </div>
  );
}
