"use client";

import { useCallback, type RefObject } from "react";
import { useLandingGsap, type LandingGsapSetupContext } from "@/hooks/useLandingGsap";

type HeadingVariant = "deal" | "focus" | "measure" | "converge" | "lock" | "stack" | "launch";

/** Distinct, one-shot motion identities for major landing-page headings. */
export function useCreativeHeadingMotion(scopeRef: RefObject<HTMLElement | null>) {
  const setup = useCallback(({ gsap, scope, media }: LandingGsapSetupContext) => {
    const headings = gsap.utils.toArray<HTMLElement>("[data-gsap-heading]", scope);

    headings.forEach((heading) => {
      const parts = gsap.utils.toArray<HTMLElement>("[data-heading-part]", heading);
      const kicker = heading.querySelector<HTMLElement>("[data-heading-kicker]");
      const support = heading.querySelector<HTMLElement>("[data-heading-support]");
      const accent = heading.querySelector<HTMLElement>("[data-heading-accent]");
      const targets = [kicker, ...parts, accent, support].filter((target): target is HTMLElement => Boolean(target));

      if (media.reducedMotion) {
        gsap.set(targets, { clearProps: "all" });
        return;
      }

      const variant = (heading.dataset.gsapHeading ?? "focus") as HeadingVariant;
      const timeline = gsap.timeline({
        defaults: { overwrite: "auto" },
        scrollTrigger: { trigger: heading, start: "top 84%", once: true },
      });

      if (kicker) timeline.fromTo(kicker, { autoAlpha: 0, y: -8 }, { autoAlpha: 1, y: 0, duration: 0.22, ease: "power2.out" }, 0);

      switch (variant) {
        case "deal":
          timeline.fromTo(parts, { autoAlpha: 0, yPercent: 105, rotateX: -16, transformPerspective: 700 }, { autoAlpha: 1, yPercent: 0, rotateX: 0, duration: 0.42, stagger: 0.055, ease: "power4.out" }, 0.03);
          break;
        case "measure":
          parts.forEach((part, index) => timeline.fromTo(part, { autoAlpha: 0, x: index % 2 === 0 ? -34 : 34, scaleX: 0.96 }, { autoAlpha: 1, x: 0, scaleX: 1, duration: 0.34, ease: "power3.out" }, 0.035 + index * 0.055));
          break;
        case "converge":
          parts.forEach((part, index) => timeline.fromTo(part, { autoAlpha: 0, x: index % 2 === 0 ? -52 : 52, rotateZ: index % 2 === 0 ? -1.4 : 1.4 }, { autoAlpha: 1, x: 0, rotateZ: 0, duration: 0.44, ease: "expo.out" }, 0.03 + index * 0.045));
          break;
        case "lock":
          parts.forEach((part, index) => timeline.fromTo(part, { autoAlpha: 0, x: index % 2 === 0 ? -28 : 28, scale: 0.97 }, { autoAlpha: 1, x: 0, scale: 1, duration: 0.36, ease: "power3.out" }, 0.04 + index * 0.04));
          break;
        case "stack":
          timeline.fromTo(parts, { autoAlpha: 0, y: 22, scale: 0.94 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.4, stagger: 0.065, ease: "back.out(1.35)" }, 0.03);
          break;
        case "launch":
          timeline.fromTo(parts, { autoAlpha: 0, y: 28, scale: 0.9 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.46, stagger: 0.045, ease: "back.out(1.5)" }, 0.02);
          break;
        case "focus":
        default:
          timeline.fromTo(parts, { autoAlpha: 0, y: 14, scale: 0.9 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.42, stagger: 0.045, ease: "power4.out" }, 0.03);
          break;
      }

      if (accent) timeline.fromTo(accent, { scaleX: 0, transformOrigin: "left center" }, { scaleX: 1, duration: 0.3, ease: "power3.out" }, 0.14);
      if (support) timeline.fromTo(support, { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.28, ease: "power2.out" }, 0.18);
    });
  }, []);

  useLandingGsap(scopeRef, setup, [setup]);
}
