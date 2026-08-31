"use client";

import { useId, type AnchorHTMLAttributes, type ReactNode } from "react";

type LinkPreviewProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "children" | "href"> & {
  children: ReactNode;
  url: string;
};

export function LinkPreview({ children, className, url, ...props }: LinkPreviewProps) {
  const tooltipId = useId();

  return (
    <span className="group relative inline-block">
      <a
        href={url}
        className={className}
        aria-describedby={tooltipId}
        {...props}
      >
        {children}
      </a>

      <span
        id={tooltipId}
        role="region"
        aria-label="Preview of the LeadReacher pricing page"
        className="pointer-events-auto invisible absolute bottom-full left-1/2 z-50 mb-3 hidden h-[13.75rem] w-[22.5rem] -translate-x-1/2 translate-y-2 scale-[0.96] overflow-hidden rounded-xl border border-[#d8ceff] bg-white text-left opacity-0 shadow-[0_22px_55px_rgba(38,29,91,0.22)] transition-[opacity,transform,visibility] duration-200 group-hover:visible group-hover:translate-y-0 group-hover:scale-100 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:scale-100 group-focus-within:opacity-100 motion-reduce:transform-none md:block"
      >
        <iframe
          title="LeadReacher pricing page preview"
          src={url}
          tabIndex={-1}
          loading="lazy"
          className="absolute left-0 top-0 h-[45.8rem] w-[75rem] origin-top-left scale-[0.3] border-0 bg-white"
        />
        <span aria-hidden className="absolute -bottom-1.5 left-1/2 size-3 -translate-x-1/2 rotate-45 border-b border-r border-[#d8ceff] bg-white" />
      </span>
    </span>
  );
}
