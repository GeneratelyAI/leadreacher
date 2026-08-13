import { redirect } from "next/navigation";
import OnboardingFlow from "@/components/onboarding/OnboardingFlow";
import {
  isOnboardingStep,
  isStrategySubstep,
  type OnboardingStepParam,
} from "@/components/onboarding/steps/steps";
import { bootstrapOrganizationServer, getStrategyServer } from "@/lib/api/server";
import { defaultOrgNameFromEmail } from "@/lib/auth/org-name";
import {
  resolveAllowedOnboardingStep,
  resolveOnboardingResumeTarget,
} from "@/lib/onboarding-progress";
import { createClient } from "@/lib/supabase/server";

type OnboardingPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function hasAudienceAnalysis(strategy: Awaited<ReturnType<typeof getStrategyServer>>): boolean {
  const icpDefinition = strategy?.icpDefinition;
  if (!icpDefinition || typeof icpDefinition !== "object" || Array.isArray(icpDefinition)) {
    return false;
  }

  const audienceAnalysis = (icpDefinition as Record<string, unknown>).audienceAnalysis;
  return Boolean(
    audienceAnalysis &&
      typeof audienceAnalysis === "object" &&
      !Array.isArray(audienceAnalysis) &&
      (audienceAnalysis as Record<string, unknown>).status === "completed",
  );
}

export default async function OnboardingPage({
  searchParams,
}: OnboardingPageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const accessToken = session?.access_token ?? "";
  let workspaceAccess: Awaited<ReturnType<typeof bootstrapOrganizationServer>>;
  try {
    workspaceAccess = await bootstrapOrganizationServer(
      accessToken,
      defaultOrgNameFromEmail(user.email ?? ""),
    );
  } catch {
    return <OnboardingFlow initialStep="discovery" />;
  }

  if (workspaceAccess.disabledAt) redirect("/recover-organization");
  if (!workspaceAccess.legalAccepted) redirect("/legal-consent");
  if (workspaceAccess.onboardedAt) redirect("/dashboard");

  let strategy: Awaited<ReturnType<typeof getStrategyServer>> = null;
  try {
    strategy = await getStrategyServer(accessToken, workspaceAccess.orgId);
  } catch {
    // The client-side Discovery bridge renders a retryable workspace error if
    // the API remains unavailable after hydration.
  }
  const progressDefault = resolveOnboardingResumeTarget({
    strategy: strategy
      ? {
          audienceAnalysisComplete: hasAudienceAnalysis(strategy),
          campaignType: strategy.campaignType,
          videoConfig: strategy.videoConfig,
        }
      : null,
    subscriptionStatus: workspaceAccess.subscriptionStatus,
  });

  const params = searchParams ? await searchParams : {};
  const requestedStep = firstParam(params.step);
  const requestedSubstep = firstParam(params.substep);
  const requestedOnboardingStep = isOnboardingStep(requestedStep)
    ? requestedStep
    : null;
  const initialStep: OnboardingStepParam = resolveAllowedOnboardingStep(
    requestedOnboardingStep,
    progressDefault.step,
  );
  const initialStrategySubstep =
    initialStep === "strategy"
      ? isStrategySubstep(requestedSubstep)
        ? requestedSubstep
        : progressDefault.strategySubstep ??
          (hasAudienceAnalysis(strategy) ? "targeting" : "how-it-works")
      : undefined;
  const canonicalStrategySubstep =
    initialStep === "strategy" && initialStrategySubstep === "channels"
      ? hasAudienceAnalysis(strategy)
        ? initialStrategySubstep
        : "how-it-works"
      : initialStrategySubstep;

  if (
    requestedStep !== initialStep ||
    (initialStep === "strategy" && requestedSubstep !== canonicalStrategySubstep)
  ) {
    const suffix = canonicalStrategySubstep
      ? `&substep=${canonicalStrategySubstep}`
      : "";
    redirect(`/onboarding?step=${initialStep}${suffix}`);
  }

  return (
    <OnboardingFlow
      initialStep={initialStep}
      initialStrategySubstep={canonicalStrategySubstep}
    />
  );
}
