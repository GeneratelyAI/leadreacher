import { connection } from "next/server";
import { notFound } from "next/navigation";
import DemoDashboard from "@/features/onboarding/public/demo-dashboard";
import { isDemoOnboardingEnabled } from "@/lib/features/demo-onboarding";

export default async function DemoDashboardPage() {
  await connection();
  if (!isDemoOnboardingEnabled()) notFound();
  return <DemoDashboard />;
}
