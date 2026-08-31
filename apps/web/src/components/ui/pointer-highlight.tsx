"use client";

import { useEffect, useRef, useState, type ReactNode, type RefObject, type SVGProps } from "react";
import Image from "next/image";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

export function PointerHighlight({
  children,
  rectangleClassName,
  pointerClassName,
  containerClassName,
  indicator = "pointer",
  variant = "outline",
  inline = false,
}: {
  children: ReactNode;
  rectangleClassName?: string;
  pointerClassName?: string;
  containerClassName?: string;
  indicator?: "pointer" | "plane";
  variant?: "outline" | "marker";
  inline?: boolean;
}) {
  const containerRef = useRef<HTMLElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const reducedMotion = Boolean(useReducedMotion());
  const isInView = useInView(containerRef, { amount: 0.7 });
  const isVisible = reducedMotion || isInView;
  const indicatorTarget = indicator === "plane"
    ? { x: dimensions.width, y: dimensions.height }
    : { x: dimensions.width + 4, y: dimensions.height + 4 };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateDimensions = () => {
      const { width, height } = container.getBoundingClientRect();
      setDimensions({ width, height });
    };

    updateDimensions();
    const observer = new ResizeObserver(updateDimensions);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const content = (
    <>
      <span className={cn("relative z-10", variant === "marker" && "text-white")}>{children}</span>
      {dimensions.width > 0 && dimensions.height > 0 ? (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0"
          initial={reducedMotion ? false : { opacity: 0, scale: 0.95, originX: 0, originY: 0 }}
          animate={isVisible ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.95 }}
          transition={reducedMotion || !isInView ? { duration: 0 } : { duration: 0.5, ease: "easeOut" }}
        >
          <motion.span
            className={cn(
              variant === "marker"
                ? "absolute -inset-x-1 -inset-y-[0.06em] origin-left -skew-x-3 rounded-sm bg-[#6842f5]"
                : "absolute inset-0 border border-neutral-800 dark:border-neutral-200",
              rectangleClassName,
            )}
            initial={reducedMotion ? false : variant === "marker" ? { scaleX: 0 } : { width: 0, height: 0 }}
            animate={variant === "marker"
              ? { scaleX: isVisible ? 1 : 0 }
              : isVisible ? { width: dimensions.width, height: dimensions.height } : { width: 0, height: 0 }}
            transition={reducedMotion || !isInView ? { duration: 0 } : { duration: 1, ease: "easeInOut" }}
          />
          <motion.span
            className="absolute z-20 pointer-events-none"
            initial={reducedMotion ? false : { opacity: 0 }}
            animate={isVisible ? { opacity: 1, ...indicatorTarget } : { opacity: 0, x: 0, y: 0 }}
            style={{ rotate: indicator === "plane" ? 0 : -90, scaleX: indicator === "plane" ? -1 : 1 }}
            transition={reducedMotion || !isInView ? { duration: 0 } : { opacity: { duration: 0.1, ease: "easeInOut" }, duration: 1, ease: "easeInOut" }}
          >
            {indicator === "plane" ? (
              <motion.span
                animate={isVisible && !reducedMotion ? { y: [0, -2.5, 0] } : { y: 0 }}
                transition={reducedMotion || !isInView
                  ? { duration: 0 }
                  : { duration: 1.9, delay: 1, ease: "easeInOut", repeat: Infinity }}
                className="block"
              >
                <Image
                  src="/logo/leadreacher_plane_only.svg"
                  alt=""
                  width={36}
                  height={36}
                  className={cn("size-9 drop-shadow-[0_2px_3px_rgba(83,38,183,0.2)]", pointerClassName)}
                />
              </motion.span>
            ) : (
              <Pointer className={cn("size-5 text-blue-500", pointerClassName)} />
            )}
          </motion.span>
        </motion.span>
      ) : null}
    </>
  );

  return inline ? (
    <span ref={containerRef as RefObject<HTMLSpanElement>} className={cn("relative inline-block w-fit", containerClassName)}>
      {content}
    </span>
  ) : (
    <div ref={containerRef as RefObject<HTMLDivElement>} className={cn("relative w-fit", containerClassName)}>
      {content}
    </div>
  );
}

function Pointer(props: SVGProps<SVGSVGElement>) {
  return (
    <svg stroke="currentColor" fill="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 16 16" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M14.082 2.182a.5.5 0 0 1 .103.557L8.528 15.467a.5.5 0 0 1-.917-.007L5.57 10.694.803 8.652a.5.5 0 0 1-.006-.916l12.728-5.657a.5.5 0 0 1 .556.103z" />
    </svg>
  );
}
