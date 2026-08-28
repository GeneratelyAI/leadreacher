import {
  getOnboardingStepIndex,
  ONBOARDING_STEPS,
  type OnboardingStepParam,
} from "@/components/onboarding/steps/steps";
import { Check } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import type { CSSProperties } from "react";

type StepperProps = {
  activeStep: OnboardingStepParam;
  className?: string;
};

export function Stepper({
  activeStep,
  className,
}: StepperProps) {
  const activeIndex = getOnboardingStepIndex(activeStep);

  return (
    <nav
      aria-label="Onboarding progress"
      className={cn("onboarding-step-rail", className)}
      style={{
        "--onboarding-active-step": activeIndex,
        "--onboarding-active-translate": `${-(activeIndex + 0.5) * 9}rem`,
      } as CSSProperties}
    >
      <div className="onboarding-step-rail__viewport">
        <ol className="onboarding-step-rail__track">
          {ONBOARDING_STEPS.map((step, index) => {
            const distance = Math.abs(index - activeIndex);
            const isActive = index === activeIndex;
            const isComplete = index < activeIndex;

            return (
              <li
                key={step.value}
                className="onboarding-step-rail__item"
                data-distance={Math.min(distance, 3)}
                data-direction={index < activeIndex ? "before" : index > activeIndex ? "after" : "active"}
                data-progress={index <= activeIndex ? "complete" : "pending"}
                aria-current={isActive ? "step" : undefined}
              >
                <span className="onboarding-step-rail__connector" aria-hidden />
                <span
                  className={cn(
                    "onboarding-step-rail__marker",
                    isActive && "onboarding-step-rail__marker--active",
                    isComplete && "onboarding-step-rail__marker--complete",
                  )}
                  aria-hidden
                >
                  {isComplete ? <Check className="size-4" /> : null}
                </span>
                <span className={cn("onboarding-step-rail__label", isActive && "onboarding-step-rail__label--active", isComplete && "onboarding-step-rail__label--complete")}>{step.label}</span>
              </li>
            );
          })}
        </ol>
      </div>
      <span className="sr-only">Step {activeIndex + 1} of {ONBOARDING_STEPS.length}: {ONBOARDING_STEPS[activeIndex]?.label}</span>
    </nav>
  );
}
