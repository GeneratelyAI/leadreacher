"use client";

import type { ReactNode } from "react";
import { FinalCtaAndFooter } from "./LandingRemainder";

type StickyLandingFooterProps = {
  children: ReactNode;
};

export default function StickyLandingFooter({ children }: StickyLandingFooterProps) {
  return (
    <div className="relative z-30 isolate bg-[#111318]">
      <div className="relative z-10">{children}</div>
      <div className="relative z-0 md:sticky md:bottom-0">
        <FinalCtaAndFooter navbarDark />
      </div>
    </div>
  );
}
