import { redirect } from "next/navigation";
import OnboardingFlowClient from "@/components/onboarding/OnboardingFlowClient";
import {
  isOnboardingStep,
  isStrategySubstep,
  type OnboardingStepParam,
  type StrategySubstepParam,
} from "@/components/onboarding/steps/steps";
import { bootstrapOrganizationServer, getStrategyServer } from "@/lib/api/server";
import { defaultOrgNameFromEmail } from "@/lib/auth/org-name";
import { resolveOnboardingResumeTarget } from "@/lib/onboarding-progress";
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

async function resolveDefaultStep(input: {
  accessToken: string;
  email: string;
}): Promise<{
  step: OnboardingStepParam;
  strategySubstep?: StrategySubstepParam;
}> {
  try {
    const bootstrap = await bootstrapOrganizationServer(
      input.accessToken,
      defaultOrgNameFromEmail(input.email),
    );
    const strategy = await getStrategyServer(input.accessToken, bootstrap.orgId);

    return resolveOnboardingResumeTarget({
      strategy: strategy
        ? {
            audienceAnalysisComplete: hasAudienceAnalysis(strategy),
            campaignType: strategy.campaignType,
            videoConfig: strategy.videoConfig,
          }
        : null,
      subscriptionStatus: bootstrap.subscriptionStatus,
    });
  } catch {
    return { step: "discovery" };
  }
}

async function resolveDefaultStrategySubstep(input: {
  accessToken: string;
  email: string;
}): Promise<StrategySubstepParam> {
  try {
    const { orgId } = await bootstrapOrganizationServer(
      input.accessToken,
      defaultOrgNameFromEmail(input.email),
    );
    const strategy = await getStrategyServer(input.accessToken, orgId);

    return hasAudienceAnalysis(strategy) ? "targeting" : "how-it-works";
  } catch {
    return "how-it-works";
  }
}

async function hasCompletedAudienceAnalysisForUser(input: {
  accessToken: string;
  email: string;
}): Promise<boolean> {
  try {
    const { orgId } = await bootstrapOrganizationServer(
      input.accessToken,
      defaultOrgNameFromEmail(input.email),
    );
    const strategy = await getStrategyServer(input.accessToken, orgId);

    return hasAudienceAnalysis(strategy);
  } catch {
    return false;
  }
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

  try {
    const bootstrap = await bootstrapOrganizationServer(
      session?.access_token ?? "",
      defaultOrgNameFromEmail(user.email ?? ""),
    );
    if (bootstrap.onboardedAt) {
      redirect("/home");
    }
  } catch {
    // Resume logic below retains its existing safe discovery fallback.
  }

  const params = searchParams ? await searchParams : {};
  const requestedStep = firstParam(params.step);
  const requestedSubstep = firstParam(params.substep);
  const requestedOnboardingStep = isOnboardingStep(requestedStep)
    ? requestedStep
    : null;
  const progressDefault = requestedOnboardingStep
    ? null
    : await resolveDefaultStep({
      accessToken: session?.access_token ?? "",
      email: user.email ?? "",
    });
  const initialStep: OnboardingStepParam =
    progressDefault?.step ?? requestedOnboardingStep ?? "discovery";
  const initialStrategySubstep =
    initialStep === "strategy"
      ? isStrategySubstep(requestedSubstep)
        ? requestedSubstep
        : progressDefault?.strategySubstep ??
          (await resolveDefaultStrategySubstep({
            accessToken: session?.access_token ?? "",
            email: user.email ?? "",
          }))
      : undefined;
  const canonicalStrategySubstep =
    initialStep === "strategy" && initialStrategySubstep === "channels"
      ? (await hasCompletedAudienceAnalysisForUser({
          accessToken: session?.access_token ?? "",
          email: user.email ?? "",
        }))
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
    <OnboardingFlowClient
      initialStep={initialStep}
      initialStrategySubstep={canonicalStrategySubstep}
    />
  );
}
