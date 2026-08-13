"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  getOnboardingStepIndex,
  isOnboardingStep,
  isStrategySubstep,
  STRATEGY_SUBSTEPS,
} from "@/components/onboarding/steps/steps";
import { cn } from "@/lib/utils";

const STEP_TRANSITION_MS = 160;

type SlideDirection = "forward" | "backward";
type RenderedStep = {
  key: string;
  children: ReactNode;
};

export function getSlideDirection(currentKey: string, nextKey: string): SlideDirection {
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
        {visibleChildren}
      </div>
      {incoming ? (
        <div
          key={incoming.key}
          className="onboarding-step-presence__pane onboarding-step-presence__pane--incoming"
          inert={!isAnimating}
        >
          {incoming.children}
        </div>
      ) : null}
    </div>
  );
}
