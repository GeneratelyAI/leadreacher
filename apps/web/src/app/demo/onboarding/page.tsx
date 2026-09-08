import { connection } from "next/server";
import { notFound } from "next/navigation";
import type { Viewport } from "next";
import DemoOnboarding from "@/features/onboarding/public/demo-flow";
import { isDemoOnboardingEnabled } from "@/lib/features/demo-onboarding";

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

export default async function DemoOnboardingPage() {
  await connection();
  if (!isDemoOnboardingEnabled()) notFound();
  return (
    <>
      <span data-light-campaign-route hidden />
      <DemoOnboarding defaultWebsite="https://acme.example" />
    </>
  );
}
