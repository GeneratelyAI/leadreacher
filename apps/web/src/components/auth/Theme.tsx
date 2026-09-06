"use client";

import { Moon, Sun } from "@/components/ui/icons";
import { useThemeMode } from "@/hooks/useThemeMode";

export default function Theme() {
  const { isDark, toggle } = useThemeMode();

  return (
    <button
      type="button"
      onClick={(event) => toggle(event)}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="auth-theme-toggle tap-target relative inline-flex size-9 items-center justify-center text-neutral-600 transition-colors duration-fast ease-brand hover:text-onboarding-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple/30 dark:text-onboarding-neutral-300 dark:hover:text-onboarding-neutral-0"
    >
      {isDark ? (
        <Sun className="size-6" aria-hidden />
      ) : (
        <Moon className="size-6" aria-hidden />
      )}
    </button>
  );
}
