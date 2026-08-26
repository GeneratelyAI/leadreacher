"use client";

import { useEffect, type DependencyList, type RefObject } from "react";
import {
  loadLandingGsap,
  type LandingGsapRuntime,
} from "@/lib/landing-gsap";

export type LandingGsapMedia = {
  desktop: boolean;
  mobile: boolean;
  shortViewport: boolean;
  reducedMotion: boolean;
};

export type LandingGsapSetupContext = LandingGsapRuntime & {
  scope: HTMLElement;
  media: LandingGsapMedia;
};

type LandingGsapSetup = (
  runtime: LandingGsapSetupContext,
) => void | (() => void);

/** Dynamically load and scope GSAP work to one landing component. */
export function useLandingGsap(
  scopeRef: RefObject<HTMLElement | null>,
  setup: LandingGsapSetup,
  dependencies: DependencyList,
) {
  useEffect(() => {
    let disposed = false;
    let revertContext: (() => void) | undefined;
    let revertMedia: (() => void) | undefined;

    void loadLandingGsap().then(({ gsap, ScrollTrigger, Flip, MotionPathPlugin }) => {
      const scope = scopeRef.current;
      if (disposed || !scope) return;

      const media = gsap.matchMedia();
      const context = gsap.context(() => {
        media.add({
          desktop: "(min-width: 1024px)",
          mobile: "(max-width: 767px)",
          shortViewport: "(max-height: 700px)",
          reducedMotion: "(prefers-reduced-motion: reduce)",
        }, (mediaContext) => setup({
          gsap,
          ScrollTrigger,
          Flip,
          MotionPathPlugin,
          scope,
          media: mediaContext.conditions as LandingGsapMedia,
        }));
      }, scope);
      revertContext = () => context.revert();
      revertMedia = () => media.revert();
    });

    return () => {
      disposed = true;
      revertMedia?.();
      revertContext?.();
    };
    // Callers provide the complete dependency list just like a native effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);
}
