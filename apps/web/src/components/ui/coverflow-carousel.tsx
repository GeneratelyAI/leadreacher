"use client";

import * as React from "react";
import { useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "@/components/ui/icons";
import { usePageVisibility } from "@/hooks/usePageVisibility";
import { cn } from "@/lib/utils";
import { loadLandingGsap } from "@/lib/landing-gsap";

const useIsoLayoutEffect = typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect;

export type CoverflowSlide = {
  src?: string;
  alt?: string;
  title?: string;
  subtitle?: string;
};

type CoverflowCarouselProps = {
  slides: readonly CoverflowSlide[];
  renderSlide?: (slide: CoverflowSlide, index: number, isSelected: boolean) => React.ReactNode;
  rotate?: number;
  depth?: number;
  perspective?: number;
  falloff?: number;
  fade?: number;
  cardWidth?: string;
  cardAspectRatio?: number;
  gap?: number;
  loop?: boolean;
  showPagination?: boolean;
  showNavigation?: boolean;
  autoPlay?: boolean;
  autoPlayInterval?: number;
  finalSlideHold?: number;
  label?: string;
  className?: string;
  cardClassName?: string;
};

export function CoverflowCarousel({
  slides,
  renderSlide,
  rotate = 38,
  depth = 0.42,
  perspective = 3,
  falloff = 0.56,
  fade = 0.14,
  cardWidth = "clamp(14.5rem, 25vw, 19rem)",
  cardAspectRatio = 1,
  gap = 0.04,
  loop = true,
  showPagination = true,
  showNavigation = false,
  autoPlay = false,
  autoPlayInterval = 4200,
  finalSlideHold = 0,
  label = "Customer acquisition workflow",
  className,
  cardClassName,
}: CoverflowCarouselProps) {
  const count = slides.length;
  const reducedMotion = Boolean(useReducedMotion());
  const frameRef = React.useRef<HTMLDivElement>(null);
  const cardRefs = React.useRef<(HTMLDivElement | null)[]>([]);
  const positionRef = React.useRef(0);
  const targetRef = React.useRef(0);
  const widthRef = React.useRef(0);
  const settleTweenRef = React.useRef<{ kill: () => void } | null>(null);
  const settleVersionRef = React.useRef(0);
  const dragRef = React.useRef<{ id: number; x: number; position: number; velocity: number; time: number } | null>(null);
  const didDragRef = React.useRef(false);
  const hoveredIndexRef = React.useRef<number | null>(null);
  const manualPauseTimerRef = React.useRef<number | null>(null);
  const [selected, setSelected] = React.useState(0);
  const [isHovering, setIsHovering] = React.useState(false);
  const [isManuallyPaused, setIsManuallyPaused] = React.useState(false);
  const [isNearViewport, setIsNearViewport] = React.useState(false);
  const isPageVisible = usePageVisibility();

  const pauseAfterManualInteraction = React.useCallback(() => {
    setIsManuallyPaused(true);
    if (manualPauseTimerRef.current !== null) window.clearTimeout(manualPauseTimerRef.current);
    manualPauseTimerRef.current = window.setTimeout(() => {
      manualPauseTimerRef.current = null;
      setIsManuallyPaused(false);
    }, 6_000);
  }, []);

  const indexAt = React.useCallback((position: number) => ((Math.round(position) % count) + count) % count, [count]);
  const clamp = React.useCallback((position: number) => (loop ? position : Math.max(0, Math.min(count - 1, position))), [count, loop]);

  const paint = React.useCallback(() => {
    const width = widthRef.current;
    if (!width) return;

    const pitch = width * (1 + gap);
    cardRefs.current.forEach((card, index) => {
      if (!card) return;
      let offset = index - positionRef.current;
      if (loop) {
        offset = ((offset % count) + count) % count;
        if (offset > count / 2) offset -= count;
      }

      const distance = Math.abs(offset);
      const ramp = Math.pow(distance, falloff);
      const tilt = Math.min(rotate * ramp, 82) * Math.sign(offset);
      const edge = loop ? Math.min(1, Math.max(0, count / 2 - distance)) : 1;

      const isHoveredInactive = hoveredIndexRef.current === index && distance > 0.15;
      const scale = Math.max(0.88, 1 - distance * 0.045) + (isHoveredInactive ? 0.035 : 0);
      const lift = isHoveredInactive ? -8 : 0;
      card.style.transform = `translateX(calc(-50% + ${offset * pitch}px)) translateY(${lift}px) translateZ(${-depth * width * ramp}px) rotateY(${-tilt}deg) scale(${scale})`;
      card.style.opacity = String(Math.max(0, 1 - fade * distance) * edge);
      card.style.zIndex = String(100 - Math.round(distance));
    });
  }, [count, depth, fade, falloff, gap, loop, rotate]);

  const settle = React.useCallback((target: number) => {
    settleTweenRef.current?.kill();
    settleTweenRef.current = null;
    const settleVersion = ++settleVersionRef.current;
    targetRef.current = target;
    setSelected(indexAt(target));

    if (reducedMotion) {
      positionRef.current = target;
      paint();
      return;
    }

    const proxy = { position: positionRef.current };
    void loadLandingGsap().then(({ gsap }) => {
      if (settleVersionRef.current !== settleVersion) return;
      settleTweenRef.current = gsap.to(proxy, {
        position: target,
        duration: 0.48,
        ease: "power3.out",
        overwrite: true,
        onUpdate: () => {
          positionRef.current = proxy.position;
          paint();
        },
        onComplete: () => {
          positionRef.current = target;
          paint();
          settleTweenRef.current = null;
        },
      });
    });
  }, [indexAt, paint, reducedMotion]);

  const nudge = React.useCallback((by: number) => settle(clamp(Math.round(targetRef.current) + by)), [clamp, settle]);
  const goTo = React.useCallback((index: number) => {
    if (!loop) {
      settle(index);
      return;
    }

    const closestCycle = Math.round((positionRef.current - index) / count);
    settle(index + closestCycle * count);
  }, [count, loop, settle]);

  React.useEffect(() => {
    if (!autoPlay || reducedMotion || count < 2 || isHovering || isManuallyPaused || !isNearViewport || !isPageVisible) return;
    const delay = autoPlayInterval + (selected === count - 1 ? finalSlideHold : 0);
    const timer = window.setTimeout(() => {
      if (dragRef.current === null) nudge(1);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [autoPlay, autoPlayInterval, count, finalSlideHold, isHovering, isManuallyPaused, isNearViewport, isPageVisible, nudge, reducedMotion, selected]);

  React.useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;

    const observer = new IntersectionObserver(
      ([entry]) => setIsNearViewport(Boolean(entry?.isIntersecting)),
      { rootMargin: "240px 0px" },
    );
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  React.useEffect(() => () => {
    settleVersionRef.current += 1;
    settleTweenRef.current?.kill();
    if (manualPauseTimerRef.current !== null) window.clearTimeout(manualPauseTimerRef.current);
  }, []);

  useIsoLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const measure = () => {
      const card = cardRefs.current[0];
      if (!card) return;
      widthRef.current = card.offsetWidth;
      paint();
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [paint]);

  if (count === 0) return null;

  return (
    <div className={cn("w-full", className)} style={{ ["--coverflow-card" as string]: cardWidth }} role="region" aria-roledescription="carousel" aria-label={label}>
      <div className="relative">
        <div
          ref={frameRef}
          tabIndex={0}
          onPointerDown={(event) => {
            pauseAfterManualInteraction();
            settleVersionRef.current += 1;
            settleTweenRef.current?.kill();
            settleTweenRef.current = null;
            event.currentTarget.setPointerCapture(event.pointerId);
            targetRef.current = positionRef.current;
            didDragRef.current = false;
            dragRef.current = { id: event.pointerId, x: event.clientX, position: positionRef.current, velocity: 0, time: performance.now() };
          }}
          onPointerMove={(event) => {
            const drag = dragRef.current;
            const pitch = widthRef.current * (1 + gap);
            if (!drag || drag.id !== event.pointerId || !pitch) return;
            const now = performance.now();
            const previous = positionRef.current;
            if (Math.abs(event.clientX - drag.x) > 6) didDragRef.current = true;
            positionRef.current = clamp(drag.position - (event.clientX - drag.x) / pitch);
            drag.velocity = ((positionRef.current - previous) / Math.max(now - drag.time, 1)) * 1000;
            drag.time = now;
            const index = indexAt(positionRef.current);
            if (index !== selected) setSelected(index);
            paint();
          }}
          onPointerUp={(event) => {
            const drag = dragRef.current;
            if (!drag || drag.id !== event.pointerId) return;
            dragRef.current = null;
            settle(clamp(Math.round(positionRef.current + Math.max(-2, Math.min(2, drag.velocity * 0.18)))));
          }}
          onPointerCancel={() => { dragRef.current = null; settle(clamp(Math.round(positionRef.current))); }}
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft") { event.preventDefault(); pauseAfterManualInteraction(); nudge(-1); }
            if (event.key === "ArrowRight") { event.preventDefault(); pauseAfterManualInteraction(); nudge(1); }
          }}
          className="cursor-grab overflow-hidden py-8 outline-none focus-visible:ring-2 focus-visible:ring-[#7354ee] active:cursor-grabbing sm:py-10"
          style={{ perspective: `calc(var(--coverflow-card) * ${perspective})`, touchAction: "pan-y" }}
        >
          <div className="relative select-none" style={{ height: `calc(var(--coverflow-card) / ${cardAspectRatio})`, transformStyle: "preserve-3d" }}>
            {slides.map((slide, index) => (
              <div
                key={slide.title ?? index}
                ref={(node) => { cardRefs.current[index] = node; }}
                role="button"
                tabIndex={0}
                aria-roledescription="slide"
                aria-current={index === selected || undefined}
                onClick={() => {
                  if (!didDragRef.current) {
                    pauseAfterManualInteraction();
                    goTo(index);
                  }
                }}
                onMouseEnter={() => {
                  hoveredIndexRef.current = index;
                  paint();
                }}
                onMouseLeave={() => {
                  hoveredIndexRef.current = null;
                  paint();
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    pauseAfterManualInteraction();
                    goTo(index);
                  }
                }}
                className={cn("absolute left-1/2 top-0 aspect-[4/5] overflow-hidden rounded-2xl bg-white shadow-[0_10px_24px_rgba(43,33,104,.08)] transition-shadow duration-300 will-change-transform hover:shadow-[0_18px_36px_rgba(43,33,104,.14)] focus-visible:ring-2 focus-visible:ring-[#7354ee]", cardClassName)}
                style={{ width: "var(--coverflow-card)" }}
              >
                {renderSlide ? renderSlide(slide, index, index === selected) : slide.src ? <>
                  {/* Generic slide URLs may be remote and are intentionally not constrained by Next image host configuration. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={slide.src} alt={slide.alt ?? ""} draggable={false} className="size-full select-none object-cover" />
                </> : null}
              </div>
            ))}
          </div>
        </div>

        {showNavigation ? <>
          <button type="button" aria-label="Previous slide" onClick={() => { pauseAfterManualInteraction(); nudge(-1); }} className="absolute left-3 top-1/2 z-[200] flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[#23263a] shadow-sm hover:bg-white"><ChevronLeft className="size-5" /></button>
          <button type="button" aria-label="Next slide" onClick={() => { pauseAfterManualInteraction(); nudge(1); }} className="absolute right-3 top-1/2 z-[200] flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[#23263a] shadow-sm hover:bg-white"><ChevronRight className="size-5" /></button>
        </> : null}
      </div>

      {showPagination ? <div className="mt-1 flex items-center justify-center" aria-label="Carousel slides">
        {slides.map((slide, index) => <button key={slide.title ?? index} type="button" aria-label={`Go to slide ${index + 1}`} aria-current={index === selected} onClick={() => { pauseAfterManualInteraction(); goTo(index); }} className="group flex size-6 items-center justify-center rounded-full"><span aria-hidden className={cn("size-2 rounded-full transition-[background-color,transform]", index === selected ? "scale-110 bg-[#6544e7]" : "bg-[#dcd8ec] group-hover:bg-[#bdb5e5]")} /></button>)}
      </div> : null}
    </div>
  );
}
