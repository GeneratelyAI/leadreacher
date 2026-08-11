"use client";

import { m, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

type BubbleTextProps = {
  children: string;
  className?: string;
};

export function BubbleText({ children, className }: BubbleTextProps) {
  const reducedMotion = useReducedMotion();

  return (
    <span className={cn("inline-flex whitespace-pre", className)} aria-label={children}>
      {Array.from(children).map((character, index) => (
        <m.span
          key={`${character}-${index}`}
          aria-hidden
          className="inline-block"
          whileHover={reducedMotion ? undefined : { y: -8, scale: 1.1 }}
          transition={{ type: "spring", stiffness: 460, damping: 14, mass: 0.45 }}
        >
          {character}
        </m.span>
      ))}
    </span>
  );
}
