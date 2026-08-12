"use client";

import {
  type MutableRefObject,
  type PointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { useReducedMotion } from "framer-motion";
import Image from "next/image";
import { cn } from "@/lib/utils";

type TrustedBrand = {
  name: string;
  src: string;
  widthClassName: string;
};

const TRUSTED_BRANDS: readonly TrustedBrand[] = [
  { name: "Emirates", src: "/landing/trusted-brands/emirates-monochrome.png", widthClassName: "w-32 sm:w-36" },
  { name: "Accenture", src: "/landing/trusted-brands/accenture-monochrome.png", widthClassName: "w-36 sm:w-44" },
  { name: "Shell", src: "/landing/trusted-brands/shell-monochrome.png", widthClassName: "w-20 sm:w-24" },
  { name: "RE/MAX", src: "/landing/trusted-brands/remax-monochrome.png", widthClassName: "w-32 sm:w-36" },
  { name: "Amazon Web Services", src: "/landing/trusted-brands/aws-monochrome.png", widthClassName: "w-36 sm:w-40" },
  { name: "Grammarly", src: "/landing/trusted-brands/grammarly-monochrome.png", widthClassName: "w-36 sm:w-40" },
  { name: "Hilton", src: "/landing/trusted-brands/hilton-monochrome.png", widthClassName: "w-28 sm:w-32" },
  { name: "Samsung", src: "/landing/trusted-brands/samsung-monochrome.png", widthClassName: "w-36 sm:w-40" },
  { name: "Nespresso", src: "/landing/trusted-brands/nespresso-monochrome.png", widthClassName: "w-32 sm:w-36" },
  { name: "Red Bull", src: "/landing/trusted-brands/redbull-monochrome.png", widthClassName: "w-32 sm:w-36" },
  { name: "Deloitte", src: "/landing/trusted-brands/deloitte-monochrome.png", widthClassName: "w-36 sm:w-40" },
  { name: "Omnicom Media Group", src: "/landing/trusted-brands/omnicom-monochrome.png", widthClassName: "w-36 sm:w-40" },
] as const;

const BASE_SPEED_PX_PER_SECOND = 20;
const SCROLL_VELOCITY_FACTOR = 0.16;
const MAX_SCROLL_VELOCITY = 2_400;
const VELOCITY_SMOOTHING_RATE = 12;
const MAX_FRAME_SECONDS = 0.05;

function wrapTrackOffset(offset: number, loopWidth: number) {
  return ((offset % loopWidth) + loopWidth) % loopWidth - loopWidth;
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

function BrandLogo({ brand }: { brand: TrustedBrand }) {
  return (
    <span
      className={cn("relative flex h-12 shrink-0 items-center justify-center sm:h-14", brand.widthClassName)}
      role="img"
      aria-label={brand.name}
    >
      <Image
        src={brand.src}
        alt=""
        fill
        sizes="176px"
        loading="eager"
        className="object-contain grayscale contrast-200"
      />
    </span>
  );
}

function BrandGroup({ duplicate, groupRef }: { duplicate?: boolean; groupRef?: MutableRefObject<HTMLDivElement | null> }) {
  return (
    <div
      ref={groupRef}
      className="flex shrink-0 items-center gap-14 pr-14 sm:gap-20 sm:pr-20 lg:gap-24 lg:pr-24"
      aria-hidden={duplicate || undefined}
    >
      {TRUSTED_BRANDS.map((brand) => <BrandLogo key={brand.name} brand={brand} />)}
    </div>
  );
}

function BrandTrack({ velocityRef, reducedMotion }: { velocityRef: MutableRefObject<number>; reducedMotion: boolean }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const groupRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef(0);
  const dragStartRef = useRef<{ x: number; offset: number } | null>(null);
  const isDraggingRef = useRef(false);

  useEffect(() => {
    const viewport = viewportRef.current;
    const track = trackRef.current;
    if (!viewport || !track || reducedMotion) return;

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
      const loopWidth = groupRef.current?.offsetWidth ?? 0;

      previousTime = now;
      if (loopWidth > 0) {
        const nextOffset = isDraggingRef.current
          ? offsetRef.current
          : offsetRef.current - speed * elapsedSeconds;
        offsetRef.current = wrapTrackOffset(nextOffset, loopWidth);
        track.style.transform = `translate3d(${offsetRef.current}px, 0, 0)`;
      }

      if (isVisible) frameId = window.requestAnimationFrame(animate);
    };

    const observer = new IntersectionObserver(([entry]) => {
      isVisible = entry.isIntersecting;
      if (!isVisible) {
        stop();
        return;
      }

      previousTime = performance.now();
      if (frameId === undefined) frameId = window.requestAnimationFrame(animate);
    }, { rootMargin: "180px 0px" });

    observer.observe(viewport);
    return () => {
      observer.disconnect();
      stop();
    };
  }, [reducedMotion, velocityRef]);

  const updateDragPosition = (clientX: number) => {
    const start = dragStartRef.current;
    const track = trackRef.current;
    const loopWidth = groupRef.current?.offsetWidth ?? 0;
    if (!start || !track || loopWidth === 0) return;

    offsetRef.current = wrapTrackOffset(start.offset + clientX - start.x, loopWidth);
    track.style.transform = `translate3d(${offsetRef.current}px, 0, 0)`;
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (reducedMotion) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStartRef.current = { x: event.clientX, offset: offsetRef.current };
    isDraggingRef.current = true;
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    updateDragPosition(event.clientX);
  };

  const stopDragging = (event: PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    updateDragPosition(event.clientX);
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
        "cursor-grab touch-pan-y select-none overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)] active:cursor-grabbing",
        reducedMotion && "overflow-x-auto [mask-image:none]",
      )}
      aria-label="Brands that trust LeadReacher"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={stopDragging}
      onPointerCancel={stopDragging}
    >
      <div ref={trackRef} className="flex w-max items-center py-2 will-change-transform">
        <BrandGroup groupRef={groupRef} />
        <BrandGroup duplicate />
      </div>
    </div>
  );
}

export default function TrustedBrandsMarquee() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [isNearViewport, setIsNearViewport] = useState(false);
  const reducedMotion = Boolean(useReducedMotion());
  const velocityRef = useScrollVelocity(isNearViewport, reducedMotion);

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

  return (
    <div
      ref={sectionRef}
      className="relative z-20 overflow-hidden pb-8 pt-24 sm:pb-10 sm:pt-32 lg:pb-12 lg:pt-40"
    >
      <h2
        id="trusted-brands-title"
        className="px-5 text-center text-xs font-semibold uppercase tracking-[0.16em] text-[#596078] sm:text-sm"
      >
        Trusted by these brands
      </h2>
      <div className="mt-7 sm:mt-9">
        <BrandTrack velocityRef={velocityRef} reducedMotion={reducedMotion} />
      </div>
    </div>
  );
}
