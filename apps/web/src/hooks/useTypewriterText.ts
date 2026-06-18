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

  onCompleteRef.current = onComplete;

  useEffect(() => {
    const clearTimer = () => {
      if (timerRef.current !== undefined) {
        window.clearInterval(timerRef.current);
        timerRef.current = undefined;
      }
    };

    if (showImmediately) {
      clearTimer();
      prevTargetRef.current = targetText;
      completedTargetRef.current = targetText;
      setText(targetText);
      setIsComplete(targetText.length > 0);
      return clearTimer;
    }

    if (!enabled) {
      clearTimer();
      setText("");
      setIsComplete(false);
      completedTargetRef.current = null;
      return clearTimer;
    }

    if (!targetText) {
      clearTimer();
      prevTargetRef.current = targetText;
      completedTargetRef.current = null;
      setText("");
      setIsComplete(false);
      return clearTimer;
    }

    if (
      targetText === prevTargetRef.current &&
      completedTargetRef.current === targetText
    ) {
      return clearTimer;
    }

    prevTargetRef.current = targetText;
    completedTargetRef.current = null;
    clearTimer();
    setText("");
    setIsComplete(false);

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

    return clearTimer;
  }, [targetText, speedMs, enabled, showImmediately]);

  return { text, isComplete };
}

export function useSequentialChannelPopIn(
  channels: string[],
  options: {
    enabled?: boolean;
    showImmediately?: boolean;
    staggerMs?: number;
    onComplete?: () => void;
  } = {},
): string[] {
  const enabled = options.enabled ?? true;
  const showImmediately = options.showImmediately ?? false;
  const staggerMs = options.staggerMs ?? 80;
  const onComplete = options.onComplete;

  const [visibleChannels, setVisibleChannels] = useState<string[]>(() =>
    showImmediately && channels.length > 0 ? [...channels] : [],
  );
  const timersRef = useRef<number[]>([]);
  const onCompleteRef = useRef(onComplete);
  const completedKeyRef = useRef<string | null>(null);

  onCompleteRef.current = onComplete;

  useEffect(() => {
    const clearTimers = () => {
      timersRef.current.forEach((timer) => window.clearTimeout(timer));
      timersRef.current = [];
    };

    const key = channels.join("\0");

    if (showImmediately) {
      clearTimers();
      completedKeyRef.current = key;
      setVisibleChannels(channels.length > 0 ? [...channels] : []);
      return clearTimers;
    }

    if (!enabled) {
      clearTimers();
      completedKeyRef.current = null;
      setVisibleChannels([]);
      return clearTimers;
    }

    if (!channels.length) {
      clearTimers();
      completedKeyRef.current = null;
      setVisibleChannels([]);
      return clearTimers;
    }

    if (completedKeyRef.current === key) {
      return clearTimers;
    }

    completedKeyRef.current = null;
    clearTimers();
    setVisibleChannels([]);

    channels.forEach((channel, index) => {
      const revealTimer = window.setTimeout(() => {
        setVisibleChannels((current) =>
          current.includes(channel) ? current : [...current, channel],
        );

        if (index === channels.length - 1) {
          const completeTimer = window.setTimeout(() => {
            completedKeyRef.current = key;
            onCompleteRef.current?.();
          }, 300);
          timersRef.current.push(completeTimer);
        }
      }, index * staggerMs);
      timersRef.current.push(revealTimer);
    });

    return clearTimers;
  }, [channels, enabled, showImmediately, staggerMs]);

  return visibleChannels;
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
