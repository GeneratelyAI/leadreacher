"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import {
  getOnboardingStepIndex,
  isOnboardingStep,
  isStrategySubstep,
  STRATEGY_SUBSTEPS,
} from "@/components/onboarding/steps/steps";
import { cn } from "@/lib/utils";

const STEP_TRANSITION_MS = 520;

type SlideDirection = "forward" | "backward";
type RenderedStep = {
  key: string;
  children: ReactNode;
};

function ViewportFittedPane({ children }: { children: ReactNode }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const frame = frameRef.current;
    const canvas = canvasRef.current;
    if (!frame || !canvas) return;

    let animationFrame = 0;
    let currentScale = 1;

    const applyScale = (scale: number) => {
      currentScale = scale;
      canvas.style.setProperty("--onboarding-fit-scale", String(scale));
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
  }, [children]);

  return (
    <div ref={frameRef} className="onboarding-viewport-fit">
      <div ref={canvasRef} className="onboarding-viewport-fit__canvas">
        {children}
      </div>
    </div>
  );
}

export function getSlideDirection(currentKey: string, nextKey: string): SlideDirection {
  const flowOrder = [
    "discovery",
    "strategy:how-it-works",
    "strategy:targeting",
    "strategy:channels",
    "campaign-type",
    "video-decision",
    "checkout",
    "channels",
  ];
  const currentFlowIndex = flowOrder.indexOf(currentKey);
  const nextFlowIndex = flowOrder.indexOf(nextKey);
  if (currentFlowIndex >= 0 && nextFlowIndex >= 0) {
    return nextFlowIndex > currentFlowIndex ? "forward" : "backward";
  }

  if (isOnboardingStep(currentKey) && isOnboardingStep(nextKey)) {
    return getOnboardingStepIndex(nextKey) > getOnboardingStepIndex(currentKey)
      ? "forward"
      : "backward";
  }

  if (isStrategySubstep(currentKey) && isStrategySubstep(nextKey)) {
    return STRATEGY_SUBSTEPS.indexOf(nextKey) > STRATEGY_SUBSTEPS.indexOf(currentKey)
      ? "forward"
      : "backward";
  }

  return "forward";
}

export function StepMotion({
  transitionKey,
  children,
  className,
}: {
  transitionKey: string;
  children: ReactNode;
  className?: string;
}) {
  const [current, setCurrent] = useState<RenderedStep>({ key: transitionKey, children });
  const [incoming, setIncoming] = useState<RenderedStep | null>(null);
  const [direction, setDirection] = useState<SlideDirection>("forward");
  const [isAnimating, setIsAnimating] = useState(false);
  const currentRef = useRef(current);
  const latestRef = useRef<RenderedStep>({ key: transitionKey, children });
  const containerRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef(false);
  const animationFrameRef = useRef<number | null>(null);
  const transitionTimerRef = useRef<number | null>(null);

  const isTransitioning = incoming !== null;

  useEffect(() => {
    latestRef.current = { key: transitionKey, children };
  }, [children, transitionKey]);

  useEffect(() => {
    function clearScheduledTransition() {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      if (transitionTimerRef.current !== null) {
        window.clearTimeout(transitionTimerRef.current);
        transitionTimerRef.current = null;
      }
    }

    const next = latestRef.current;
    if (next.key === currentRef.current.key) return clearScheduledTransition;

    clearScheduledTransition();
    setDirection(getSlideDirection(currentRef.current.key, next.key));
    restoreFocusRef.current = Boolean(
      containerRef.current?.querySelector(
        ".onboarding-step-presence__pane--outgoing",
      )?.contains(document.activeElement),
    );

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      currentRef.current = next;
      setCurrent(next);
      setIncoming(null);
      setIsAnimating(false);
      return clearScheduledTransition;
    }

    setIncoming(next);
    setIsAnimating(false);
    animationFrameRef.current = window.requestAnimationFrame(() => {
      setIsAnimating(true);
      animationFrameRef.current = null;
    });
    transitionTimerRef.current = window.setTimeout(() => {
      currentRef.current = next;
      setCurrent(next);
      setIncoming(null);
      setIsAnimating(false);
      transitionTimerRef.current = null;
    }, STEP_TRANSITION_MS);

    return clearScheduledTransition;
  }, [transitionKey]);

  useEffect(() => {
    if (isTransitioning || !restoreFocusRef.current) return;

    const heading = containerRef.current?.querySelector<HTMLElement>(
      ".onboarding-step-presence__pane--outgoing h1, .onboarding-step-presence__pane--outgoing [data-onboarding-focus]",
    );
    restoreFocusRef.current = false;
    if (!heading) return;

    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
  }, [current.key, isTransitioning]);

  const visibleChildren = current.key === transitionKey && !isTransitioning ? children : current.children;

  return (
    <div
      ref={containerRef}
      className={cn(
        "onboarding-step-presence",
        isTransitioning && "onboarding-step-presence--transitioning",
        `onboarding-step-presence--${direction}`,
        isAnimating && "onboarding-step-presence--active",
        className,
      )}
    >
      <div
        key={current.key}
        className="onboarding-step-presence__pane onboarding-step-presence__pane--outgoing"
        aria-hidden={isTransitioning}
        inert={isTransitioning}
      >
        <ViewportFittedPane>{visibleChildren}</ViewportFittedPane>
      </div>
      {incoming ? (
        <div
          key={incoming.key}
          className="onboarding-step-presence__pane onboarding-step-presence__pane--incoming"
          inert={!isAnimating}
        >
          <ViewportFittedPane>{incoming.children}</ViewportFittedPane>
        </div>
      ) : null}
    </div>
  );
}
