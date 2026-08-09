"use client";

import { m } from "framer-motion";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type FloatingPathsProps = {
  position: 1 | -1;
  color: string;
  pathCount: number;
  reducedMotion: boolean;
  gradientId: string;
};

function FloatingPaths({ position, color, pathCount, reducedMotion, gradientId }: FloatingPathsProps) {
  const paths = Array.from({ length: pathCount }, (_, index) => ({
    id: index,
    d: `M-${380 - index * 5 * position} -${189 + index * 6}C-${380 - index * 5 * position} -${189 + index * 6} -${312 - index * 5 * position} ${252 - index * 6} ${152 - index * 5 * position} ${405 - index * 8}C${616 - index * 5 * position} ${582 - index * 8} ${684 - index * 5 * position} ${920 - index * 10} ${684 - index * 5 * position} ${1125 - index * 10}`,
    opacity: 0.3 + index * 0.016,
    width: 0.56 + index * 0.014,
  }));

  return (
    <svg className={cn("absolute inset-0 size-full overflow-visible", position === -1 && "-scale-x-100")} viewBox="0 0 696 1000" fill="none" preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="696" y2="316" gradientUnits="userSpaceOnUse">
          <stop stopColor={color} stopOpacity="0" />
          <stop offset="0.28" stopColor={color} stopOpacity="0.9" />
          <stop offset="0.72" stopColor={color} stopOpacity="0.66" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <m.g
        initial={false}
        animate={reducedMotion ? undefined : { x: [0, position * 14, 0], y: [0, -8, 0], opacity: [0.72, 1, 0.72] }}
        transition={reducedMotion ? undefined : { duration: position === 1 ? 16 : 19, repeat: Infinity, ease: "easeInOut" }}
      >
        {paths.map((path) => (
          <g key={path.id}>
            <path d={path.d} stroke={`url(#${gradientId})`} strokeWidth={path.width} strokeOpacity={path.opacity} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          </g>
        ))}
      </m.g>
    </svg>
  );
}

export function BackgroundPaths({
  className,
  reducedMotion = false,
  pathCount = 18,
}: {
  className?: string;
  reducedMotion?: boolean;
  pathCount?: number;
}) {
  const id = useId().replaceAll(":", "");
  const rootRef = useRef<HTMLDivElement>(null);
  const [isNearViewport, setIsNearViewport] = useState(false);
  const [isPageVisible, setIsPageVisible] = useState(true);
  const pauseAnimation = reducedMotion || !isNearViewport || !isPageVisible;

  useEffect(() => {
    const target = rootRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      ([entry]) => setIsNearViewport(entry.isIntersecting),
      { rootMargin: "320px 0px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const updateVisibility = () => setIsPageVisible(!document.hidden);
    updateVisibility();
    document.addEventListener("visibilitychange", updateVisibility);
    return () => document.removeEventListener("visibilitychange", updateVisibility);
  }, []);

  return (
    <div ref={rootRef} aria-hidden className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-x-[-8%] inset-y-0 rotate-[-2deg]">
          <FloatingPaths position={1} color="#8070f5" pathCount={pathCount} reducedMotion={pauseAnimation} gradientId={`${id}-violet`} />
          <FloatingPaths position={-1} color="#6f94ee" pathCount={pathCount} reducedMotion={pauseAnimation} gradientId={`${id}-blue`} />
        </div>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_28%,#0d1020_94%)] opacity-15" />
      </div>
    </div>
  );
}
