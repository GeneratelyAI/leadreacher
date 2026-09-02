"use client";

import { useEffect, useRef, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type SpotlightCardProps = {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  spotlightColor?: string;
  spotlightClassName?: string;
};

export function SpotlightCard({ children, className, contentClassName, spotlightColor = "rgba(111, 76, 255, 0.18)", spotlightClassName }: SpotlightCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const frameRef = useRef(0);
  const boundsRef = useRef<DOMRect | null>(null);
  const pointerRef = useRef({ x: -200, y: -200 });

  useEffect(() => () => {
    if (frameRef.current) window.cancelAnimationFrame(frameRef.current);
  }, []);

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const bounds = boundsRef.current ?? ref.current?.getBoundingClientRect();
    if (!bounds) return;
    pointerRef.current = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
    if (frameRef.current) return;
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = 0;
      ref.current?.style.setProperty("--spotlight-x", `${pointerRef.current.x}px`);
      ref.current?.style.setProperty("--spotlight-y", `${pointerRef.current.y}px`);
    });
  }

  return (
    <div
      ref={ref}
      onPointerEnter={(event) => {
        boundsRef.current = ref.current?.getBoundingClientRect() ?? null;
        handlePointerMove(event);
      }}
      onPointerMove={handlePointerMove}
      onPointerLeave={() => {
        boundsRef.current = null;
        if (frameRef.current) window.cancelAnimationFrame(frameRef.current);
        frameRef.current = 0;
        ref.current?.style.setProperty("--spotlight-x", "-200px");
        ref.current?.style.setProperty("--spotlight-y", "-200px");
      }}
      className={cn("group relative overflow-hidden rounded-lg border border-[#dedbea] bg-white", className)}
      style={{ "--spotlight-x": "-200px", "--spotlight-y": "-200px" } as CSSProperties}
    >
      <div
        aria-hidden
        className={cn("pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100", spotlightClassName)}
        style={{ background: `radial-gradient(280px circle at var(--spotlight-x) var(--spotlight-y), ${spotlightColor}, transparent 68%)` }}
      />
      <div className={cn("relative h-full", contentClassName)}>{children}</div>
    </div>
  );
}
