import Link from "next/link";
import HeroVideo from "./HeroVideo";

const heroHeadlineShadow =
  "drop-shadow-[0_2px_20px_rgba(255,255,255,0.75)]";
const heroBodyShadow = "drop-shadow-[0_1px_12px_rgba(255,255,255,0.85)]";
const heroTrustShadow = "drop-shadow-[0_1px_8px_rgba(0,0,0,0.25)]";

const TRUST_BADGES = [
  "No spam outreach",
  "Real-time tracking",
  "Cancel anytime",
] as const;

export default function HeroSection() {
  return (
    <section className="relative isolate flex w-full flex-col overflow-hidden pb-0">
      <HeroVideo />
      <div
        className="hero-bottom-fade pointer-events-none absolute inset-x-0 bottom-0 z-5 h-[50%] min-h-80"
        aria-hidden
      />
      <div className="relative z-10 mx-auto flex w-full max-w-4xl flex-col items-center px-5 pb-10 pt-24 sm:px-8 sm:pb-12 sm:pt-28 md:pt-32">
        <main className="flex w-full flex-col items-center justify-start text-center">
          <div className="relative flex w-full max-w-6xl flex-col items-center justify-center px-2 pb-2 sm:px-4 sm:pb-4">
            <h1 className="w-full max-w-5xl text-balance text-4xl font-bold leading-[1.06] tracking-tight text-neutral-950 sm:max-w-6xl sm:text-5xl sm:leading-[1.05] md:text-6xl lg:text-[4rem] lg:leading-[1.04] xl:text-[4.75rem]">
              <span className={`relative block ${heroHeadlineShadow}`}>
                Customer acquisition.
              </span>
              <span
                className={`relative mt-2 block text-brand-purple sm:mt-3 ${heroHeadlineShadow}`}
              >
                Reimagined.
              </span>
            </h1>
            <p className="relative mt-8 max-w-2xl text-pretty text-base leading-relaxed text-neutral-500 sm:mt-10 sm:text-lg sm:leading-relaxed">
              <span className={heroBodyShadow}>
                The customer acquisition platform that generates qualified
                conversations automatically.
              </span>
            </p>
            <p className="relative mt-5 max-w-xl text-pretty text-base font-bold leading-relaxed text-neutral-950 sm:mt-6 sm:text-lg">
              <span className={heroBodyShadow}>
                100% done-for-you. Focus on running your business.
              </span>
            </p>
          </div>
          <div className="relative mt-4 sm:mt-5">
            <Link
              href="#waitlist"
              className="inline-flex items-center justify-center rounded-full bg-white px-8 py-3.5 text-[0.95rem] font-semibold text-brand-purple shadow-[0_4px_20px_rgba(83,38,183,0.15)] transition-transform hover:scale-[1.02] sm:px-10 sm:py-4 sm:text-base"
            >
              Get Started →
            </Link>
            <ul className="relative mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-white/80 sm:text-[0.8125rem]">
              {TRUST_BADGES.map((badge, index) => (
                <li key={badge} className="flex items-center gap-4">
                  <span className={`flex items-center gap-2 ${heroTrustShadow}`}>
                    <span
                      className="flex size-4 shrink-0 items-center justify-center rounded-full bg-brand-purple text-[0.5rem] text-white"
                      aria-hidden
                    >
                      ✓
                    </span>
                    {badge}
                  </span>
                  {index < TRUST_BADGES.length - 1 ? (
                    <span
                      className="hidden h-3 w-px bg-white/30 sm:block"
                      aria-hidden
                    />
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        </main>
      </div>
    </section>
  );
}
