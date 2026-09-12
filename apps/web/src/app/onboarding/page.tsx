import { guardOnboardingRoute } from "@/features/onboarding/public/server-guard";

export default async function OnboardingPage() {
  await guardOnboardingRoute();
  return null;
}
