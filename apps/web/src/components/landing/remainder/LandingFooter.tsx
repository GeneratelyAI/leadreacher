"use client";

import type { ReactNode } from "react";
import { FinalCtaAndFooter } from "./LandingSections";

type LandingFooterProps = {
  children: ReactNode;
  footerClassName?: string;
};

export default function LandingFooter({ children, footerClassName = "" }: LandingFooterProps) {
  return (
    <div className="relative z-30 isolate bg-[#111318]">
      <div className="relative z-10">{children}</div>
      <div className={`relative z-0 md:sticky md:bottom-0 ${footerClassName}`}>
        <FinalCtaAndFooter navbarDark />
      </div>
    </div>
  );
}
