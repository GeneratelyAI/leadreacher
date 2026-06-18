"use client";

import { Moon, Sun } from "lucide-react";
import { useThemeMode } from "@/hooks/useThemeMode";

export default function AuthThemeToggle() {
  const { isDark, toggle } = useThemeMode();

  return (
    <button
      type="button"
      onClick={(event) => toggle(event.currentTarget)}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="auth-theme-toggle inline-flex size-9 items-center justify-center rounded-full border border-neutral-200/80 bg-white/85 text-neutral-600 shadow-sm backdrop-blur-md transition-colors hover:bg-white"
    >
      {isDark ? (
        <Sun className="size-4" aria-hidden />
      ) : (
        <Moon className="size-4" aria-hidden />
      )}
    </button>
  );
}
