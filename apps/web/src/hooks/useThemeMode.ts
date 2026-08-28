"use client";

import { useCallback, useLayoutEffect, useSyncExternalStore } from "react";
import { flushSync } from "react-dom";
import {
  THEME_COLOR_DARK,
  THEME_COLOR_LIGHT,
  THEME_STORAGE_KEY,
} from "@/lib/theme-init-script";

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

  // No explicit choice yet: follow the system's own appearance instead of
  // defaulting to light. This keeps Safari's resting toolbar chrome (which
  // tracks system Light/Dark, not our theme-color meta) in sync with the
  // page for anyone who hasn't manually overridden it.
  const isDark =
    stored === "dark" || stored === "light"
      ? stored === "dark"
      : window.matchMedia("(prefers-color-scheme: dark)").matches;

  applyTheme(isDark);
}

function applyTheme(isDark: boolean) {
  document.documentElement.classList.toggle("dark", isDark);
  const metas = document.querySelectorAll('meta[name="theme-color"]');
  metas.forEach((meta) => meta.remove());

  const meta = document.createElement("meta");
  meta.name = "theme-color";
  meta.content = isDark ? THEME_COLOR_DARK : THEME_COLOR_LIGHT;
  document.head.appendChild(meta);
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

type ThemeToggleOrigin = HTMLElement | Pick<MouseEvent, "clientX" | "clientY" | "currentTarget">;

function resolveOriginPoint(origin: ThemeToggleOrigin): { xPercent: number; yPercent: number } {
  const viewportWidth = Math.max(window.innerWidth, 1);
  const viewportHeight = Math.max(window.innerHeight, 1);

  if (origin instanceof HTMLElement) {
    const rect = origin.getBoundingClientRect();
    return {
      xPercent: ((rect.left + rect.width / 2) / viewportWidth) * 100,
      yPercent: ((rect.top + rect.height / 2) / viewportHeight) * 100,
    };
  }

  return {
    xPercent: (origin.clientX / viewportWidth) * 100,
    yPercent: (origin.clientY / viewportHeight) * 100,
  };
}

async function animateThemeToggle(nextIsDark: boolean, origin: ThemeToggleOrigin) {
  if (
    !supportsViewTransitions() ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    setThemeState(nextIsDark);
    return;
  }

  // Capture origin in viewport % before the transition. Pixel coords on
  // ::view-transition-* are relative to the snapshot containing block, which
  // can diverge from the layout viewport on smaller screens - percentages map
  // to the transition layer itself and stay anchored to the toggle.
  const { xPercent, yPercent } = resolveOriginPoint(origin);
  const root = document.documentElement;
  root.style.setProperty("--theme-toggle-x", `${xPercent}%`);
  root.style.setProperty("--theme-toggle-y", `${yPercent}%`);
  root.classList.add("theme-transitioning");
  window.dispatchEvent(new Event("leadreacher:theme-transition-start"));

  try {
    // Give the carousel time to settle and softly clear its inactive cards
    // before the browser captures the old and new theme snapshots. Keeping
    // the centered card visible provides a stable visual anchor throughout.
    const hasAcquisitionCarousel = Boolean(
      document.querySelector(".acquisition-workflow-theme-layer"),
    );
    await new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => {
        window.setTimeout(resolve, hasAcquisitionCarousel ? 100 : 0);
      });
    });

    const transition = document.startViewTransition(() => {
      flushSync(() => {
        setThemeState(nextIsDark);
      });
    });

    await transition.ready;

    root.animate(
      {
        clipPath: [
          `circle(0% at ${xPercent}% ${yPercent}%)`,
          `circle(150% at ${xPercent}% ${yPercent}%)`,
        ],
      },
      {
        duration: 450,
        easing: "ease-in-out",
        pseudoElement: "::view-transition-new(root)",
      },
    );

    await Promise.race([
      transition.finished.catch(() => undefined),
      new Promise<void>((resolve) => window.setTimeout(resolve, 650)),
    ]);
  } finally {
    root.classList.add("theme-transition-recovering");
    root.classList.remove("theme-transitioning");
    root.style.removeProperty("--theme-toggle-x");
    root.style.removeProperty("--theme-toggle-y");
    window.dispatchEvent(new Event("leadreacher:theme-transition-end"));
    window.setTimeout(() => {
      root.classList.remove("theme-transition-recovering");
    }, 220);
  }
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

  const toggle = useCallback((origin?: ThemeToggleOrigin | null) => {
    const nextIsDark = !readIsDarkFromDocument();

    if (origin) {
      void animateThemeToggle(nextIsDark, origin);
      return;
    }

    setThemeState(nextIsDark);
  }, []);

  return { isDark, toggle };
}
