import {
  getOnboardingStepIndex,
  ONBOARDING_STEPS,
  type OnboardingStepParam,
} from "@/components/onboarding/steps/steps";
import { WorkflowStepper } from "@/components/ui/workflow-stepper";
import { cn } from "@/lib/utils";

type StepperProps = {
  activeStep: OnboardingStepParam;
  className?: string;
};

export function Stepper({
  activeStep,
  className,
}: StepperProps) {
  const activeIndex = getOnboardingStepIndex(activeStep);

  return <WorkflowStepper items={ONBOARDING_STEPS.map((step) => ({ id: step.value, label: step.label }))} activeIndex={activeIndex} ariaLabel="Onboarding progress" variant="light" className={cn("w-full", className)} />;
}
