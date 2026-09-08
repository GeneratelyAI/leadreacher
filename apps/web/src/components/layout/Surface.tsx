"use client";

import { useLayoutEffect } from "react";
import { applyStoredTheme } from "@/hooks/useThemeMode";

export type PageSurfaceKind = "auth" | "discovery";

type SurfaceProps = {
  surface: PageSurfaceKind;
};

export default function Surface({ surface }: SurfaceProps) {
  useLayoutEffect(() => {
    document.documentElement.dataset.page = surface;
    applyStoredTheme();

    return () => {
      delete document.documentElement.dataset.page;
      applyStoredTheme();
    };
  }, [surface]);

  return null;
}
