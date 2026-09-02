"use client";

import { useEffect, useRef, type MouseEvent, type ReactNode } from "react";
import { m, useMotionTemplate, useMotionValue, useSpring } from "framer-motion";
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
  const x = useMotionValue(-200);
  const y = useMotionValue(-200);
  const opacityTarget = useMotionValue(0);
  const opacity = useSpring(opacityTarget, { stiffness: 260, damping: 30 });
  const background = useMotionTemplate`radial-gradient(280px circle at ${x}px ${y}px, ${spotlightColor}, transparent 68%)`;

  useEffect(() => () => {
    if (frameRef.current) window.cancelAnimationFrame(frameRef.current);
  }, []);

  function handlePointerMove(event: MouseEvent<HTMLDivElement>) {
    const bounds = boundsRef.current;
    if (!bounds) return;
    pointerRef.current = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
    if (frameRef.current) return;
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = 0;
      x.set(pointerRef.current.x);
      y.set(pointerRef.current.y);
    });
  }

  return (
    <div
      ref={ref}
      onMouseEnter={(event) => {
        const bounds = ref.current?.getBoundingClientRect() ?? null;
        boundsRef.current = bounds;
        if (bounds) {
          const pointer = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
          pointerRef.current = pointer;
          x.set(pointer.x);
          y.set(pointer.y);
        }
        opacityTarget.set(1);
      }}
      onMouseMove={handlePointerMove}
      onMouseLeave={() => {
        boundsRef.current = null;
        if (frameRef.current) window.cancelAnimationFrame(frameRef.current);
        frameRef.current = 0;
        x.set(-200);
        y.set(-200);
        opacityTarget.set(0);
      }}
      className={cn("group relative overflow-hidden rounded-lg border border-[#dedbea] bg-white", className)}
    >
      <m.div aria-hidden className={cn("pointer-events-none absolute inset-0", spotlightClassName)} style={{ background, opacity }} />
      <div className={cn("relative h-full", contentClassName)}>{children}</div>
    </div>
  );
}
