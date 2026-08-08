"use client";

import { useRef, type MouseEvent, type ReactNode } from "react";
import { m, useMotionTemplate, useMotionValue } from "framer-motion";
import { cn } from "@/lib/utils";

type SpotlightCardProps = {
  children: ReactNode;
  className?: string;
  spotlightColor?: string;
};

export function SpotlightCard({ children, className, spotlightColor = "rgba(111, 76, 255, 0.18)" }: SpotlightCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(-200);
  const y = useMotionValue(-200);
  const background = useMotionTemplate`radial-gradient(220px circle at ${x}px ${y}px, ${spotlightColor}, transparent 72%)`;

  function handlePointerMove(event: MouseEvent<HTMLDivElement>) {
    const bounds = ref.current?.getBoundingClientRect();
    if (!bounds) return;
    x.set(event.clientX - bounds.left);
    y.set(event.clientY - bounds.top);
  }

  return (
    <div
      ref={ref}
      onMouseMove={handlePointerMove}
      onMouseLeave={() => { x.set(-200); y.set(-200); }}
      className={cn("group relative overflow-hidden rounded-lg border border-[#dedbea] bg-white", className)}
    >
      <m.div aria-hidden className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" style={{ background }} />
      <div className="relative h-full">{children}</div>
    </div>
  );
}
