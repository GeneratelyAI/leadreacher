import { connection } from "next/server";
import { notFound } from "next/navigation";
import DemoOnboarding from "@/components/onboarding/demo/DemoOnboarding";
import { isDemoOnboardingEnabled } from "@/lib/features/demo-onboarding";

export default async function DemoOnboardingPage() {
  await connection();
  if (!isDemoOnboardingEnabled()) notFound();
  return <DemoOnboarding defaultWebsite="https://acme.example" />;
}
