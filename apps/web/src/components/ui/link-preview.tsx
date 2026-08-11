"use client";

import { AnimatePresence, m, useReducedMotion } from "framer-motion";
import { useId, useRef, useState, type AnchorHTMLAttributes, type ReactNode, type WheelEvent } from "react";

type LinkPreviewProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "children" | "href"> & {
  children: ReactNode;
  previewUrl?: string;
  url: string;
};

export function LinkPreview({ children, className, previewUrl, url, ...props }: LinkPreviewProps) {
  const [isOpen, setIsOpen] = useState(false);
  const reducedMotion = useReducedMotion();
  const tooltipId = useId();
  const previewFrameRef = useRef<HTMLIFrameElement>(null);

  function handlePreviewWheel(event: WheelEvent<HTMLSpanElement>) {
    event.preventDefault();

    try {
      previewFrameRef.current?.contentWindow?.scrollBy({
        top: event.deltaY,
        left: event.deltaX,
        behavior: "auto",
      });
    } catch {
      // Cross-origin previews cannot be scrolled programmatically.
    }
  }

  return (
    <span className="relative inline-block">
      <a
        href={url}
        className={className}
        aria-describedby={isOpen ? tooltipId : undefined}
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setIsOpen(false)}
        {...props}
      >
        {children}
      </a>

      <AnimatePresence>
        {isOpen ? (
          <m.span
            id={tooltipId}
            role="region"
            aria-label="Live preview of the pricing page"
            className="pointer-events-auto absolute bottom-full left-1/2 z-50 hidden h-[12.5rem] w-[22.5rem] -translate-x-1/2 overflow-hidden rounded-xl shadow-[0_22px_55px_rgba(38,29,91,0.22)] md:block"
            onMouseEnter={() => setIsOpen(true)}
            onMouseLeave={() => setIsOpen(false)}
            onWheel={handlePreviewWheel}
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 4, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 440, damping: 32, mass: 0.5 }}
          >
            <iframe
              title="Live pricing page preview"
              src={previewUrl ?? url}
              ref={previewFrameRef}
              tabIndex={-1}
              className="absolute left-0 top-0 h-[44rem] w-[75rem] origin-top-left scale-[0.3] border-0"
            />
            <a href={url} tabIndex={-1} aria-label="Open the pricing page" className="absolute inset-0 z-10" />
          </m.span>
        ) : null}
      </AnimatePresence>
    </span>
  );
}
