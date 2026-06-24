"use client";

import { useCallback, useLayoutEffect, useSyncExternalStore } from "react";
import { flushSync } from "react-dom";
import { THEME_STORAGE_KEY } from "@/lib/theme-init-script";

const LEGACY_THEME_STORAGE_KEY = "lr-theme";

const listeners = new Set<() => void>();

export { THEME_STORAGE_KEY };

export function applyStoredTheme(): void {
  if (typeof window === "undefined") {
    return;
  }

  let stored = window.localStorage.getItem(THEME_STORAGE_KEY);

  if (stored === null) {
    const legacy = window.localStorage.getItem(LEGACY_THEME_STORAGE_KEY);
    if (legacy === "dark" || legacy === "light") {
      stored = legacy;
      window.localStorage.setItem(THEME_STORAGE_KEY, legacy);
      window.localStorage.removeItem(LEGACY_THEME_STORAGE_KEY);
    }
  }

  applyTheme(stored === "dark");
}

function applyTheme(isDark: boolean) {
  document.documentElement.classList.toggle("dark", isDark);
}

function readIsDarkFromDocument(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return document.documentElement.classList.contains("dark");
}

function subscribe(callback: () => void) {
  listeners.add(callback);

  return () => {
    listeners.delete(callback);
  };
}

function notifyListeners() {
  for (const listener of listeners) {
    listener();
  }
}

function setThemeState(isDark: boolean) {
  applyTheme(isDark);
  window.localStorage.setItem(THEME_STORAGE_KEY, isDark ? "dark" : "light");
  window.localStorage.removeItem(LEGACY_THEME_STORAGE_KEY);
  notifyListeners();
}

function supportsViewTransitions(): boolean {
  return (
    typeof document !== "undefined" &&
    "startViewTransition" in document &&
    typeof CSS !== "undefined" &&
    CSS.supports("view-transition-name", "none")
  );
}

async function animateThemeToggle(nextIsDark: boolean, origin: HTMLElement) {
  if (
    !supportsViewTransitions() ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    setThemeState(nextIsDark);
    return;
  }

  const transition = document.startViewTransition(() => {
    flushSync(() => {
      setThemeState(nextIsDark);
    });
  });

  await transition.ready;

  const { top, left, width, height } = origin.getBoundingClientRect();
  const x = left + width / 2;
  const y = top + height / 2;
  const right = window.innerWidth - left;
  const bottom = window.innerHeight - top;
  const maxRadius = Math.hypot(
    Math.max(left, right),
    Math.max(top, bottom),
  );

  document.documentElement.animate(
    {
      clipPath: [
        `circle(0px at ${x}px ${y}px)`,
        `circle(${maxRadius}px at ${x}px ${y}px)`,
      ],
    },
    {
      duration: 400,
      easing: "ease-in-out",
      pseudoElement: "::view-transition-new(root)",
    },
  );
}

if (typeof window !== "undefined") {
  applyStoredTheme();
}

export function useThemeMode() {
  useLayoutEffect(() => {
    applyStoredTheme();
  }, []);

  const isDark = useSyncExternalStore(
    subscribe,
    readIsDarkFromDocument,
    () => false,
  );

  const toggle = useCallback((origin?: HTMLElement | null) => {
    const nextIsDark = !readIsDarkFromDocument();

    if (origin) {
      void animateThemeToggle(nextIsDark, origin);
      return;
    }

    setThemeState(nextIsDark);
  }, []);

  return { isDark, toggle };
}
