"use client";

import { LazyMotion } from "framer-motion";
import type { ReactNode } from "react";

const loadMotionFeatures = () =>
  import("@/lib/landing-motion-features").then((module) => module.default);

export function LandingMotionProvider({ children }: { children: ReactNode }) {
  return <LazyMotion features={loadMotionFeatures}>{children}</LazyMotion>;
}
