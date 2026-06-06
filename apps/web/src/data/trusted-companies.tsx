import type { ReactNode } from "react";

export type TrustedCompany = {
  label: string;
  icon: ReactNode;
};

export const TRUSTED_COMPANIES: TrustedCompany[] = [
  {
    label: "ACME",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2L22 20H2L12 2z" />
      </svg>
    ),
  },
  {
    label: "growthwise",
    icon: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v10M7 12h10" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: "momentum",
    icon: <span className="text-lg font-bold">m</span>,
  },
  {
    label: "SaaS-Drive",
    icon: (
      <span className="rounded border border-current px-1 text-xs font-bold">
        S
      </span>
    ),
  },
];
