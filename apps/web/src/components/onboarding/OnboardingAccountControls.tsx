"use client";

import { Moon, Sun } from "lucide-react";
import { useThemeMode } from "@/hooks/useThemeMode";

export function ThemeToggleButton() {
  const { isDark, toggle } = useThemeMode();

  return (
    <button
      type="button"
      onClick={(event) => toggle(event.currentTarget)}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="inline-flex size-9 shrink-0 items-center justify-center text-neutral-600 transition-colors duration-fast ease-brand hover:text-onboarding-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-onboarding-purple-300 dark:text-onboarding-neutral-300 dark:hover:text-onboarding-neutral-0"
    >
      {isDark ? (
        <Sun className="size-5" aria-hidden />
      ) : (
        <Moon className="size-5" aria-hidden />
      )}
    </button>
  );
}
