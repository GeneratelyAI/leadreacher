"use client";

import { useRef, type ReactNode } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { cn } from "@/lib/utils";

export function ScrollExpansion({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "center center"] });
  const scale = useTransform(scrollYProgress, [0, 1], reducedMotion ? [1, 1] : [0.9, 1]);
  const rotateX = useTransform(scrollYProgress, [0, 1], reducedMotion ? [0, 0] : [7, 0]);
  const opacity = useTransform(scrollYProgress, [0, 0.35, 1], [0.55, 0.9, 1]);
  return <div ref={ref} className={cn("[perspective:1200px]", className)}><motion.div style={{ scale, rotateX, opacity, transformOrigin: "center bottom" }}>{children}</motion.div></div>;
}
