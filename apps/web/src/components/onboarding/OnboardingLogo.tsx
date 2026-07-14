"use client";

import { useThemeMode } from "@/hooks/useThemeMode";
import { ASSETS } from "@/lib/constants/brand";
import { cn } from "@/lib/utils";

export function OnboardingLogo({
  className = "h-6 w-auto",
}: {
  className?: string;
}) {
  const { isDark } = useThemeMode();
  const transitionClass = "transition-opacity duration-base ease-brand";

  return (
    <span className="discovery-logo relative inline-block shrink-0 leading-none">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={ASSETS.logoColored}
        alt={isDark ? "" : "leadreacher"}
        aria-hidden={isDark}
        className={cn(className, transitionClass, isDark ? "opacity-0" : "opacity-100")}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={ASSETS.logoWhite}
        alt={isDark ? "leadreacher" : ""}
        aria-hidden={!isDark}
        className={cn(
          className,
          "absolute top-0 left-0",
          transitionClass,
          isDark ? "opacity-100" : "opacity-0",
        )}
      />
    </span>
  );
}
