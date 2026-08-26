export type LandingGsap = typeof import("gsap").gsap;
export type LandingScrollTrigger = typeof import("gsap/ScrollTrigger").ScrollTrigger;
export type LandingFlip = typeof import("gsap/Flip").Flip;
export type LandingMotionPathPlugin = typeof import("gsap/MotionPathPlugin").MotionPathPlugin;
export type LandingFlipState = ReturnType<LandingFlip["getState"]>;

export type LandingGsapRuntime = {
  gsap: LandingGsap;
  ScrollTrigger: LandingScrollTrigger;
  Flip: LandingFlip;
  MotionPathPlugin: LandingMotionPathPlugin;
};

let runtimePromise: Promise<LandingGsapRuntime> | null = null;

/** Load GSAP only when a below-the-fold landing interaction needs it. */
export function loadLandingGsap(): Promise<LandingGsapRuntime> {
  runtimePromise ??= Promise.all([
    import("gsap"),
    import("gsap/ScrollTrigger"),
    import("gsap/Flip"),
    import("gsap/MotionPathPlugin"),
  ]).then(([gsapModule, scrollTriggerModule, flipModule, motionPathModule]) => {
    const gsap = gsapModule.gsap;
    const ScrollTrigger = scrollTriggerModule.ScrollTrigger;
    const Flip = flipModule.Flip;
    const MotionPathPlugin = motionPathModule.MotionPathPlugin;
    gsap.registerPlugin(ScrollTrigger, Flip, MotionPathPlugin);
    return { gsap, ScrollTrigger, Flip, MotionPathPlugin };
  });

  return runtimePromise;
}

type PlayableAnimation = {
  play: () => unknown;
  pause: () => unknown;
  progress: (value?: number) => unknown;
};

/**
 * Keep continuous landing animation work scoped to visible, foreground content.
 * The returned cleanup intentionally does not kill the animation; its GSAP
 * context owns that lifecycle.
 */
export function gateLandingAnimation({
  animation,
  target,
  reducedMotion,
  rootMargin = "180px 0px",
}: {
  animation: PlayableAnimation;
  target: Element;
  reducedMotion: boolean;
  rootMargin?: string;
}) {
  if (reducedMotion) {
    animation.progress(1);
    animation.pause();
    return () => undefined;
  }

  let isVisible = false;
  const updatePlayback = () => {
    if (isVisible && document.visibilityState === "visible") animation.play();
    else animation.pause();
  };
  const observer = new IntersectionObserver(([entry]) => {
    isVisible = Boolean(entry?.isIntersecting);
    updatePlayback();
  }, { rootMargin });
  const handleVisibility = () => updatePlayback();

  observer.observe(target);
  document.addEventListener("visibilitychange", handleVisibility);
  updatePlayback();

  return () => {
    observer.disconnect();
    document.removeEventListener("visibilitychange", handleVisibility);
  };
}
