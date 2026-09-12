import { connection } from "next/server";
import { notFound } from "next/navigation";
import DemoOnboarding from "@/features/onboarding/public/demo-flow";
import { isDemoOnboardingEnabled } from "@/lib/features/demo-onboarding";
import { onboardingRouteFromPathname } from "@/features/onboarding/public/navigation";

export default async function DemoOnboardingRoutePage({ params }: { params: Promise<{ route: string[] }> }) {
  await connection();
  if (!isDemoOnboardingEnabled()) notFound();
  const route = onboardingRouteFromPathname(`/onboarding/${(await params).route.join("/")}`);
  if (!route) notFound();
  return <><span data-light-campaign-route hidden /><DemoOnboarding defaultWebsite="https://acme.example" route={route} /></>;
}
