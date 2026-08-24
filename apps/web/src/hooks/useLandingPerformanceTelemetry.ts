"use client";

import { useEffect } from "react";

const LCP_WARNING_MS = 2_500;
const LONG_TASK_WARNING_MS = 250;
const TELEMETRY_SAMPLE_RATE = 0.1;

/** Reports only slow production landing sessions without adding Sentry to the critical bundle. */
export function useLandingPerformanceTelemetry() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || Math.random() > TELEMETRY_SAMPLE_RATE) return;

    let largestContentfulPaint = 0;
    let longTaskDuration = 0;
    let longTaskCount = 0;
    let finalized = false;

    const observe = (type: "largest-contentful-paint" | "longtask", onEntry: (entry: PerformanceEntry) => void) => {
      if (!("PerformanceObserver" in window)) return undefined;

      try {
        const observer = new PerformanceObserver((entries) => {
          entries.getEntries().forEach(onEntry);
        });
        observer.observe({ type, buffered: true });
        return observer;
      } catch {
        return undefined;
      }
    };

    const lcpObserver = observe("largest-contentful-paint", (entry) => {
      largestContentfulPaint = Math.max(largestContentfulPaint, entry.startTime);
    });
    const longTaskObserver = observe("longtask", (entry) => {
      longTaskDuration += entry.duration;
      longTaskCount += 1;
    });

    const finalize = (force = false) => {
      if (finalized || (!force && document.visibilityState !== "hidden")) return;
      finalized = true;
      lcpObserver?.disconnect();
      longTaskObserver?.disconnect();

      if (largestContentfulPaint < LCP_WARNING_MS && longTaskDuration < LONG_TASK_WARNING_MS) return;

      void import("@sentry/nextjs").then(({ captureMessage }) => {
        captureMessage("Landing performance budget exceeded", {
          level: "warning",
          tags: { surface: "landing" },
          extra: {
            largestContentfulPaintMs: Math.round(largestContentfulPaint),
            longTaskDurationMs: Math.round(longTaskDuration),
            longTaskCount,
          },
        });
      });
    };

    const handlePageHide = () => finalize(true);
    const handleVisibilityChange = () => finalize();

    window.addEventListener("pagehide", handlePageHide);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      lcpObserver?.disconnect();
      longTaskObserver?.disconnect();
      window.removeEventListener("pagehide", handlePageHide);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);
}
