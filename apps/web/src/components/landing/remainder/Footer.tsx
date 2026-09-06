"use client";

import type { ReactNode } from "react";
import { FinalCtaAndFooter } from "./Sections";

type FooterProps = {
  children: ReactNode;
  footerClassName?: string;
};

export default function Footer({ children, footerClassName = "" }: FooterProps) {
  return (
    <div className="relative z-30 isolate bg-[#111318]">
      <div className="relative z-10">{children}</div>
      <div className={`sticky bottom-0 z-0 ${footerClassName}`}>
        <FinalCtaAndFooter navbarDark />
      </div>
    </div>
  );
}
