"use client";

import { useEffect } from "react";

export type PageSurfaceKind = "auth" | "discovery";

type SurfaceProps = {
  surface: PageSurfaceKind;
};

export default function Surface({ surface }: SurfaceProps) {
  useEffect(() => {
    document.documentElement.dataset.page = surface;

    return () => {
      delete document.documentElement.dataset.page;
    };
  }, [surface]);

  return null;
}
