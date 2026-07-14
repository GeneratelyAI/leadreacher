import { Check } from "lucide-react";
import {
  getOnboardingStepIndex,
  ONBOARDING_STEPS,
  type OnboardingStepParam,
} from "@/components/onboarding/steps/steps";
import { cn } from "@/lib/utils";

type OnboardingStepperProps = {
  activeStep: OnboardingStepParam;
  className?: string;
};

export function OnboardingStepper({
  activeStep,
  className,
}: OnboardingStepperProps) {
  const activeIndex = getOnboardingStepIndex(activeStep);

  return (
    <nav className={cn("onboarding-stepper", className)} aria-label="Onboarding progress">
      <ol className="grid grid-cols-6">
        {ONBOARDING_STEPS.map((step, index) => {
          const isActive = index === activeIndex;
          const isCompleted = index < activeIndex;

          return (
            <li key={step.value} className="onboarding-stepper__item">
              {index > 0 ? (
                <span
                  className={cn(
                    "onboarding-stepper__connector",
                    isCompleted || isActive
                      ? "onboarding-stepper__connector--complete"
                      : "onboarding-stepper__connector--pending",
                  )}
                  aria-hidden
                />
              ) : null}
              <span
                className={cn(
                  "onboarding-stepper__number",
                  isActive && "onboarding-stepper__number--active",
                  isCompleted && "onboarding-stepper__number--complete",
                )}
              >
                {isCompleted ? <Check className="size-3" aria-hidden /> : index + 1}
              </span>
              <span
                className={cn(
                  "onboarding-stepper__label",
                  (isActive || isCompleted) && "onboarding-stepper__label--active",
                )}
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
