"use client";

import { useSyncExternalStore } from "react";

const query = "(max-width: 63rem)";
function subscribe(update: () => void) {
  const media = window.matchMedia(query);
  media.addEventListener("change", update);
  return () => media.removeEventListener("change", update);
}

/** CSS reserves phone geometry before this behavior-only media preference resolves. */
export function useMobileCampaign() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}
