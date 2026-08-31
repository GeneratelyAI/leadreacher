"use client";

import { type ReactNode, useRef } from "react";
import { m, useInView, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

type MarkerHighlightProps = {
  children: ReactNode;
  className?: string;
};

export function MarkerHighlight({ children, className }: MarkerHighlightProps) {
  const reducedMotion = Boolean(useReducedMotion());
  const highlightRef = useRef<HTMLSpanElement>(null);
  const isHighlightInView = useInView(highlightRef, { amount: 0.7 });

  return (
    <span ref={highlightRef} className={cn("relative isolate inline-block whitespace-nowrap px-1 text-white", className)}>
      <m.span
        aria-hidden
        initial={reducedMotion ? false : { scaleX: 0 }}
        animate={{ scaleX: reducedMotion || isHighlightInView ? 1 : 0 }}
        transition={reducedMotion || !isHighlightInView ? { duration: 0 } : { duration: 0.62, ease: [0.22, 1, 0.36, 1] }}
        className="absolute -inset-x-1 -inset-y-[0.06em] -z-10 origin-left -skew-x-3 rounded-sm bg-[#6842f5]"
      />
      {children}
    </span>
  );
}
