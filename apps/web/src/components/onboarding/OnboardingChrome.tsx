"use client";

import Link from "next/link";
import { ThemeToggleButton } from "@/components/onboarding/AccountControls";
import { OnboardingLogo } from "@/components/onboarding/OnboardingLogo";
import { Stepper } from "@/components/onboarding/Stepper";
import type { OnboardingStepParam } from "@/components/onboarding/steps/steps";
import { useNavbarTheme } from "@/hooks/useNavbarTheme";
import { cn } from "@/lib/utils";

type ChromeProps = {
  activeStep: OnboardingStepParam;
};

export function OnboardingChrome({ activeStep }: ChromeProps) {
  const { isVisible } = useNavbarTheme();

  return (
    <header
      className={cn("onboarding-chrome", !isVisible && "onboarding-chrome--hidden")}
      inert={!isVisible}
    >
      <Link href="/" aria-label="LeadReacher home" className="onboarding-chrome__logo inline-flex min-h-11 items-center">
        <OnboardingLogo className="h-7 w-auto" />
      </Link>
      <Stepper activeStep={activeStep} className="onboarding-chrome__stepper" />
      <div className="onboarding-chrome__account">
        <ThemeToggleButton />
      </div>
    </header>
  );
}
