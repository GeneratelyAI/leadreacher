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
      // Fixed footer content can geometrically overlap the viewport while a
      // white foreground section is still painted over it. Resolve the theme
      // from the element the user can actually see behind the navbar instead.
      const themedSection = document
        .elementsFromPoint(window.innerWidth / 2, probeY)
        .map((element) => element.closest<HTMLElement>("[data-navbar-theme]"))
        .find((section): section is HTMLElement => section !== null);

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
