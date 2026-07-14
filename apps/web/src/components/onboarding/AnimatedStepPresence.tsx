"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  getOnboardingStepIndex,
  isOnboardingStep,
  isStrategySubstep,
  STRATEGY_SUBSTEPS,
} from "@/components/onboarding/steps/steps";
import { cn } from "@/lib/utils";

const STEP_TRANSITION_MS = 500;

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

export function AnimatedStepPresence({
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
  const animationFrameRef = useRef<number | null>(null);
  const transitionTimerRef = useRef<number | null>(null);

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

  const isTransitioning = incoming !== null;
  const visibleChildren = current.key === transitionKey && !isTransitioning ? children : current.children;

  return (
    <div
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
      >
        {visibleChildren}
      </div>
      {incoming ? (
        <div
          key={incoming.key}
          className="onboarding-step-presence__pane onboarding-step-presence__pane--incoming"
        >
          {incoming.children}
        </div>
      ) : null}
    </div>
  );
}
