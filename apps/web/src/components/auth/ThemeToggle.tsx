"use client";

import { Moon, Sun } from "@/components/ui/icons";
import { useThemeMode } from "@/hooks/useThemeMode";

export default function ThemeToggle() {
  const { isDark, toggle } = useThemeMode();

  return (
    <button
      type="button"
      onClick={(event) => toggle(event)}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="auth-theme-toggle tap-target relative inline-flex size-9 items-center justify-center rounded-full border border-neutral-200/80 bg-white/85 text-neutral-600 shadow-sm backdrop-blur-md transition-colors duration-fast ease-brand hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple/30"
    >
      {isDark ? (
        <Sun className="size-4" aria-hidden />
      ) : (
        <Moon className="size-4" aria-hidden />
      )}
    </button>
  );
}
