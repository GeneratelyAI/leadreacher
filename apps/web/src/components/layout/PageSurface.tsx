"use client";

import { useEffect } from "react";

export type PageSurfaceKind = "auth" | "discovery";

type PageSurfaceProps = {
  surface: PageSurfaceKind;
};

export default function PageSurface({ surface }: PageSurfaceProps) {
  useEffect(() => {
    document.documentElement.dataset.page = surface;

    return () => {
      delete document.documentElement.dataset.page;
    };
  }, [surface]);

  return null;
}
