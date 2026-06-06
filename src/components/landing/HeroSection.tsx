import Image from "next/image";
import HeroAnimation from "@/components/landing/HeroAnimation";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Logo } from "@/components/ui/Logo";
import { ASSETS } from "@/lib/constants/brand";

const heroHeadlineShadow =
  "drop-shadow-[0_2px_20px_rgba(255,255,255,0.75)]";
const heroBodyShadow = "drop-shadow-[0_1px_12px_rgba(255,255,255,0.85)]";
const heroTrustShadow = "drop-shadow-[0_1px_8px_rgba(0,0,0,0.25)]";

export default function HeroSection() {
  return (
    <section className="relative isolate flex min-h-screen w-full flex-col overflow-hidden pb-0">
      <Image
        src={ASSETS.heroBackground}
        alt=""
        fill
        priority
        className="object-cover object-center"
        sizes="100vw"
      />
      <HeroAnimation />
      <div
        className="hero-bottom-fade pointer-events-none absolute inset-x-0 bottom-0 z-5 h-[50%] min-h-80"
        aria-hidden
      />
      <div className="relative z-10 mx-auto flex w-full max-w-4xl flex-1 flex-col items-center px-5 pb-28 pt-9 sm:px-8 sm:pb-32 sm:pt-12">
        <header className="mb-10 flex justify-center sm:mb-12">
          <Logo size="md" />
        </header>
        <main className="flex flex-1 flex-col items-center justify-center text-center">
          <div className="relative flex w-full max-w-6xl flex-col items-center justify-center px-2 py-10 sm:px-4 sm:py-14 md:min-h-[44vh] lg:min-h-[48vh]">
            <h1 className="w-full max-w-5xl text-balance text-4xl font-bold leading-[1.06] tracking-tight text-neutral-950 sm:max-w-6xl sm:text-5xl sm:leading-[1.05] md:text-6xl lg:text-[4rem] lg:leading-[1.04] xl:text-[4.75rem]">
              <span className={`relative block ${heroHeadlineShadow}`}>
                Outbound is broken,
              </span>
              <span
                className={`relative mt-2 block sm:mt-3 ${heroHeadlineShadow}`}
              >
                We Fixed It.
              </span>
              <span
                className={`relative mt-2 block text-brand-purple sm:mt-3 ${heroHeadlineShadow}`}
              >
                Lead Generation, Reimagined.
              </span>
            </h1>
            <p className="relative mt-8 max-w-xl text-pretty text-base leading-relaxed text-neutral-700 sm:mt-10 sm:max-w-2xl sm:text-xl sm:leading-relaxed">
              <span className={heroBodyShadow}>
                Cold calls and emails are dead. Just like your pipeline.
                <br />
                AI + social + creative to drive fresh, qualified leads.
              </span>
            </p>
          </div>
          <div className="relative mt-9 sm:mt-10">
            <ButtonLink href="#" size="lg" showArrow>
              Get Started
            </ButtonLink>
            <p className="relative mt-4 text-center text-xs text-white/85 sm:text-[0.8125rem]">
              <span className={heroTrustShadow}>
                No credit card required • Setup in minutes • Cancel anytime
              </span>
            </p>
          </div>
        </main>
      </div>
    </section>
  );
}
