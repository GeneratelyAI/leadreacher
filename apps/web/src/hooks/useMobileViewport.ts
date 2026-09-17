"use client";

import { useSyncExternalStore } from "react";

const MOBILE_QUERY = "(max-width: 47.99rem)";

function subscribe(onStoreChange: () => void) {
  const mediaQuery = window.matchMedia(MOBILE_QUERY);
  mediaQuery.addEventListener("change", onStoreChange);
  return () => mediaQuery.removeEventListener("change", onStoreChange);
}

function getSnapshot() {
  return window.matchMedia(MOBILE_QUERY).matches;
}

/** Uses the same breakpoint as the landing page's mobile-only layouts. */
export function useMobileViewport() {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
