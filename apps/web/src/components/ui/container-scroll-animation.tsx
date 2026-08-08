"use client";

import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import {
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import { cn } from "@/lib/utils";

type ContainerScrollProps = {
  children: ReactNode;
  titleComponent?: ReactNode;
  className?: string;
  contentClassName?: string;
  onProgress?: (progress: number) => void;
  reducedMotion?: boolean;
  id?: string;
};

export function ContainerScroll({
  children,
  titleComponent,
  className,
  contentClassName,
  onProgress,
  reducedMotion,
  id,
}: ContainerScrollProps) {
  const targetRef = useRef<HTMLDivElement>(null);
  const systemReducedMotion = useReducedMotion();
  const shouldReduceMotion = reducedMotion ?? Boolean(systemReducedMotion);
  const { scrollYProgress } = useScroll({
    target: targetRef,
    offset: ["start start", "end end"],
  });

  const rotateX = useTransform(scrollYProgress, [0, 0.15], [12, 0]);
  const scale = useTransform(scrollYProgress, [0, 0.15], [0.84, 1]);
  const translateY = useTransform(scrollYProgress, [0, 0.15], [120, 0]);
  const titleOpacity = useTransform(scrollYProgress, [0, 0.05, 0.12], [1, 1, 0]);
  const titleY = useTransform(scrollYProgress, [0, 0.12], [0, -28]);

  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    onProgress?.(latest);
  });

  useEffect(() => {
    onProgress?.(scrollYProgress.get());
  }, [onProgress, scrollYProgress]);

  return (
    <div
      ref={targetRef}
      id={id}
      className={cn("relative h-[300vh] min-h-[1800px]", className)}
    >
      <div className="sticky top-0 flex h-svh flex-col items-center justify-center overflow-hidden px-5 py-6 sm:px-8 lg:px-10">
        {titleComponent ? (
          <motion.div
            style={shouldReduceMotion ? { opacity: 1, transform: "none" } : { opacity: titleOpacity, y: titleY }}
            className="pointer-events-none relative z-20 mb-5 w-full shrink-0 text-center motion-reduce:transform-none! sm:mb-6"
          >
            {titleComponent}
          </motion.div>
        ) : null}

        <motion.div
          data-testid="container-scroll-frame"
          style={
            shouldReduceMotion
              ? { transform: "none" }
              : {
                  rotateX,
                  scale,
                  y: translateY,
                  transformPerspective: 1200,
                  transformOrigin: "50% 100%",
                }
          }
          className={cn(
            "relative z-10 aspect-[5/3] w-[min(100%,calc((100svh-180px)*1.667))] max-w-[1180px] shrink-0 overflow-hidden rounded-2xl bg-white shadow-[0_38px_100px_rgba(61,42,127,0.18),0_8px_30px_rgba(61,42,127,0.10)] motion-reduce:transform-none! sm:rounded-3xl",
            contentClassName,
          )}
        >
          {children}
        </motion.div>
      </div>
    </div>
  );
}
