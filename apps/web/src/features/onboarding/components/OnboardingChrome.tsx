"use client";

import Link from "next/link";
import { ThemeButton } from "@/features/onboarding/components/AccountControls";
import { OnboardingLogo } from "@/platform/branding/OnboardingLogo";
import { useNavbarTheme } from "@/hooks/useNavbarTheme";
import { cn } from "@/lib/utils";

export function OnboardingChrome() {
  const { isVisible } = useNavbarTheme();

  return (
    <header
      className={cn("onboarding-chrome", !isVisible && "onboarding-chrome--hidden")}
      inert={!isVisible}
    >
      <Link href="/" aria-label="LeadReacher home" className="onboarding-chrome__logo inline-flex min-h-11 items-center">
        <OnboardingLogo className="landing-navbar-logo onboarding-brand-wordmark" />
      </Link>
      <div className="onboarding-chrome__account">
        <ThemeButton />
      </div>
    </header>
  );
}
