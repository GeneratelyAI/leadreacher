import type { ReactNode } from "react";
import StatsBarGlassCard from "./StatsBarGlassCard";

type StatItem = {
  value: string;
  label: string;
  icon: ReactNode;
};

type LogoItem = {
  label: string;
  icon: ReactNode;
};

function UsersIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function MessageSquareIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      <path d="M8 10h8M8 14h5" />
    </svg>
  );
}

function TrendingUpIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </svg>
  );
}

const STATS: StatItem[] = [
  {
    value: "2.4M+",
    label: "Outreach impressions",
    icon: <UsersIcon />,
  },
  {
    value: "12K+",
    label: "Conversations generated",
    icon: <MessageSquareIcon />,
  },
  {
    value: "38%",
    label: "Avg reply lift",
    icon: <TrendingUpIcon />,
  },
];

const LOGO_CLOUD: LogoItem[] = [
  {
    label: "ACME",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M12 2L22 20H2L12 2z" />
      </svg>
    ),
  },
  {
    label: "growthwise",
    icon: (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden
      >
        <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    label: "momentum",
    icon: (
      <span className="grid grid-cols-3 gap-1" aria-hidden>
        {Array.from({ length: 6 }).map((_, i) => (
          <span key={i} className="h-1.5 w-1.5 rounded-full bg-current" />
        ))}
      </span>
    ),
  },
  {
    label: "SaaSDrive",
    icon: (
      <span className="text-lg font-bold" aria-hidden>
        S
      </span>
    ),
  },
  {
    label: "Elevate",
    icon: (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden
      >
        <path d="M4 14c2-4 6-6 8-6s6 2 8 6" strokeLinecap="round" />
        <path d="M4 10c2-4 6-6 8-6s6 2 8 6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: "Pioneer",
    icon: (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden
      >
        <circle cx="8" cy="8" r="4" />
        <path d="M12 12l8 8" strokeLinecap="round" />
        <path d="M16 16l4 4" strokeLinecap="round" />
      </svg>
    ),
  },
];

function StatCard({ stat }: { stat: StatItem }) {
  return (
    <div className="flex min-w-0 flex-1 items-center justify-center gap-3 py-4 first:pt-0 last:pb-0 sm:gap-4 sm:px-6 sm:py-0">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/40 bg-white/15 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] backdrop-blur-sm sm:h-12 sm:w-12">
        {stat.icon}
      </div>
      <div className="text-left">
        <p className="text-xl font-bold leading-none text-white sm:text-2xl">
          {stat.value}
        </p>
        <p className="mt-1.5 text-xs leading-snug text-white/80 sm:text-sm">
          {stat.label}
        </p>
      </div>
    </div>
  );
}

function LogoStripItem({ logo }: { logo: LogoItem }) {
  return (
    <div className="flex shrink-0 items-center gap-4 px-10 text-lg font-semibold text-white/95 sm:text-xl">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center sm:h-7 sm:w-7">
        {logo.icon}
      </span>
      <span className="whitespace-nowrap">{logo.label}</span>
    </div>
  );
}

function LogoMarquee() {
  return (
    <div className="stats-logo-marquee-mask mt-4 w-full overflow-hidden sm:mt-5">
      <div className="animate-marquee flex w-max flex-row flex-nowrap">
        {LOGO_CLOUD.map((logo) => (
          <LogoStripItem key={`set1-${logo.label}`} logo={logo} />
        ))}
        {LOGO_CLOUD.map((logo) => (
          <LogoStripItem key={`set2-${logo.label}`} logo={logo} />
        ))}
      </div>
    </div>
  );
}

export default function StatsBar() {
  return (
    <section
      aria-label="Platform statistics and trusted companies"
      className="mx-auto w-full"
    >
      <div className="w-full">
        <StatsBarGlassCard>
          <div className="flex flex-col gap-0 px-4 py-5 sm:px-8 sm:py-6 lg:px-10">
            <div className="flex flex-col divide-y divide-white/25 sm:flex-row sm:divide-x sm:divide-y-0">
              {STATS.map((stat) => (
                <StatCard key={stat.label} stat={stat} />
              ))}
            </div>

            <div className="my-5 h-px w-full bg-white/25 sm:my-6" aria-hidden />

            <div className="text-center">
              <p className="text-xs font-medium text-white/85 sm:text-sm">
                Trusted by founders and growth teams
              </p>
              <LogoMarquee />
            </div>
          </div>
        </StatsBarGlassCard>
      </div>
    </section>
  );
}
