"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => Promise<void>) => { finished: Promise<void> };
};

function isLandingPricingTransition(from: string, to: string) {
  return (from === "/" && to === "/pricing") || (from === "/pricing" && to === "/");
}

export default function RouteTransition() {
  const pathname = usePathname();
  const router = useRouter();
  const pendingPathRef = useRef<string | null>(null);
  const resolveNavigationRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    router.prefetch(pathname === "/" ? "/pricing" : "/");
  }, [pathname, router]);

  useEffect(() => {
    if (pathname !== pendingPathRef.current) return;
    resolveNavigationRef.current?.();
    resolveNavigationRef.current = null;
    pendingPathRef.current = null;
  }, [pathname]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        pendingPathRef.current
      ) {
        return;
      }

      const anchor = (event.target as Element | null)?.closest<HTMLAnchorElement>("a[href]");
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;

      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin || !isLandingPricingTransition(pathname, url.pathname)) return;

      const documentWithTransitions = document as ViewTransitionDocument;
      if (!documentWithTransitions.startViewTransition || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        return;
      }

      event.preventDefault();
      const directionClass = pathname === "/" ? "route-transition-forward" : "route-transition-backward";
      document.documentElement.classList.add(directionClass);
      pendingPathRef.current = url.pathname;

      const transition = documentWithTransitions.startViewTransition(async () => {
        const navigationComplete = new Promise<void>((resolve) => {
          resolveNavigationRef.current = resolve;
        });
        router.push(`${url.pathname}${url.search}${url.hash}`);
        await navigationComplete;
      });

      void transition.finished.finally(() => {
        document.documentElement.classList.remove(directionClass);
        resolveNavigationRef.current = null;
        pendingPathRef.current = null;
      });
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [pathname, router]);

  return null;
}
