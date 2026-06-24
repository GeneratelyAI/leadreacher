"use client";

import { useEffect, useRef, useState } from "react";

type TypewriterOptions = {
  enabled?: boolean;
  showImmediately?: boolean;
  onComplete?: () => void;
};

export function useTypewriterText(
  targetText: string,
  speedMs: number,
  options: TypewriterOptions = {},
): { text: string; isComplete: boolean } {
  const enabled = options.enabled ?? true;
  const showImmediately = options.showImmediately ?? false;
  const onComplete = options.onComplete;

  const [text, setText] = useState(showImmediately ? targetText : "");
  const [isComplete, setIsComplete] = useState(
    showImmediately && targetText.length > 0,
  );
  const timerRef = useRef<number | undefined>(undefined);
  const prevTargetRef = useRef(targetText);
  const onCompleteRef = useRef(onComplete);
  const completedTargetRef = useRef<string | null>(null);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    const clearTimer = () => {
      if (timerRef.current !== undefined) {
        window.clearInterval(timerRef.current);
        timerRef.current = undefined;
      }
    };
    let resetTimer: number | undefined;
    const scheduleState = (update: () => void) => {
      resetTimer = window.setTimeout(update, 0);
    };
    const clearTimers = () => {
      clearTimer();
      if (resetTimer !== undefined) {
        window.clearTimeout(resetTimer);
      }
    };

    if (showImmediately) {
      clearTimer();
      prevTargetRef.current = targetText;
      completedTargetRef.current = targetText;
      scheduleState(() => {
        setText(targetText);
        setIsComplete(targetText.length > 0);
      });
      return clearTimers;
    }

    if (!enabled) {
      clearTimer();
      completedTargetRef.current = null;
      scheduleState(() => {
        setText("");
        setIsComplete(false);
      });
      return clearTimers;
    }

    if (!targetText) {
      clearTimer();
      prevTargetRef.current = targetText;
      completedTargetRef.current = null;
      scheduleState(() => {
        setText("");
        setIsComplete(false);
      });
      return clearTimers;
    }

    if (
      targetText === prevTargetRef.current &&
      completedTargetRef.current === targetText
    ) {
      return clearTimers;
    }

    prevTargetRef.current = targetText;
    completedTargetRef.current = null;
    clearTimer();
    scheduleState(() => {
      setText("");
      setIsComplete(false);
    });

    let index = 0;
    timerRef.current = window.setInterval(() => {
      index += 1;
      const nextText = targetText.slice(0, index);
      setText(nextText);

      if (index >= targetText.length) {
        clearTimer();
        completedTargetRef.current = targetText;
        setIsComplete(true);
        onCompleteRef.current?.();
      }
    }, speedMs);

    return clearTimers;
  }, [targetText, speedMs, enabled, showImmediately]);

  return { text, isComplete };
}

export function useAnimatedHeight<T extends HTMLElement>(watchKey?: unknown) {
  const innerRef = useRef<T | null>(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const element = innerRef.current;
    if (!element) {
      return;
    }

    const updateHeight = () => {
      setHeight(element.getBoundingClientRect().height);
    };

    updateHeight();

    const observer = new ResizeObserver(updateHeight);
    observer.observe(element);

    return () => observer.disconnect();
  }, [watchKey]);

  return { innerRef, height };
}
