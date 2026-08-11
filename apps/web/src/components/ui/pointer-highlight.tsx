"use client";

import { useEffect, useRef, useState, type ReactNode, type RefObject, type SVGProps } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export function PointerHighlight({
  children,
  rectangleClassName,
  pointerClassName,
  containerClassName,
  inline = false,
}: {
  children: ReactNode;
  rectangleClassName?: string;
  pointerClassName?: string;
  containerClassName?: string;
  inline?: boolean;
}) {
  const containerRef = useRef<HTMLElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

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
      {children}
      {dimensions.width > 0 && dimensions.height > 0 ? (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0"
          initial={{ opacity: 0, scale: 0.95, originX: 0, originY: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <motion.span
            className={cn("absolute inset-0 border border-neutral-800 dark:border-neutral-200", rectangleClassName)}
            initial={{ width: 0, height: 0 }}
            whileInView={{ width: dimensions.width, height: dimensions.height }}
            transition={{ duration: 1, ease: "easeInOut" }}
          />
          <motion.span
            className="absolute pointer-events-none"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1, x: dimensions.width + 4, y: dimensions.height + 4 }}
            style={{ rotate: -90 }}
            transition={{ opacity: { duration: 0.1, ease: "easeInOut" }, duration: 1, ease: "easeInOut" }}
          >
            <Pointer className={cn("size-5 text-blue-500", pointerClassName)} />
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
