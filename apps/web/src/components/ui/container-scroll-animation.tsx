"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import {
  m,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "framer-motion";
import { cn } from "@/lib/utils";

type ContainerScrollProps = {
  children: ReactNode;
  backgroundComponent?: ReactNode;
  titleComponent?: ReactNode;
  className?: string;
  contentClassName?: string;
  onProgress?: (progress: number) => void;
  reducedMotion?: boolean;
  disableFrameTransform?: boolean;
  id?: string;
};

export function ContainerScroll({
  children,
  backgroundComponent,
  titleComponent,
  className,
  contentClassName,
  onProgress,
  reducedMotion,
  disableFrameTransform = false,
  id,
}: ContainerScrollProps) {
  const targetRef = useRef<HTMLDivElement>(null);
  const systemReducedMotion = useReducedMotion();
  const [hasMounted, setHasMounted] = useState(false);
  const [isNearViewport, setIsNearViewport] = useState(false);
  const [isPageVisible, setIsPageVisible] = useState(true);
  const shouldReduceMotion = hasMounted && (reducedMotion ?? Boolean(systemReducedMotion));
  const scrollYProgress = useMotionValue(0);
  const lastReportedProgress = useRef<number | null>(null);
  const metricsRef = useRef({ top: 0, distance: 1 });

  const rotateX = useTransform(scrollYProgress, [0, 0.15], [12, 0]);
  const scale = useTransform(scrollYProgress, [0, 0.15], [0.84, 1]);
  // Keep the frame centered independently from the title overlay.
  const titleOpacity = useTransform(scrollYProgress, [0, 0.05, 0.12], [1, 1, 0]);
  const titleY = useTransform(scrollYProgress, [0, 0.12], [0, -28]);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    const target = targetRef.current;
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

  useEffect(() => {
    if (!isNearViewport || !isPageVisible) return;

    let animationFrame = 0;
    const target = targetRef.current;
    if (!target) return;

    const measure = () => {
      const bounds = target.getBoundingClientRect();
      metricsRef.current = {
        top: bounds.top + window.scrollY,
        distance: Math.max(target.offsetHeight - window.innerHeight, 1),
      };
    };
    const updateProgress = () => {
      animationFrame = 0;
      const { top, distance } = metricsRef.current;
      const progress = Math.min(Math.max((window.scrollY - top) / distance, 0), 1);
      scrollYProgress.set(progress);
      if (onProgress && (lastReportedProgress.current === null || Math.abs(progress - lastReportedProgress.current) >= 0.01 || progress === 0 || progress === 1)) {
        lastReportedProgress.current = progress;
        onProgress(progress);
      }
    };
    const requestUpdate = () => {
      if (animationFrame) return;
      animationFrame = window.requestAnimationFrame(updateProgress);
    };
    const handleResize = () => {
      measure();
      requestUpdate();
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(target);
    measure();
    updateProgress();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", handleResize, { passive: true });
    return () => {
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", handleResize);
      resizeObserver.disconnect();
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
    };
  }, [isNearViewport, isPageVisible, onProgress, scrollYProgress]);

  return (
    <div
      ref={targetRef}
      id={id}
      className={cn("relative h-[300vh] min-h-[1800px]", className)}
    >
      <div className="sticky top-0 h-svh overflow-hidden rounded-t-[28px] bg-[#0d1020] px-5 py-6 sm:rounded-t-[40px] sm:px-8 lg:px-10">
        {backgroundComponent}
        {titleComponent ? (
          <m.div
            style={shouldReduceMotion ? { opacity: 1, transform: "none" } : { opacity: titleOpacity, y: titleY }}
            className="pointer-events-none absolute inset-x-0 top-0 z-20 w-full text-center motion-reduce:transform-none!"
          >
            {titleComponent}
          </m.div>
        ) : null}

        <div className="absolute inset-0 flex items-center justify-center px-5 sm:px-8 lg:px-10">
          <m.div
            data-testid="container-scroll-frame"
            style={
              shouldReduceMotion || disableFrameTransform
                ? { transform: "none" }
                : {
                    rotateX,
                    scale,
                    transformPerspective: 1200,
                    transformOrigin: "50% 50%",
                  }
            }
            className={cn(
              "relative z-10 aspect-[5/3] w-[min(100%,calc((100svh-180px)*1.667))] max-w-[1180px] overflow-hidden rounded-2xl bg-white shadow-[0_38px_100px_rgba(61,42,127,0.18),0_8px_30px_rgba(61,42,127,0.10)] [backface-visibility:hidden] [transform:translateZ(0)] motion-reduce:transform-none! sm:rounded-3xl",
              contentClassName,
            )}
          >
            {children}
          </m.div>
        </div>
      </div>
    </div>
  );
}
