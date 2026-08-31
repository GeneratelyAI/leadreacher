import { connection } from "next/server";
import { notFound } from "next/navigation";
import DemoDashboard from "@/components/onboarding/demo/DemoDashboard";
import { isDemoOnboardingEnabled } from "@/lib/features/demo-onboarding";

export default async function DemoDashboardPage() {
  await connection();
  if (!isDemoOnboardingEnabled()) notFound();
  return <DemoDashboard />;
}
