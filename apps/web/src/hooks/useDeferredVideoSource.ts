"use client";

import { useCallback, useEffect, useState, type RefObject } from "react";

type DeferredVideoSourceOptions = {
  defer?: boolean;
  rootMargin?: string;
};

/** Keeps video bytes off the network until the media is close enough to be useful. */
export function useDeferredVideoSource(
  videoRef: RefObject<HTMLVideoElement | null>,
  { defer = false, rootMargin = "480px 0px" }: DeferredVideoSourceOptions = {},
) {
  const [sourceEnabled, setSourceEnabled] = useState(!defer);
  const enableSource = useCallback(() => setSourceEnabled(true), []);

  useEffect(() => {
    if (!defer || sourceEnabled) return;

    const video = videoRef.current;
    if (!video) return;
    if (!("IntersectionObserver" in window)) {
      enableSource();
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        enableSource();
        observer.disconnect();
      },
      { rootMargin },
    );

    observer.observe(video);
    return () => observer.disconnect();
  }, [defer, enableSource, rootMargin, sourceEnabled, videoRef]);

  return { sourceEnabled, enableSource };
}
