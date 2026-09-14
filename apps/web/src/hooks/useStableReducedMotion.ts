"use client";

import { useEffect, useState } from "react";

const query = "(prefers-reduced-motion: reduce)";

/** Render a settled, identical server and hydration frame before enabling motion. */
export function useStableReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(true);

  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return reducedMotion;
}
