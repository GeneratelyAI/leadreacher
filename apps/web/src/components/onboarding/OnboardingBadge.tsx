import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type OnboardingBadgeTone = "brand" | "success" | "warning" | "info";

type OnboardingBadgeProps = {
  icon: ReactNode;
  tone?: OnboardingBadgeTone;
  className?: string;
};

export function OnboardingBadge({ icon, tone = "brand", className }: OnboardingBadgeProps) {
  return (
    <span
      className={cn("onboarding-hero-badge", `onboarding-hero-badge--${tone}`, className)}
      aria-hidden
    >
      <span className="onboarding-hero-badge__icon">{icon}</span>
    </span>
  );
}
