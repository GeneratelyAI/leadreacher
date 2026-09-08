"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import { useOnboardingSceneMotion } from "@/components/onboarding/OnboardingTransitionController";
import { cn } from "@/lib/utils";

function ViewportFittedPane({
  children,
  fitViewport,
  contentKey,
}: {
  children: ReactNode;
  fitViewport: boolean;
  contentKey: string;
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
    const mobileQuery = window.matchMedia("(max-width: 63rem)");

    const applyScale = (scale: number) => {
      currentScale = scale;
      canvas.style.setProperty("--onboarding-fit-scale", String(scale));
      canvas.style.setProperty("--onboarding-fit-inverse", String(1 / scale));
      canvas.style.width = `${100 / scale}%`;
      canvas.style.transform = `scale(${scale})`;
    };

    const fit = (reset = false, immediately = false) => {
      window.cancelAnimationFrame(animationFrame);
      const measure = () => {
        if (mobileQuery.matches) return;
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
      };
      if (immediately) {
        measure();
      } else {
        animationFrame = window.requestAnimationFrame(measure);
      }
    };

    const frameResizeObserver = new ResizeObserver(() => fit(true));
    const contentResizeObserver = new ResizeObserver(() => fit());
    const syncViewportMode = () => {
      window.cancelAnimationFrame(animationFrame);
      frameResizeObserver.disconnect();
      contentResizeObserver.disconnect();
      if (mobileQuery.matches) {
        applyScale(1);
        canvas.style.transform = "none";
        return;
      }
      frameResizeObserver.observe(frame);
      contentResizeObserver.observe(canvas);
      // Fit desktop before paint. Mobile stays in document flow and is never measured.
      fit(true, true);
    };
    syncViewportMode();
    mobileQuery.addEventListener("change", syncViewportMode);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      frameResizeObserver.disconnect();
      contentResizeObserver.disconnect();
      mobileQuery.removeEventListener("change", syncViewportMode);
    };
  }, [contentKey, fitViewport]);

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
  const sceneMotion = useOnboardingSceneMotion();

  useLayoutEffect(() => {
    const changed = previousKey.current !== transitionKey;
    previousKey.current = transitionKey;
    const container = containerRef.current;
    if (!container) return;

    const heading = Array.from(container.querySelectorAll<HTMLElement>("h1, [data-onboarding-focus]")).find((node) => node.offsetWidth > 0 && node.offsetHeight > 0);
    if (!changed) return;
    if (heading && (document.activeElement === document.body || container.contains(document.activeElement))) {
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    }
  }, [transitionKey]);

  return (
    <div
      ref={containerRef}
      className={cn("onboarding-step-presence onboarding-continuous-scene", className)}
      data-scene-direction={sceneMotion.direction}
      data-scene-phase={sceneMotion.phase}
    >
      <div className="onboarding-step-presence__pane">
        <ViewportFittedPane fitViewport={fitViewport} contentKey={transitionKey}>{children}</ViewportFittedPane>
      </div>
    </div>
  );
}
