import Link from "next/link";
import { ThemeToggleButton } from "@/components/onboarding/OnboardingAccountControls";
import { OnboardingLogo } from "@/components/onboarding/OnboardingLogo";
import { OnboardingStepper } from "@/components/onboarding/OnboardingStepper";
import type { OnboardingStepParam } from "@/components/onboarding/steps/steps";

type OnboardingChromeProps = {
  activeStep: OnboardingStepParam;
};

export function OnboardingChrome({ activeStep }: OnboardingChromeProps) {
  return (
    <>
      <header className="onboarding-chrome">
        <Link href="/" aria-label="LeadReacher home" className="onboarding-chrome__logo">
          <OnboardingLogo className="h-7 w-auto" />
        </Link>
        <OnboardingStepper activeStep={activeStep} className="onboarding-chrome__stepper" />
        <div className="onboarding-chrome__account">
          <ThemeToggleButton />
        </div>
      </header>
      <div className="onboarding-chrome-mobile">
        <Link href="/" aria-label="LeadReacher home">
          <OnboardingLogo className="h-6 w-auto" />
        </Link>
        <ThemeToggleButton />
      </div>
      <div className="onboarding-chrome-mobile__stepper">
        <OnboardingStepper activeStep={activeStep} />
      </div>
    </>
  );
}
