"use client";

import { gsap } from "gsap";
import { type HTMLAttributes, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import styles from "./Loading.module.css";

type LoadingProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  /** Use reference on the purple brand surface and brand on light surfaces. */
  tone?: "reference" | "brand";
  label?: string;
};

/** LeadReacher's shared page-level loading indicator. */
export function Loading({ className, tone = "reference", label = "Loading", ...props }: LoadingProps) {
  const loadingRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loading = loadingRef.current;
    if (!loading || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const context = gsap.context(() => {
      const plane = loading.querySelector<HTMLElement>(`.${styles.plane}`);
      const trails = loading.querySelector<SVGElement>(`.${styles.trails}`);
      const glow = loading.querySelector<HTMLElement>(`.${styles.glow}`);
      if (!plane || !trails || !glow) return;

      const timeline = gsap.timeline({ repeat: -1, repeatDelay: .14 });
      timeline.set(plane, { autoAlpha: 1, x: 0, y: 0, rotate: 0, scale: 1 });
      timeline.set(glow, { autoAlpha: .7, scale: 1 });
      timeline.set(trails, { autoAlpha: 0, strokeDashoffset: 62 });
      timeline.to(plane, { y: -2.5, rotate: 1, duration: .32, ease: "sine.inOut" });
      timeline.to(plane, { y: 0, rotate: 0, duration: .22, ease: "sine.inOut" });
      timeline.to(plane, { x: -7, y: 6, rotate: -5, scale: .96, duration: .18, ease: "power2.inOut" }, "+=.08");
      timeline.to(glow, { autoAlpha: .3, scale: .86, duration: .18, ease: "power2.inOut" }, "<");
      timeline.fromTo(
        trails,
        { autoAlpha: 0, strokeDashoffset: 62 },
        { autoAlpha: 1, strokeDashoffset: -48, duration: .5, ease: "power2.in" },
      );
      timeline.to(plane, {
        keyframes: [{ x: 8, y: -8, rotate: 2, scale: 1, duration: .12, ease: "power1.in" },
          { autoAlpha: 0, x: 72, y: -70, rotate: 10, scale: 1.06, duration: .38, ease: "power3.in" }],
      }, "<");
      timeline.to(glow, { autoAlpha: 0, scale: 1.3, duration: .32, ease: "power2.out" }, "<.1");
      timeline.to(trails, { autoAlpha: 0, duration: .14 }, "-=.08");
      timeline.set(plane, { autoAlpha: 0, x: -34, y: 26, rotate: -10, scale: .84 });
      timeline.set(trails, { autoAlpha: 0, strokeDashoffset: 62 });
      timeline.fromTo(
        plane,
        { autoAlpha: 0, x: -34, y: 26, rotate: -10, scale: .84 },
        { autoAlpha: 1, x: 0, y: 0, rotate: 0, scale: 1, duration: .62, ease: "power3.out" },
        "+=.24",
      );
      timeline.fromTo(glow, { autoAlpha: 0, scale: .65 }, { autoAlpha: .7, scale: 1, duration: .48, ease: "power2.out" }, "<.1");
    }, loading);

    return () => context.revert();
  }, []);

  return (
    <div
      {...props}
      ref={loadingRef}
      role="status"
      aria-busy="true"
      aria-label={props["aria-label"] ?? label}
      className={cn(styles.loading, tone === "brand" && styles.brand, className)}
    >
      <span className={styles.glow} aria-hidden />
      <svg className={styles.trails} viewBox="0 0 33 64" aria-hidden>
        <path d="M26,4 C28,13.3333333 29,22.6666667 29,32 C29,41.3333333 28,50.6666667 26,60" />
        <path d="M6,4 C8,13.3333333 9,22.6666667 9,32 C9,41.3333333 8,50.6666667 6,60" />
      </svg>
      <span className={styles.plane} aria-hidden />
    </div>
  );
}
