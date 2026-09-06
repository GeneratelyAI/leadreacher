"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

function ViewportFittedPane({
  children,
  fitViewport,
}: {
  children: ReactNode;
  fitViewport: boolean;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const frame = frameRef.current;
    const canvas = canvasRef.current;
    if (!frame || !canvas) return;

    if (!fitViewport) {
      canvas.style.setProperty("--onboarding-fit-scale", "1");
      canvas.style.setProperty("--onboarding-fit-inverse", "1");
      canvas.style.width = "100%";
      canvas.style.transform = "none";
      return;
    }

    let animationFrame = 0;
    let currentScale = 1;

    const applyScale = (scale: number) => {
      currentScale = scale;
      canvas.style.setProperty("--onboarding-fit-scale", String(scale));
      canvas.style.setProperty("--onboarding-fit-inverse", String(1 / scale));
      canvas.style.width = `${100 / scale}%`;
      canvas.style.transform = `scale(${scale})`;
    };

    const fit = (reset = false) => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(() => {
        const availableWidth = frame.clientWidth;
        const availableHeight = frame.clientHeight;
        if (!availableWidth || !availableHeight) return;

        if (reset) {
          currentScale = 1;
          canvas.style.setProperty("--onboarding-fit-inverse", "1");
          canvas.style.width = "100%";
          canvas.style.transform = "none";
        }

        const contentWidth = Math.max(canvas.scrollWidth, canvas.offsetWidth);
        const contentHeight = Math.max(canvas.scrollHeight, canvas.offsetHeight);
        const nextScale = Math.min(
          1,
          availableWidth / contentWidth,
          availableHeight / contentHeight,
        );

        if (reset || nextScale < currentScale - 0.002) {
          applyScale(nextScale);
        }
      });
    };

    const frameResizeObserver = new ResizeObserver(() => fit(true));
    const contentResizeObserver = new ResizeObserver(() => fit());
    frameResizeObserver.observe(frame);
    contentResizeObserver.observe(canvas);
    fit(true);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      frameResizeObserver.disconnect();
      contentResizeObserver.disconnect();
    };
  }, [children, fitViewport]);

  return (
    <div
      ref={frameRef}
      className={cn(
        "onboarding-viewport-fit",
        !fitViewport && "onboarding-viewport-fit--scroll",
      )}
    >
      <div ref={canvasRef} className="onboarding-viewport-fit__canvas">
        {children}
      </div>
    </div>
  );
}

export function StepMotion({
  transitionKey,
  children,
  className,
  fitViewport = true,
}: {
  transitionKey: string;
  children: ReactNode;
  className?: string;
  fitViewport?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const previousKey = useRef(transitionKey);
  const headingAnchor = useRef<{ text: string; top: number } | null>(null);

  useLayoutEffect(() => {
    const changed = previousKey.current !== transitionKey;
    previousKey.current = transitionKey;
    const container = containerRef.current;
    if (!container) return;

    const heading = container.querySelector<HTMLElement>("h1, [data-onboarding-focus]");
    if (heading) {
      const text = heading.textContent ?? "";
      if (changed && headingAnchor.current?.text === text) {
        const delta = headingAnchor.current.top - heading.getBoundingClientRect().top;
        heading.style.translate = `0 ${delta}px`;
      }
      headingAnchor.current = { text, top: heading.getBoundingClientRect().top };
    }
    if (!changed) return;
    if (heading && (document.activeElement === document.body || container.contains(document.activeElement))) {
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const animations = Array.from(container.querySelectorAll<HTMLElement>(
      ".campaign-content-options, .personalized-video-style-status, .personalized-video-style-options, .how-it-works-campaign-cards, .onboarding-campaign-profile, .onboarding-campaign-context, .upload-your-video-section, .onboarding-video-content, .onboarding-connect-card",
    )).map((element) => element.animate(
      [{ opacity: 0 }, { opacity: 1 }],
      { duration: 450, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
    ));
    return () => animations.forEach((animation) => animation.cancel());
  }, [transitionKey]);

  return (
    <div ref={containerRef} className={cn("onboarding-step-presence onboarding-continuous-scene", className)}>
      <div className="onboarding-step-presence__pane">
        <ViewportFittedPane fitViewport={fitViewport}>{children}</ViewportFittedPane>
      </div>
    </div>
  );
}
