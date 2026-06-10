"use client";

import { useEffect, useState } from "react";

const DARK_SECTION_OFFSET = 600;
const LIGHT_SECTION_OFFSET = 520;

export function useNavbarTheme() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;

      setIsDark((prev) => {
        if (scrollY >= DARK_SECTION_OFFSET) return true;
        if (scrollY < LIGHT_SECTION_OFFSET) return false;
        return prev;
      });
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  return { isDark };
}
