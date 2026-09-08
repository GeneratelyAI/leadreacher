"use client";

import { useLayoutEffect, type RefObject } from "react";

const EASE = "cubic-bezier(0.16, 1, 0.3, 1)";
const seen = new Set<string>();

/** Local vector groups let motion preserve the circles and stroke proportions. */
export function HowItWorksIllustration({ index }: { index: number }) {
  return <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {index === 0 ? <>
      <g data-story-part="person-back"><circle cx="43" cy="23" r="9" fill="currentColor" fillOpacity=".08" /><path d="M37 37c9-4 18 2 20 10" /></g>
      <g data-story-part="person-front"><circle cx="24" cy="25" r="11" fill="currentColor" fillOpacity=".08" /><path d="M6 51c4-16 32-16 36 0" /></g>
    </> : index === 1 ? <>
      <path data-story-part="frame" pathLength="1" d="M9 15H40V49H9Z" fill="currentColor" fillOpacity=".08" />
      <path data-story-part="lens" d="M40 25 56 17V47L40 39Z" fill="currentColor" fillOpacity=".08" />
    </> : index === 2 ? <g data-story-part="plane"><path d="M7 26 56 8 39 57 29 35Z" fill="currentColor" fillOpacity=".08" /><path d="m29 35 14-14" /></g> : <>
      <g data-story-part="speech"><path d="M35 39c-4 5-12 7-18 4l-9 5 3-11C-1 20 17 7 30 13c12 5 14 18 5 26Z" fill="currentColor" fillOpacity=".08" /></g>
      <g data-story-part="reply"><path d="M42 25c15 0 20 17 9 26l2 8-9-4c-7 1-13-2-16-7" fill="currentColor" fillOpacity=".08" /></g>
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
