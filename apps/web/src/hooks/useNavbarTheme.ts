"use client";

import { useEffect, useRef, useState } from "react";

export function useNavbarTheme() {
  const [isDark, setIsDark] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const previousScrollY = useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const probeY = 88;
      const themedSection = Array.from(
        document.querySelectorAll<HTMLElement>("[data-navbar-theme]"),
      )
        .map((section, index) => ({
          section,
          index,
          bounds: section.getBoundingClientRect(),
        }))
        .filter(({ bounds }) => bounds.top <= probeY && bounds.bottom > probeY)
        // Landing blocks may contain a nested, differently themed experience.
        // Prefer the smallest matching region so that inner dark stories take
        // precedence over their light page-level parent section.
        .sort(
          (left, right) =>
            left.bounds.height - right.bounds.height || right.index - left.index,
        )[0]?.section;

      setIsDark(themedSection?.dataset.navbarTheme === "dark");
      setScrollProgress(Math.min(Math.max(currentScrollY / 180, 0), 1));

      const delta = currentScrollY - previousScrollY.current;
      if (currentScrollY <= 24) {
        setIsVisible(true);
      } else if (Math.abs(delta) >= 6) {
        setIsVisible(delta < 0);
      }
      previousScrollY.current = currentScrollY;
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  return { isDark, scrollProgress, isVisible };
}
