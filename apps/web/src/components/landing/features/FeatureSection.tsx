import { Fragment } from "react";
import Image from "next/image";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { CircleCheckIcon } from "@/components/ui/CircleCheckIcon";
import { Logo } from "@/components/ui/Logo";
import { StarBadgeIcon } from "@/components/ui/StarBadgeIcon";
import { ASSETS, FEATURE_BENEFITS } from "@/lib/constants/brand";

function FeatureDecorativePath() {
  return (
    <div
      className="pointer-events-none absolute bottom-6 right-[8%] z-1 hidden h-40 w-56 md:block lg:right-[12%]"
      aria-hidden
    >
      <svg
        className="h-full w-full text-brand-purple/45"
        viewBox="0 0 200 120"
        fill="none"
      >
        <path
          d="M10 100 Q 60 110 100 70 T 180 20"
          stroke="currentColor"
          strokeWidth="2"
          strokeDasharray="4 6"
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute right-0 top-2 w-14">
        <Logo size="xs" align="right" className="w-full" />
      </div>
    </div>
  );
}

function FeatureGlowOrbs() {
  return (
    <>
      <div
        className="pointer-events-none absolute -right-32 top-1/4 h-[480px] w-[480px] rounded-full bg-brand-purple/15 blur-[100px]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute right-[10%] top-[45%] h-[320px] w-[320px] rounded-full bg-sky-300/25 blur-[90px]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-10 bottom-20 h-[280px] w-[380px] rounded-full bg-violet-300/20 blur-[80px]"
        aria-hidden
      />
    </>
  );
}

function BenefitList() {
  return (
    <div className="mt-8 flex flex-col gap-3 border-t border-white/15 pt-8 sm:mt-10 sm:flex-row sm:flex-wrap sm:items-center sm:gap-0 sm:border-t-0 sm:pt-0">
      {FEATURE_BENEFITS.map((benefit, index) => (
        <Fragment key={benefit}>
          {index > 0 ? (
            <span
              className="mx-4 hidden h-4 w-px bg-white/30 sm:inline-block"
              aria-hidden
            />
          ) : null}
          <div className="flex items-center gap-2 text-sm font-medium text-white">
            <CircleCheckIcon />
            <span>{benefit}</span>
          </div>
        </Fragment>
      ))}
    </div>
  );
}

function DashboardPreview() {
  return (
    <div className="relative flex justify-center lg:justify-end">
      <div
        className="pointer-events-none absolute inset-0 -z-10 scale-105 rounded-4xl bg-linear-to-br from-brand-purple/22 via-violet-200/30 to-sky-200/40 blur-2xl"
        aria-hidden
      />
      <div className="relative w-full max-w-[640px] lg:max-w-none">
        <div className="liquid-glass-frame overflow-hidden rounded-2xl sm:rounded-3xl">
          <Image
            src={ASSETS.dashboard}
            alt="leadreacher dashboard showing campaign stats, recent activity, and performance overview"
            width={1200}
            height={900}
            className="h-auto w-full object-cover"
            sizes="(max-width: 1024px) 100vw, 50vw"
            priority
          />
        </div>
      </div>
    </div>
  );
}

export default function FeatureSection() {
  return (
    <section className="feature-section-gradient relative -mt-px overflow-hidden pb-20 pt-2 text-neutral-900 sm:pb-24 sm:pt-4 lg:pb-28">
      <div
        className="feature-top-fade pointer-events-none absolute inset-x-0 top-0 z-1 h-24 backdrop-blur-md sm:h-28"
        aria-hidden
      />
      <div className="feature-bottom-blend" aria-hidden />
      <FeatureGlowOrbs />
      <FeatureDecorativePath />

      <div className="relative z-10 mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-10">
        <div className="grid items-center gap-12 pb-8 pt-6 sm:pt-8 lg:grid-cols-2 lg:gap-16 lg:pb-16 lg:pt-12">
          <div className="max-w-xl lg:justify-self-start">
            <div className="liquid-glass-pill mb-5 inline-flex items-center gap-2 px-3 py-1.5 text-white sm:mb-6">
              <StarBadgeIcon />
              <span className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] sm:text-xs">
                AI OUTREACH + VIDEO MESSAGING
              </span>
            </div>

            <h2 className="text-balance text-3xl font-bold leading-[1.15] tracking-tight text-white drop-shadow-[0_1px_12px_rgba(0,0,0,0.15)] sm:text-4xl lg:text-[2.65rem] lg:leading-[1.12]">
              Get qualified leads without chasing them.
            </h2>

            <p className="mt-4 text-pretty text-base leading-relaxed text-white/95 drop-shadow-[0_1px_10px_rgba(0,0,0,0.12)] sm:mt-5 sm:text-lg">
              AI outreach and video messaging that brings customers to you.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:mt-9 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
              <ButtonLink href="#" showArrow>
                Get Started
              </ButtonLink>
              <ButtonLink href="#" variant="outline" showArrow>
                Book a Demo
              </ButtonLink>
            </div>

            <BenefitList />
          </div>

          <DashboardPreview />
        </div>
      </div>
    </section>
  );
}
