"use client";

import { FormEvent, useEffect, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { DollarSign, ShieldCheck, SquarePlay, UserRound, Zap } from "@/components/ui/icons";
import { useWebsiteScrapeStatus } from "@/hooks/useWebsiteScrapeStatus";
import { useLandingPerformanceTelemetry } from "@/hooks/useLandingPerformanceTelemetry";
import { usePageVisibility } from "@/hooks/usePageVisibility";
import { normalizeLandingWebsiteUrl } from "@/lib/landing-url-analyzer";
import { initializeDemoSession } from "@/lib/onboarding/demo-store";
import ShimmerText from "@/components/ui/shimmer-text";
import HeroBackground from "./HeroBackground";
import { BrowserBar } from "./BrowserBar";

type AnalyzerPhase = "idle" | "running" | "failed";

const TRUST_ITEMS = [
  { label: "Fraction of agency cost.", icon: DollarSign },
  { label: "Setup in 60 seconds.", icon: Zap },
  { label: "Personalized. No Spam Guarantee.", icon: ShieldCheck },
  { label: "You approve everything.", icon: UserRound },
] as const;

const MINIMUM_PROGRESS_MS = 1_500;
const NAVIGATION_WAIT_MS = 5_000;
const HERO_HEADLINE_WORDS = ["business", "store", "startup", "brokerage", "product", "agency"] as const;
const delay = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

function useRotatingHeroWord(isPageVisible: boolean) {
  const [word, setWord] = useState<string>(HERO_HEADLINE_WORDS[0]);
  const [hasInteracted, setHasInteracted] = useState(false);

  useEffect(() => {
    if (!isPageVisible || hasInteracted) return;

    const beginRotation = () => setHasInteracted(true);
    const options = { once: true, passive: true } as const;
    window.addEventListener("pointermove", beginRotation, options);
    window.addEventListener("touchstart", beginRotation, options);
    window.addEventListener("keydown", beginRotation, { once: true });

    return () => {
      window.removeEventListener("pointermove", beginRotation);
      window.removeEventListener("touchstart", beginRotation);
      window.removeEventListener("keydown", beginRotation);
    };
  }, [hasInteracted, isPageVisible]);

  useEffect(() => {
    if (!isPageVisible || !hasInteracted || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let wordIndex = 0;
    let characterCount = HERO_HEADLINE_WORDS[wordIndex].length;
    let isDeleting = false;
    let timeout: number | undefined;

    const tick = () => {
      const currentWord = HERO_HEADLINE_WORDS[wordIndex];

      if (!isDeleting && characterCount === currentWord.length) {
        isDeleting = true;
        timeout = window.setTimeout(tick, 1_700);
        return;
      }

      if (isDeleting && characterCount === 0) {
        wordIndex = (wordIndex + 1) % HERO_HEADLINE_WORDS.length;
        isDeleting = false;
        timeout = window.setTimeout(tick, 260);
        return;
      }

      characterCount += isDeleting ? -1 : 1;
      setWord(currentWord.slice(0, characterCount));
      timeout = window.setTimeout(tick, isDeleting ? 55 : 105);
    };

    timeout = window.setTimeout(tick, 1_700);
    return () => {
      if (timeout !== undefined) window.clearTimeout(timeout);
    };
  }, [hasInteracted, isPageVisible]);

  return word;
}

export default function Hero({ demoEnabled = false }: { demoEnabled?: boolean }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const taglineRef = useRef<HTMLParagraphElement>(null);
  const fiberTargetRef = useRef<HTMLFormElement>(null);
  const waveTargetRef = useRef<HTMLDivElement>(null);
  const submissionPending = useRef(false);
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [phase, setPhase] = useState<AnalyzerPhase>("idle");
  const [hydrated, setHydrated] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [taglineWidth, setTaglineWidth] = useState<number | null>(null);
  const isPageVisible = usePageVisibility();
  const rotatingHeroWord = useRotatingHeroWord(isPageVisible);
  const { waitForReadyToNavigate } = useWebsiteScrapeStatus({ autoStart: false, context: "anonymous" });

  useLandingPerformanceTelemetry();

  useEffect(() => setHydrated(true), []);

  useEffect(() => {
    const tagline = taglineRef.current;
    if (!tagline) return;

    const updateWidth = () => {
      const availableWidth = tagline.parentElement?.getBoundingClientRect().width ?? 0;
      const nextWidth = Math.round(Math.min(tagline.getBoundingClientRect().width, availableWidth));
      if (nextWidth > 0) {
        setTaglineWidth((currentWidth) => currentWidth === nextWidth ? currentWidth : nextWidth);
      }
    };

    const observer = new ResizeObserver(updateWidth);
    observer.observe(tagline);
    window.addEventListener("resize", updateWidth, { passive: true });
    const frame = window.requestAnimationFrame(updateWidth);
    void document.fonts?.ready.then(updateWidth);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateWidth);
      window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    const target = waveTargetRef.current;
    const invalid = Boolean(errorMessage && phase === "idle");
    if (!target || invalid || !isPageVisible || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const animation = target.animate(
      [
        { backgroundPosition: "0 0, 0% 50%" },
        { backgroundPosition: "0 0, 100% 50%", offset: 0.16 },
        { backgroundPosition: "0 0, 0% 50%", offset: 0.34 },
        { backgroundPosition: "0 0, 0% 50%", offset: 1 },
      ],
      { duration: 10_000, easing: "ease-in-out", iterations: Number.POSITIVE_INFINITY },
    );
    return () => animation.cancel();
  }, [errorMessage, isPageVisible, phase]);

  async function runAnalysis(domain: string) {
    if (submissionPending.current) return;
    submissionPending.current = true;
    setPhase("running");
    setErrorMessage(null);
    window.localStorage.setItem("lr_website_url", domain);
    if (!window.localStorage.getItem("lr_anon_scrape_id")) {
      window.localStorage.setItem("lr_anon_scrape_id", window.crypto.randomUUID());
    }

    try {
      const [finalStatus] = await Promise.all([
        waitForReadyToNavigate(NAVIGATION_WAIT_MS),
        delay(MINIMUM_PROGRESS_MS),
      ]);
      if (finalStatus.status === "failed") {
        setPhase("failed");
        setErrorMessage(finalStatus.error ?? "We couldn't analyze that website yet.");
        return;
      }
      router.push("/signup");
    } catch (error) {
      setPhase("failed");
      setErrorMessage(error instanceof Error ? error.message : "We couldn't start the analysis. Please try again.");
    } finally {
      submissionPending.current = false;
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const domain = normalizeLandingWebsiteUrl(inputRef.current?.value ?? websiteUrl);
    if (!domain) {
      setPhase("idle");
      setErrorMessage("Enter a valid company website, such as example.com.");
      inputRef.current?.focus();
      return;
    }
    setWebsiteUrl(domain);
    if (demoEnabled) {
      initializeDemoSession(domain);
      router.push("/demo/onboarding?step=signup");
      return;
    }
    void runAnalysis(domain);
  }

  return (
    <section id="top" data-hydrated={hydrated} data-navbar-theme="light" className="relative isolate flex min-h-svh w-full scroll-mt-20 overflow-hidden bg-white text-[#090d1d] lg:min-h-[calc(100svh-2rem)]">
      <HeroBackground />
      <div className="hero-shell mx-auto flex min-h-svh w-full max-w-[1536px] flex-col px-4 pb-7 pt-28 min-[360px]:px-5 sm:px-8 sm:pt-28 lg:min-h-[calc(100svh-2rem)] lg:px-12 lg:pb-8 lg:pt-32 h-compact:lg:pb-3 h-compact:lg:pt-20 h-short:lg:pb-1 h-short:lg:pt-16">
        <main data-analysis-phase={phase} className="hero-composition flex flex-1 flex-col items-center text-center lg:grid lg:grid-cols-1 lg:grid-rows-[1fr_auto_1fr]">
          <div className="flex flex-col items-center lg:self-end lg:pb-[clamp(1.25rem,4vh,3rem)]">
          <h1 aria-label="Drop your URL. Go back to your business, store, startup, brokerage, product, or agency." className="hero-headline max-w-[1200px] text-balance text-[1.75rem] font-semibold leading-[1.06] sm:text-[4rem] xl:text-[5.5rem] h-compact:lg:text-[3.75rem] h-compact:lg:leading-[1.03] h-short:lg:text-[3rem]">
            <span className="block">Drop your URL.</span>
            <span className="block whitespace-nowrap" aria-hidden>Go back to your <ShimmerText
              className="hero-business-shimmer"
              style={
                {
                  "--lr-shimmer-base": "#4f46e5",
                  "--lr-shimmer-core": "#58a6ff",
                  "--lr-shimmer-edge": "rgba(125, 183, 255, 0.7)",
                } as CSSProperties
              }
            >{rotatingHeroWord}</ShimmerText>.</span>
          </h1>
          <p ref={taglineRef} className="hero-entrance hero-entrance--category mt-5 max-w-[820px] text-balance text-[1.375rem] font-medium leading-8 tracking-[0.0125em] text-[#596078] sm:mt-6 sm:text-[1.5625rem] lg:text-[1.875rem] lg:leading-9 h-compact:sm:mt-4 h-compact:lg:text-[1.5625rem] h-compact:lg:leading-8 h-short:lg:mt-2 h-short:lg:text-[1.375rem] h-short:lg:leading-7 2xl:text-[2rem]">
            Finds prospects. Reaches out. Converts. You close.
          </p>
          </div>

          <BrowserBar
            id="landing-website-url"
            value={websiteUrl}
            onValueChange={(value) => {
              setWebsiteUrl(value);
              if (errorMessage) {
                setErrorMessage(null);
                setPhase("idle");
              }
            }}
            onSubmit={handleSubmit}
            formRef={fiberTargetRef}
            barRef={waveTargetRef}
            inputRef={inputRef}
            formClassName="hero-entrance hero-entrance--analyzer mt-7 w-full max-w-[820px] justify-self-center max-sm:!w-[calc(100vw-1.25rem)] max-sm:!max-w-none sm:mt-9 lg:row-start-2 lg:mt-0 h-compact:sm:mt-6 h-short:lg:mt-3"
            formStyle={taglineWidth ? { width: `${taglineWidth}px`, maxWidth: "100%" } : undefined}
            errorMessage={errorMessage}
            disabled={phase === "running"}
            spotlight
          />

          <div className="relative z-[1] mt-32 flex w-screen flex-col items-center bg-white px-5 before:pointer-events-none before:absolute before:inset-x-0 before:-top-16 before:h-16 before:bg-gradient-to-b before:from-transparent before:to-white sm:mt-0 sm:w-full sm:bg-transparent sm:px-0 sm:before:hidden lg:row-start-3 lg:min-h-[clamp(11rem,21vh,16rem)] lg:justify-between lg:pt-[clamp(1.5rem,3.25vh,3rem)]">
          <p className="hero-entrance hero-entrance--description mt-6 max-w-[900px] text-balance text-lg leading-8 text-[#66708b] sm:mt-7 sm:text-lg sm:leading-8 lg:text-xl h-compact:sm:mt-3 h-compact:lg:text-lg h-compact:lg:leading-7 h-short:lg:mt-2 h-short:lg:text-base h-short:lg:leading-6 2xl:text-[1.375rem] 2xl:leading-8">
            <span className="font-semibold text-[#171729]">LeadReacher automates customer acquisition from start to finish.</span>{" "}
            It scrapes for prospects, creates personalized content and runs social outreach campaigns that convert. <span className="font-semibold text-[#5b41ef]">All you have to do is reply.</span>
          </p>

          <div className="hero-entrance hero-entrance--video relative mt-4 flex w-full max-w-[860px] items-center justify-center text-center sm:mt-5 h-compact:sm:mt-3 h-short:lg:mt-2">
            <p className="max-w-[760px] justify-self-center text-balance text-base font-semibold leading-7 text-[#171729] sm:text-base sm:leading-7 lg:text-lg lg:leading-8 2xl:text-xl">
              <span className="block"><span className="inline-flex items-center gap-1.5"><SquarePlay className="size-4 text-[#5b41ef] sm:size-5" aria-hidden />The net&apos;s first <span className="text-[#5b41ef]">personalized video outreach</span>,</span></span>
              <span className="block">created <span className="text-[#5b41ef]">one prospect at a time</span>, delivered via social media DM.</span>
            </p>
          </div>


          <ul className="hero-entrance hero-entrance--trust mt-5 flex w-full max-w-sm flex-wrap items-center justify-center text-sm font-medium text-[#20263a] max-sm:flex-col sm:mt-2 sm:max-w-none sm:divide-x sm:divide-[#d8d9e5] h-compact:lg:text-[0.8125rem] h-short:lg:mt-0 2xl:text-base">
            {TRUST_ITEMS.map(({ label, icon: Icon }) => (
              <li key={label} className="hero-trust-item flex min-h-16 w-full items-center justify-start gap-4 border-b border-[#d8d9e5] px-2 py-2 last:border-b-0 sm:min-w-[220px] sm:w-auto sm:justify-center sm:border-b-0 sm:px-7 h-compact:lg:min-w-[190px] h-compact:lg:px-5 h-compact:lg:py-1">
                <span className="hero-trust-icon inline-flex size-9 items-center justify-center rounded-full bg-white/55 text-[#596078] shadow-sm sm:size-10 h-compact:lg:size-8"><Icon className="size-5 h-compact:lg:size-4" aria-hidden /></span>{label}
              </li>
            ))}
          </ul>
          </div>
        </main>
      </div>
    </section>
  );
}
