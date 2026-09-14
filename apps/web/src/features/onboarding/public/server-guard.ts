import { redirect } from "next/navigation";
import { defaultOrgNameFromEmail } from "@/features/organizations/public/naming";
import { bootstrapOrganizationServer, getStrategyServer } from "@/lib/api/server";
import { createClient } from "@/platform/auth/server";
import { contentChoiceRoute, resolveAllowedOnboardingRoute, resolveOnboardingResumeRoute } from "./progress";
import { onboardingHref, type OnboardingRouteId } from "./navigation";

const CONTENT_ROUTES = new Set<OnboardingRouteId>(["personalized-video", "ai-video", "your-video", "document"]);

export type OnboardingRouteAccess = {
  accessToken: string;
  orgId: string;
  subscriptionStatus: string | null;
};

export async function guardOnboardingRoute(requested?: OnboardingRouteId): Promise<OnboardingRouteAccess> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) redirect("/login");
  const accessToken = session.access_token;
  const workspace = await bootstrapOrganizationServer(accessToken, defaultOrgNameFromEmail(user.email ?? ""));
  if (workspace.disabledAt) redirect("/recover-organization");
  if (!workspace.legalAccepted) redirect("/legal-consent");
  if (workspace.onboardedAt) {
    if (requested === "live") {
      return { accessToken, orgId: workspace.orgId, subscriptionStatus: workspace.subscriptionStatus };
    }
    redirect("/dashboard");
  }

  const strategy = await getStrategyServer(accessToken, workspace.orgId);
  const earliest = resolveOnboardingResumeRoute({ strategy, subscriptionStatus: workspace.subscriptionStatus });
  if (!requested) redirect(onboardingHref(earliest));

  if (CONTENT_ROUTES.has(requested) && strategy && contentChoiceRoute(strategy) !== requested) {
    redirect(onboardingHref("campaign-content"));
  }

  const allowed = resolveAllowedOnboardingRoute(requested, earliest);
  if (allowed !== requested) redirect(onboardingHref(allowed));

  return { accessToken, orgId: workspace.orgId, subscriptionStatus: workspace.subscriptionStatus };
}
