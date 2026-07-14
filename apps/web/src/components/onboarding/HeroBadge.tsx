import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type HeroBadgeTone = "brand" | "success" | "warning" | "info";

type HeroBadgeProps = {
  icon: ReactNode;
  tone?: HeroBadgeTone;
  className?: string;
};

export function HeroBadge({ icon, tone = "brand", className }: HeroBadgeProps) {
  return (
    <span
      className={cn("onboarding-hero-badge", `onboarding-hero-badge--${tone}`, className)}
      aria-hidden
    >
      <span className="onboarding-hero-badge__icon">{icon}</span>
    </span>
  );
}
