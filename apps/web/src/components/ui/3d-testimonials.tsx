"use client";

import {
  type ComponentPropsWithoutRef,
  type MutableRefObject,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { useReducedMotion } from "framer-motion";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/Card";
import { usePageVisibility } from "@/hooks/usePageVisibility";
import { cn } from "@/lib/utils";

import styles from "./3d-testimonials.module.css";

const BASE_SPEED_PX_PER_SECOND = 12;
const SCROLL_VELOCITY_FACTOR = 0.28;
const MAX_SCROLL_VELOCITY = 3_200;
const VELOCITY_SMOOTHING_RATE = 12;
const MAX_FRAME_SECONDS = 0.05;

function wrapTrackOffset(offset: number, loopHeight: number) {
  return ((offset % loopHeight) + loopHeight) % loopHeight - loopHeight;
}

function useScrollVelocity(isActive: boolean, reducedMotion: boolean) {
  const velocityRef = useRef(0);

  useEffect(() => {
    if (!isActive || reducedMotion) {
      velocityRef.current = 0;
      return;
    }

    let frameId = 0;
    let previousScrollY = window.scrollY;
    let previousTime = performance.now();

    const updateVelocity = (now: number) => {
      const elapsedSeconds = Math.max((now - previousTime) / 1_000, 0.001);
      const currentScrollY = window.scrollY;
      const targetVelocity = (currentScrollY - previousScrollY) / elapsedSeconds;
      const smoothing = Math.min(1, VELOCITY_SMOOTHING_RATE * elapsedSeconds);

      velocityRef.current += (targetVelocity - velocityRef.current) * smoothing;
      previousScrollY = currentScrollY;
      previousTime = now;
      frameId = window.requestAnimationFrame(updateVelocity);
    };

    frameId = window.requestAnimationFrame(updateVelocity);
    return () => window.cancelAnimationFrame(frameId);
  }, [isActive, reducedMotion]);

  return velocityRef;
}

type MarqueeProps = ComponentPropsWithoutRef<"div"> & {
  reverse?: boolean;
  pauseOnHover?: boolean;
  children: ReactNode;
  ariaLabel?: string;
};

export function Marquee({
  className,
  reverse = false,
  pauseOnHover = false,
  children,
  ariaLabel,
  ...props
}: MarqueeProps) {
  return (
    <div
      {...props}
      className={cn(styles.marquee, pauseOnHover && styles.pauseOnHover, className)}
      aria-label={ariaLabel}
    >
      <div className={cn(styles.track, reverse && styles.reverse)}>{children}</div>
      <div className={cn(styles.track, reverse && styles.reverse)} aria-hidden="true">
        {children}
      </div>
    </div>
  );
}

type ScrollDrivenColumnProps = {
  reverse?: boolean;
  active: boolean;
  reducedMotion: boolean;
  velocityRef: MutableRefObject<number>;
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
  ariaHidden?: boolean;
};

function ScrollDrivenColumn({
  reverse = false,
  active,
  reducedMotion,
  velocityRef,
  children,
  className,
  ariaLabel,
  ariaHidden,
}: ScrollDrivenColumnProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const groupRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef(0);
  const initializedRef = useRef(false);
  const dragStartRef = useRef<{ y: number; offset: number } | null>(null);
  const isDraggingRef = useRef(false);
  const isPausedRef = useRef(false);

  useEffect(() => {
    const viewport = viewportRef.current;
    const track = trackRef.current;
    if (!viewport || !track || reducedMotion || !active) return;

    let frameId: number | undefined;
    let isVisible = false;
    let previousTime = performance.now();

    const stop = () => {
      if (frameId === undefined) return;
      window.cancelAnimationFrame(frameId);
      frameId = undefined;
    };

    const animate = (now: number) => {
      const elapsedSeconds = Math.min(Math.max((now - previousTime) / 1_000, 0), MAX_FRAME_SECONDS);
      const scrollVelocity = Math.min(Math.abs(velocityRef.current), MAX_SCROLL_VELOCITY);
      const speed = BASE_SPEED_PX_PER_SECOND + scrollVelocity * SCROLL_VELOCITY_FACTOR;
      const loopHeight = groupRef.current?.offsetHeight ?? 0;

      previousTime = now;
      if (loopHeight > 0) {
        if (!initializedRef.current) {
          offsetRef.current = reverse ? -loopHeight : 0;
          initializedRef.current = true;
        }

        const direction = reverse ? 1 : -1;
        const nextOffset = isDraggingRef.current || isPausedRef.current
          ? offsetRef.current
          : offsetRef.current + direction * speed * elapsedSeconds;
        offsetRef.current = wrapTrackOffset(nextOffset, loopHeight);
        track.style.transform = `translate3d(0, ${offsetRef.current}px, 0)`;
      }

      if (isVisible) frameId = window.requestAnimationFrame(animate);
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        isVisible = entry.isIntersecting;
        if (!isVisible) {
          stop();
          return;
        }

        previousTime = performance.now();
        if (frameId === undefined) frameId = window.requestAnimationFrame(animate);
      },
      { rootMargin: "180px 0px" },
    );

    observer.observe(viewport);
    return () => {
      observer.disconnect();
      stop();
    };
  }, [active, reducedMotion, reverse, velocityRef]);

  const updateDragPosition = (clientY: number) => {
    const start = dragStartRef.current;
    const track = trackRef.current;
    const loopHeight = groupRef.current?.offsetHeight ?? 0;
    if (!start || !track || loopHeight === 0) return;

    offsetRef.current = wrapTrackOffset(start.offset + clientY - start.y, loopHeight);
    track.style.transform = `translate3d(0, ${offsetRef.current}px, 0)`;
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (reducedMotion || event.pointerType === "touch") return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStartRef.current = { y: event.clientY, offset: offsetRef.current };
    isDraggingRef.current = true;
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    updateDragPosition(event.clientY);
  };

  const stopDragging = (event: PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    updateDragPosition(event.clientY);
    dragStartRef.current = null;
    isDraggingRef.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <div
      ref={viewportRef}
      className={cn(
        styles.scrollViewport,
        !reducedMotion && "cursor-grab active:cursor-grabbing",
        className,
      )}
      aria-label={ariaLabel}
      aria-hidden={ariaHidden || undefined}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={stopDragging}
      onPointerCancel={stopDragging}
      onMouseEnter={() => {
        isPausedRef.current = true;
      }}
      onMouseLeave={() => {
        isPausedRef.current = false;
      }}
    >
      <div ref={trackRef} className={styles.scrollTrack}>
        <div ref={groupRef} className={styles.scrollGroup}>
          {children}
        </div>
        <div className={styles.scrollGroup} aria-hidden="true">
          {children}
        </div>
      </div>
    </div>
  );
}

export type TestimonialPreview = {
  name: string;
  role: string;
  body: string;
  initials: string;
  accent: string;
  avatarUrl?: string;
};

function TestimonialCard({ name, role, body, initials, accent, avatarUrl }: TestimonialPreview) {
  const updateSpotlight = (event: MouseEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--spotlight-x", `${event.clientX - bounds.left}px`);
    event.currentTarget.style.setProperty("--spotlight-y", `${event.clientY - bounds.top}px`);
  };

  return (
    <Card
      onMouseMove={updateSpotlight}
      className="group/testimonial relative isolate h-[16.75rem] w-[16.25rem] overflow-hidden rounded-2xl border border-[#dcd6f7] bg-white/96 py-0 shadow-[0_14px_38px_rgba(54,36,120,0.10)] backdrop-blur-sm transition-[border-color,box-shadow] duration-300 hover:border-[#c8baff] hover:shadow-[0_18px_46px_rgba(54,36,120,0.16)]"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -inset-20 z-0 opacity-0 transition-opacity duration-200 group-hover/testimonial:opacity-100 [background:radial-gradient(220px_circle_at_var(--spotlight-x,_50%)_var(--spotlight-y,_50%),rgba(111,76,255,.16),transparent_70%)]"
      />
      <CardContent className="relative z-10 p-4.5">
        <div className="flex items-center gap-2.5">
          <Avatar className="size-9">
            {avatarUrl ? (
              <AvatarImage src={avatarUrl} alt="" className="object-cover" />
            ) : null}
            <AvatarFallback className={cn("font-semibold", accent)}>{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[#16182a]">{name}</p>
            <p className="mt-0.5 line-clamp-2 text-[11px] font-medium leading-4 text-[#74798d]">{role}</p>
          </div>
        </div>
        <blockquote className="mt-3 line-clamp-8 text-[13px] leading-[1.48] text-[#50566b]">“{body}”</blockquote>
      </CardContent>
    </Card>
  );
}

type ThreeDimensionalTestimonialsProps = {
  testimonials: readonly TestimonialPreview[];
  className?: string;
};

export function ThreeDimensionalTestimonials({
  testimonials,
  className,
}: ThreeDimensionalTestimonialsProps) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [isNearViewport, setIsNearViewport] = useState(false);
  const reducedMotion = Boolean(useReducedMotion());
  const isPageVisible = usePageVisibility();
  const isAnimationActive = isNearViewport && isPageVisible;
  const velocityRef = useScrollVelocity(isAnimationActive, reducedMotion);
  const firstTestimonial = testimonials[0];

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const observer = new IntersectionObserver(
      ([entry]) => setIsNearViewport(entry.isIntersecting),
      { rootMargin: "400px 0px" },
    );
    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  if (!firstTestimonial) return null;

  const columns = [
    testimonials,
    [...testimonials.slice(3), ...testimonials.slice(0, 3)],
    [...testimonials.slice(1), firstTestimonial],
  ];

  return (
    <div
      ref={sectionRef}
      className={cn(
        "relative flex h-[28rem] w-full items-center justify-center overflow-hidden [perspective:800px]",
        className,
      )}
      aria-label="LeadReacher customer testimonials"
    >
      <div
        className={cn(styles.perspectiveTrack, "flex h-[42rem] flex-row items-start gap-5")}
        style={{
          transform:
            "translate3d(0,-1.25rem,-1rem) rotateX(7deg) rotateY(-6deg) rotateZ(4deg)",
        }}
      >
        {columns.map((column, columnIndex) => (
          <ScrollDrivenColumn
            key={columnIndex}
            reverse={columnIndex % 2 === 1}
            active={isAnimationActive}
            reducedMotion={reducedMotion}
            velocityRef={velocityRef}
            ariaLabel={columnIndex === 0 ? "Customer testimonials. Scroll to accelerate the columns." : undefined}
            ariaHidden={columnIndex > 0}
            className={cn(
              "h-[42rem]",
              columnIndex > 1 && "hidden sm:flex",
            )}
          >
            {column.map((testimonial, itemIndex) => (
              <TestimonialCard
                key={`${columnIndex}-${testimonial.name}-${itemIndex}`}
                {...testimonial}
              />
            ))}
          </ScrollDrivenColumn>
        ))}
      </div>
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-white to-transparent" />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-white to-transparent" />
      <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-white to-transparent" />
      <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-white to-transparent" />
    </div>
  );
}
