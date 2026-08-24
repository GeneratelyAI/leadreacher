"use client";

import { gsap } from "gsap";
import { type HTMLAttributes, useLayoutEffect, useRef } from "react";
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

  useLayoutEffect(() => {
    const loading = loadingRef.current;
    if (!loading) return;

    const loadingStyles = getComputedStyle(loading);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timeline = gsap.timeline({ repeat: reducedMotion ? 0 : -1, repeatDelay: 0.28 })
      .set(loading, {
        "--rotate": 0,
        "--plane-x": 0,
        "--plane-y": 0,
        "--plane-opacity": 0,
        "--border-radius": 7,
        "--trails-stroke": 57,
        "--left-wing-background": loadingStyles.getPropertyValue("--primary"),
        "--right-wing-background": loadingStyles.getPropertyValue("--primary"),
        "--left-body-background": loadingStyles.getPropertyValue("--primary-dark"),
        "--right-body-background": loadingStyles.getPropertyValue("--primary-darkest"),
        "--left-wing-first-x": 0,
        "--left-wing-first-y": 0,
        "--left-wing-second-x": 50,
        "--left-wing-second-y": 0,
        "--left-wing-third-x": 0,
        "--left-wing-third-y": 100,
        "--left-body-third-x": 0,
        "--left-body-third-y": 100,
        "--right-wing-first-x": 49,
        "--right-wing-first-y": 0,
        "--right-wing-second-x": 100,
        "--right-wing-second-y": 0,
        "--right-wing-third-x": 100,
        "--right-wing-third-y": 100,
        "--right-body-third-x": 100,
        "--right-body-third-y": 100,
      })
      .to(loading, { "--plane-y": -1, duration: 0.14, ease: "sine.inOut" })
      .to(loading, {
        "--left-wing-first-x": 50,
        "--left-wing-first-y": 100,
        "--right-wing-second-x": 50,
        "--right-wing-second-y": 100,
        "--border-radius": 0,
        duration: 0.32,
        ease: "power2.inOut",
      })
      // Reset invisibly, then restore the folded paper at full opacity so its
      // original shadow remains crisp instead of fading in with the geometry.
      .set(loading, { "--plane-opacity": 1 })
      .set(loading, {
        "--left-wing-first-y": 0,
        "--left-wing-second-x": 40,
        "--left-wing-second-y": 100,
        "--left-wing-third-x": 0,
        "--left-wing-third-y": 100,
        "--left-body-third-x": 40,
        "--right-wing-first-x": 50,
        "--right-wing-first-y": 0,
        "--right-wing-second-x": 60,
        "--right-wing-second-y": 100,
        "--right-wing-third-x": 100,
        "--right-wing-third-y": 100,
        "--right-body-third-x": 60,
      })
      .to(loading, {
        "--left-wing-third-x": 20,
        "--left-wing-third-y": 90,
        "--left-wing-second-y": 90,
        "--left-body-third-y": 90,
        "--right-wing-third-x": 80,
        "--right-wing-third-y": 90,
        "--right-body-third-y": 90,
        "--right-wing-second-y": 90,
        duration: 0.28,
        ease: "power2.inOut",
      })
      .to(loading, {
        "--rotate": 50,
        "--left-wing-third-y": 95,
        "--left-wing-third-x": 27,
        "--right-body-third-x": 45,
        "--right-wing-second-x": 45,
        "--right-wing-third-x": 60,
        "--right-wing-third-y": 83,
        duration: 0.3,
        ease: "power2.inOut",
      })
      .to(loading, {
        "--rotate": 60,
        "--plane-x": -8,
        "--plane-y": 40,
        "--trails-stroke": 171,
        duration: 0.2,
      })
      .to(loading, {
        "--rotate": 40,
        "--plane-x": 45,
        "--plane-y": -300,
        "--plane-opacity": 0,
        duration: 0.375,
      })
      .timeScale(0.68);

    if (reducedMotion) timeline.progress(0.72).pause();

    return () => {
      timeline.kill();
      gsap.killTweensOf(loading);
    };
  }, [tone]);

  return (
    <div
      {...props}
      ref={loadingRef}
      role="status"
      aria-busy="true"
      aria-label={props["aria-label"] ?? label}
      className={cn(styles.loading, tone === "brand" && styles.brand, className)}
    >
      <svg className={styles.trails} viewBox="0 0 33 64" aria-hidden>
        <path d="M26 4c2 9.333 3 18.667 3 28 0 9.333-1 18.667-3 28" />
        <path d="M6 4c2 9.333 3 18.667 3 28 0 9.333-1 18.667-3 28" />
      </svg>
      <span className={styles.plane} aria-hidden>
        <span className={styles.left} />
        <span className={styles.right} />
      </span>
    </div>
  );
}
