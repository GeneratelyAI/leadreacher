"use client";

import { useThemeMode } from "@/hooks/useThemeMode";
import { ASSETS } from "@/lib/constants/brand";
import { cn } from "@/lib/utils";

export function OnboardingLogo({
  className = "h-20 w-auto",
  markOnly = false,
}: {
  className?: string;
  markOnly?: boolean;
}) {
  const { isDark } = useThemeMode();
  const transitionClass = "transition-opacity duration-base ease-brand";

  const imageClassName = markOnly
    ? cn("h-full w-auto max-w-none", transitionClass)
    : cn(className, transitionClass);
  const lightSource = markOnly ? ASSETS.planeIcon : ASSETS.logoColored;
  const darkSource = markOnly ? ASSETS.planeIconWhite : ASSETS.logoWhite;

  return (
    <span
      className={cn(
        "discovery-logo relative inline-block leading-none",
        markOnly
          ? "h-9 w-13 shrink-0 overflow-hidden translate-x-2"
          : "max-w-full",
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={lightSource}
        alt={isDark ? "" : "leadreacher"}
        aria-hidden={isDark}
        className={cn(imageClassName, "max-w-full", isDark ? "opacity-0" : "opacity-100")}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={darkSource}
        alt={isDark ? "leadreacher" : ""}
        aria-hidden={!isDark}
        className={cn(
          imageClassName,
          "absolute top-0 left-0 max-w-full",
          transitionClass,
          isDark ? "opacity-100" : "opacity-0",
        )}
      />
    </span>
  );
}
