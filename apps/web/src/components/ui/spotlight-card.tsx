"use client";

import { useEffect, useRef, type ComponentPropsWithoutRef, type MouseEvent, type ReactNode } from "react";
import { m, useMotionTemplate, useMotionValue } from "framer-motion";
import { cn } from "@/lib/utils";

type SpotlightCardProps = Omit<ComponentPropsWithoutRef<"div">, "children"> & {
  children: ReactNode;
  className?: string;
  spotlightColor?: string;
  spotlightClassName?: string;
};

export function SpotlightCard({ children, className, spotlightColor = "rgba(111, 76, 255, 0.18)", spotlightClassName, ...props }: SpotlightCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const frameRef = useRef(0);
  const boundsRef = useRef<DOMRect | null>(null);
  const pointerRef = useRef({ x: -200, y: -200 });
  const x = useMotionValue(-200);
  const y = useMotionValue(-200);
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
      {...props}
      onMouseEnter={() => { boundsRef.current = ref.current?.getBoundingClientRect() ?? null; }}
      onMouseMove={handlePointerMove}
      onMouseLeave={() => {
        boundsRef.current = null;
        if (frameRef.current) window.cancelAnimationFrame(frameRef.current);
        frameRef.current = 0;
        x.set(-200);
        y.set(-200);
      }}
      className={cn("group relative overflow-hidden rounded-lg border border-[#dedbea] bg-white", className)}
    >
      <m.div aria-hidden className={cn("pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100", spotlightClassName)} style={{ background }} />
      <div className="relative h-full">{children}</div>
    </div>
  );
}
