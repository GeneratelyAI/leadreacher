"use client";

import { useId, useLayoutEffect, type RefObject } from "react";
import styles from "./HowItWorks.module.css";

const EASE = "cubic-bezier(0.16, 1, 0.3, 1)";
const seen = new Set<string>();

/** Local vector groups let motion preserve the circles and stroke proportions. */
export function HowItWorksIllustration({ index }: { index: number }) {
  const gradient = useId();
  return <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <defs><linearGradient id={gradient} x1="14" y1="9" x2="49" y2="54" gradientUnits="userSpaceOnUse"><stop stopColor="#7750f7" /><stop offset="1" stopColor="#3d0abc" /></linearGradient></defs>
    {index === 0 ? <>
      <g data-story-part="person-back">
        <g className={styles.desktopArt}><circle cx="43" cy="23" r="9" fill="currentColor" fillOpacity=".08" /><path d="M37 37c9-4 18 2 20 10" /></g>
        <g className={styles.mobileArt} stroke="none" fill={`url(#${gradient})`}>
          <path d="M11 21a6 6 0 1 1 12 0v3a6 6 0 0 1-12 0Z" /><path d="M9 22v-1a8 8 0 0 1 16 0v4h-3v-6c-3 3-7 2-9 1v5H9Z" fill="#2b0e8b" /><path d="M6 42v-5c0-4 5-7 11-7s10 3 10 7v5Z" />
          <path d="M43 21a6 6 0 1 1 12 0v3a6 6 0 0 1-12 0Z" /><path d="M41 22v-1a8 8 0 0 1 16 0v4h-3v-6c-3 3-7 2-9 1v5h-4Z" fill="#2b0e8b" /><path d="M38 42v-5c0-4 5-7 11-7s10 3 10 7v5Z" />
        </g>
      </g>
      <g data-story-part="person-front">
        <g className={styles.desktopArt}><circle cx="24" cy="25" r="11" fill="currentColor" fillOpacity=".08" /><path d="M6 51c4-16 32-16 36 0" /></g>
        <g className={styles.mobileArt} stroke="none" fill={`url(#${gradient})`}>
          <path d="M22 18a10 10 0 0 1 20 0v5a10 10 0 0 1-20 0Z" fill="#d0baff" /><path d="M21 23v-6a11 11 0 0 1 22 0v7h-4v-9c-4 3-8 2-12 0v9Z" fill="#28107f" /><path d="M16 53v-7c0-7 7-12 16-12s16 5 16 12v7Z" stroke="#eee8ff" strokeWidth="1.5" />
        </g>
      </g>
    </> : index === 1 ? <>
      <g data-story-part="frame">
        <path className={styles.desktopArt} pathLength="1" d="M9 15H40V49H9Z" fill="currentColor" fillOpacity=".08" />
        <g className={styles.mobileArt} stroke="#4420ba" strokeWidth="3.5" fillOpacity="1"><path pathLength="1" d="M7 12H57V51H7Z" fill="#f5f0ff" /><path d="M12 17h5M47 17h5M12 46h5M47 46h5M13 17v29M51 17v29" strokeWidth="2" /></g>
      </g>
      <g data-story-part="lens">
        <path className={styles.desktopArt} d="M40 25 56 17V47L40 39Z" fill="currentColor" fillOpacity=".08" />
        <path className={styles.mobileArt} d="M27 23 40 31.5 27 40Z" fill={`url(#${gradient})`} stroke="none" />
      </g>
    </> : index === 2 ? <g data-story-part="plane">
      <g className={styles.desktopArt}><path d="M7 26 56 8 39 57 29 35Z" fill="currentColor" fillOpacity=".08" /><path d="m29 35 14-14" /></g>
      <g className={styles.mobileArt} stroke="none"><path d="m7 26 48-17c2-1 4 1 3 3L43 55c-1 2-3 2-4 1l-11-13-7 9-3-17-12-5c-2-1-2-3 1-4Z" fill={`url(#${gradient})`} /><path d="m18 35 34-22-27 29-4 10Z" fill="#b39aff" /><path d="m25 42 27-29-14 35Z" fill="#eee8ff" /><path d="m25 42-4 10 7-9Z" fill="#6844d9" /></g>
    </g> : <>
      <g data-story-part="reply">
        <path className={styles.desktopArt} d="M42 25c15 0 20 17 9 26l2 8-9-4c-7 1-13-2-16-7" fill="currentColor" fillOpacity=".08" />
        <path className={styles.mobileArt} d="M37 29h13a7 7 0 0 1 7 7v13a7 7 0 0 1-7 7h-4l-8 7v-7H27a7 7 0 0 1-7-7v-8Z" fill="#a385eb" stroke="none" />
      </g>
      <g data-story-part="speech">
        <path className={styles.desktopArt} d="M35 39c-4 5-12 7-18 4l-9 5 3-11C-1 20 17 7 30 13c12 5 14 18 5 26Z" fill="currentColor" fillOpacity=".08" />
        <g className={styles.mobileArt} stroke="none"><path d="M12 13h32a7 7 0 0 1 7 7v21a7 7 0 0 1-7 7H25l-11 9v-9h-2a7 7 0 0 1-7-7V20a7 7 0 0 1 7-7Z" fill={`url(#${gradient})`} stroke="#eee8ff" strokeWidth="1.5" /><circle cx="18" cy="30" r="2" fill="#fff" /><circle cx="28" cy="30" r="2" fill="#fff" /><circle cx="38" cy="30" r="2" fill="#fff" /></g>
      </g>
    </>}
  </svg>;
}

export function useHowItWorksStory(ref: RefObject<HTMLOListElement | null>, campaignKey: string | null) {
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root || !campaignKey) return;
    const key = `lr-how-story:${campaignKey}`;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    // Replay on each document reload, but not on Back within the same visit.
    if (seen.has(key) || media.matches) return;
    const animations: Animation[] = [];
    let started = false;
    const remember = () => {
      seen.add(key);
    };
    const animate = (selector: string, frames: Keyframe[], delay: number, duration: number) => {
      const target = root.querySelector(selector);
      if (!target) return;
      const animation = target.animate(frames, { delay, duration, easing: EASE, fill: "backwards" });
      animations.push(animation);
    };
    const arrive = (part: string, delay: number, x = 0, y = 3) => animate(`[data-story-part='${part}']`, [{ opacity: 0, transform: `translate(${x}px, ${y}px)` }, { opacity: 1, transform: "translate(0, 0)" }], delay, 430);
    const start = () => {
      if (started || media.matches) return;
      started = true;
      remember();
      arrive("person-back", 0);
      arrive("person-front", 130);
      animate("[data-story-part='frame']", [{ strokeDasharray: "1", strokeDashoffset: "1", fillOpacity: 0 }, { strokeDasharray: "1", strokeDashoffset: "0", fillOpacity: .08 }], 760, 440);
      arrive("lens", 1030, 4, 0);
      animate("[data-story-part='plane']", [{ transform: "translate(0, 0)", offset: 0 }, { transform: "translate(3px, -2px)", offset: .55 }, { transform: "translate(0, 0)", offset: 1 }], 1540, 610);
      arrive("speech", 2290);
      arrive("reply", 2670, 2, 0);
      [520, 1330, 2150].forEach((delay, index) => animate(`[data-explanation-step]:nth-child(${index + 1}) .how-it-works-connector`, [{ opacity: .45, color: "#aaa2c4" }, { opacity: 1, color: "#7957cf", offset: .65 }, { opacity: 1, color: "#aaa2c4" }], delay, 330));
    };
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= .5)) { start(); observer.disconnect(); }
    }, { threshold: .5 });
    observer.observe(root);
    // Capture before the route controller clones these SVGs. Inline the current
    // group state so an interrupted story transfers without resetting its art.
    const handoff = () => {
      observer.disconnect();
      animations.forEach((animation) => {
        if (animation.playState === "finished") return;
        const effect = animation.effect as KeyframeEffect | null;
        const target = effect?.target;
        if (target instanceof SVGElement || target instanceof HTMLElement) {
          const computed = getComputedStyle(target);
          const frames = effect?.getKeyframes() ?? [];
          // commitStyles is not consistently supported for SVG groups. Copy
          // only properties owned by this timeline before cancelling them.
          for (const [property, cssName] of Object.entries({ opacity: "opacity", transform: "transform", strokeDasharray: "stroke-dasharray", strokeDashoffset: "stroke-dashoffset", fillOpacity: "fill-opacity", color: "color" })) {
            if (frames.some((frame) => property in frame)) target.style.setProperty(cssName, computed.getPropertyValue(cssName));
          }
        }
        animation.cancel();
      });
    };
    const reduce = () => {
      if (!media.matches) return;
      observer.disconnect();
      animations.forEach((animation) => animation.cancel());
      remember();
    };
    window.addEventListener("leadreacher:onboarding-story-handoff", handoff);
    media.addEventListener("change", reduce);
    return () => {
      observer.disconnect();
      animations.forEach((animation) => animation.cancel());
      window.removeEventListener("leadreacher:onboarding-story-handoff", handoff);
      media.removeEventListener("change", reduce);
    };
  }, [ref, campaignKey]);
}
