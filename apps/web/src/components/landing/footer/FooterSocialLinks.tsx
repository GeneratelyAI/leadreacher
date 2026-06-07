import type { ReactNode } from "react";
import { FOOTER_SOCIAL_LINKS } from "@/lib/constants/brand";

const SOCIAL_ICON_CLASS = "h-4 w-4";

const SOCIAL_ICONS: Record<(typeof FOOTER_SOCIAL_LINKS)[number]["label"], ReactNode> =
  {
    LinkedIn: (
      <svg aria-hidden className={SOCIAL_ICON_CLASS} viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 114.126 0 2.063 2.063 0 01-2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
    ),
    Instagram: (
      <svg
        aria-hidden
        className={SOCIAL_ICON_CLASS}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <rect x="2" y="2" width="20" height="20" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
      </svg>
    ),
    X: (
      <svg aria-hidden className={SOCIAL_ICON_CLASS} viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  };

export default function FooterSocialLinks() {
  return (
    <div className="flex items-center gap-3">
      {FOOTER_SOCIAL_LINKS.map(({ label, href }) => (
        <a
          key={label}
          href={href}
          aria-label={label}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-brand-purple shadow-[0_2px_14px_rgba(83,38,183,0.14)] transition-all hover:-translate-y-0.5 hover:shadow-[0_4px_18px_rgba(83,38,183,0.22)]"
        >
          {SOCIAL_ICONS[label]}
        </a>
      ))}
    </div>
  );
}
