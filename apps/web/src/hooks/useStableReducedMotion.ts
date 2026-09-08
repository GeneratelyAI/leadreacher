"use client";

import { useSyncExternalStore } from "react";

const query = "(prefers-reduced-motion: reduce)";
function subscribe(update: () => void) {
  const media = window.matchMedia(query);
  media.addEventListener("change", update);
  return () => media.removeEventListener("change", update);
}

/** Render a settled, identical server and hydration frame before enabling motion. */
export function useStableReducedMotion() {
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => true);
}
