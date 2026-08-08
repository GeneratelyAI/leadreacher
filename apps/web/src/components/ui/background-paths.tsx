"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

export function BackgroundPaths({ className }: { className?: string }) {
  const reducedMotion = useReducedMotion();
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      <svg viewBox="0 0 1440 420" preserveAspectRatio="none" className="h-full w-full">
        <defs>
          <linearGradient id="cta-path-gradient" x1="0" x2="1">
            <stop offset="0" stopColor="#5732e7" stopOpacity="0" />
            <stop offset="0.48" stopColor="#8f6cff" stopOpacity="0.74" />
            <stop offset="1" stopColor="#4c22ff" stopOpacity="0.08" />
          </linearGradient>
        </defs>
        {Array.from({ length: 14 }, (_, index) => {
          const offset = index * 11;
          return (
            <motion.path
              key={offset}
              d={`M -80 ${330 + offset} C 250 ${170 + offset}, 520 ${390 - offset}, 810 ${270 + offset / 2} S 1220 ${150 + offset}, 1530 ${235 - offset / 3}`}
              fill="none"
              stroke="url(#cta-path-gradient)"
              strokeWidth={index % 4 === 0 ? 1.6 : 0.8}
              initial={reducedMotion ? undefined : { pathLength: 0.2, opacity: 0.2 }}
              animate={reducedMotion ? undefined : { pathLength: 1, opacity: [0.22, 0.7, 0.22], pathOffset: [0, 0.08, 0] }}
              transition={{ duration: 7 + index * 0.2, repeat: Infinity, ease: "easeInOut", delay: index * 0.08 }}
            />
          );
        })}
      </svg>
    </div>
  );
}
