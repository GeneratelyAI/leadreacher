"use client";

import { FormEvent, useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowRight, Link2, LoaderCircle, LockKeyhole, ShieldCheck, Sparkles, SquarePlay, Zap } from "lucide-react";
import { useWebsiteScrapeStatus } from "@/hooks/useWebsiteScrapeStatus";
import { getWebsiteFaviconUrl } from "@/lib/discovery-website";
import { analysisStepForElapsedTime, LANDING_ANALYSIS_STEPS, normalizeLandingWebsiteUrl } from "@/lib/landing-url-analyzer";
import { cn } from "@/lib/utils";
import ShimmerText from "@/components/ui/shimmer-text";
import { LiquidButton } from "@/components/ui/liquid-glass-button";
import HeroBackground from "./HeroBackground";

type AnalyzerPhase = "idle" | "running" | "failed";

const TRUST_ITEMS = [
  { label: "No credit card required", icon: ShieldCheck },
  { label: "Takes 60 seconds", icon: Zap },
  { label: "Cancel anytime", icon: LockKeyhole },
] as const;

const MINIMUM_PROGRESS_MS = 1_500;
const NAVIGATION_WAIT_MS = 5_000;
const delay = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

export default function HeroSection() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const waveTargetRef = useRef<HTMLDivElement>(null);
  const submissionPending = useRef(false);
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [phase, setPhase] = useState<AnalyzerPhase>("idle");
  const [activeStep, setActiveStep] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [faviconHost, setFaviconHost] = useState<string | null>(null);
  const [faviconLoaded, setFaviconLoaded] = useState(false);
  const [faviconFailed, setFaviconFailed] = useState(false);
  const { start, waitForReadyToNavigate } = useWebsiteScrapeStatus({ autoStart: false, context: "anonymous" });

  function handleHowItWorksScroll() {
    const target = document.getElementById("how-it-works");
    if (!target) return;

    target.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "start",
    });
  }

  useEffect(() => {
    if (phase !== "running") return;
    const startedAt = Date.now();
    const timer = window.setInterval(() => setActiveStep(analysisStepForElapsedTime(Date.now() - startedAt)), 180);
    return () => window.clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    const normalized = normalizeLandingWebsiteUrl(websiteUrl);
    const timer = window.setTimeout(() => {
      setFaviconHost(normalized);
      setFaviconLoaded(false);
      setFaviconFailed(false);
    }, normalized ? 220 : 0);
    return () => window.clearTimeout(timer);
  }, [websiteUrl]);

  useEffect(() => {
    const target = waveTargetRef.current;
    const invalid = Boolean(errorMessage && phase === "idle");
    if (!target || invalid || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const animation = target.animate(
      [
        { backgroundPosition: "0 0, 0% 50%" },
        { backgroundPosition: "0 0, 100% 50%" },
        { backgroundPosition: "0 0, 0% 50%" },
      ],
      { duration: 5_500, easing: "ease-in-out", iterations: Number.POSITIVE_INFINITY },
    );
    return () => animation.cancel();
  }, [errorMessage, phase]);

  async function runAnalysis(domain: string) {
    if (submissionPending.current) return;
    submissionPending.current = true;
    setPhase("running");
    setActiveStep(0);
    setErrorMessage(null);
    window.localStorage.setItem("lr_website_url", domain);
    if (!window.localStorage.getItem("lr_anon_scrape_id")) {
      window.localStorage.setItem("lr_anon_scrape_id", window.crypto.randomUUID());
    }

    try {
      await Promise.all([waitForReadyToNavigate(NAVIGATION_WAIT_MS), delay(MINIMUM_PROGRESS_MS)]);
      const finalStatus = await start();
      if (finalStatus.status === "failed") {
        setPhase("failed");
        setErrorMessage(finalStatus.error ?? "We couldn't analyze that website yet.");
        return;
      }
      setActiveStep(3);
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
    const domain = normalizeLandingWebsiteUrl(websiteUrl);
    if (!domain) {
      setPhase("idle");
      setErrorMessage("Enter a valid company website, such as example.com.");
      inputRef.current?.focus();
      return;
    }
    setWebsiteUrl(domain);
    void runAnalysis(domain);
  }

  function handleRetry() {
    const domain = normalizeLandingWebsiteUrl(websiteUrl);
    if (!domain) return void inputRef.current?.focus();
    window.localStorage.removeItem("lr_anon_scrape_id");
    void runAnalysis(domain);
  }

  return (
    <section id="top" data-navbar-theme="light" className="relative isolate flex min-h-svh w-full scroll-mt-20 overflow-hidden text-[#090d1d]">
      <HeroBackground />
      <div className="mx-auto flex min-h-svh w-full max-w-[1536px] flex-col px-5 pb-7 pt-24 sm:px-8 sm:pt-28 lg:px-12 lg:pb-8 lg:pt-32">
        <main className="flex flex-1 flex-col items-center text-center">
          {/* Tailwind classes belong on LiquidButton, not the slotted child: `asChild`
              concatenates the child's className instead of running it through twMerge,
              so anything set there loses to the variant defaults. */}
          <LiquidButton
            asChild
            size="default"
            glassScale={14}
            className="hero-eyebrow-liquid mt-1 h-auto border border-white/80 bg-white/70 px-4 py-2 text-xs font-semibold uppercase text-[#4525b6] backdrop-blur-[2px] has-[>svg]:px-4 sm:mt-5 sm:text-sm"
          >
            <div>
              <Sparkles className="size-4" aria-hidden />
              <ShimmerText
                duration={4.5}
                style={
                  {
                    "--lr-shimmer-base": "#4525b6",
                    "--lr-shimmer-core": "rgba(255, 255, 255, 0.82)",
                    "--lr-shimmer-edge": "rgba(255, 255, 255, 0.4)",
                  } as CSSProperties
                }
              >
                AI-powered outreach. Human connection.
              </ShimmerText>
            </div>
          </LiquidButton>

          <h1 className="mt-6 max-w-[930px] text-balance text-[2.6rem] font-semibold leading-[1.06] sm:mt-9 sm:text-[4rem] xl:text-[5.5rem]">
            <span className="block">Drop your URL.</span>
            <span className="block">Go back to <ShimmerText>business.</ShimmerText></span>
          </h1>
          <p className="mt-5 max-w-[820px] text-balance text-lg font-semibold leading-8 text-[#090d1d] sm:mt-6 sm:text-xl lg:text-2xl lg:leading-9">
            The world&rsquo;s first 100% done-for-you lead gen platform.
          </p>

          <form onSubmit={handleSubmit} className="mt-7 w-full max-w-[820px] sm:mt-9" noValidate>
            <div
              ref={waveTargetRef}
              data-fiber-flow-target
              data-invalid={errorMessage && phase === "idle" ? "true" : undefined}
              className={cn(
                "flex min-h-20 items-center rounded-[22px] border border-transparent p-2 shadow-[0_18px_45px_rgba(66,42,148,0.14),0_0_24px_rgba(124,58,237,0.08)] transition-[box-shadow] duration-300 focus-within:shadow-[0_18px_45px_rgba(66,42,148,0.16),0_0_0_3px_rgba(124,58,237,0.10),0_0_30px_rgba(99,102,241,0.14)] max-sm:flex-col max-sm:items-stretch max-sm:gap-2 max-sm:rounded-2xl",
              )}
              style={{
                background: errorMessage && phase === "idle"
                  ? "linear-gradient(#ffffff, #ffffff) padding-box, linear-gradient(105deg, #fca5a5, #ef4444, #fca5a5) border-box"
                  : "linear-gradient(#ffffff, #ffffff) padding-box, linear-gradient(105deg, rgba(147,51,234,.72), rgba(196,181,253,.82) 24%, rgba(255,255,255,.96) 48%, rgba(165,180,252,.86) 72%, rgba(79,70,229,.76)) border-box",
                backgroundSize: "100% 100%, 220% 100%",
              }}
            >
              <label htmlFor="landing-website-url" className="sr-only">Company website</label>
              <div className="flex min-w-0 flex-1 items-center">
                <span className="relative ml-4 size-6 shrink-0" aria-hidden>
                  <Link2
                    className={cn(
                      "absolute inset-0 size-6 text-[#6b7280] transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-none",
                      faviconLoaded && !faviconFailed
                        ? "-rotate-12 scale-50 opacity-0"
                        : "rotate-0 scale-100 opacity-100",
                    )}
                  />
                  {faviconHost ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={faviconHost}
                      src={getWebsiteFaviconUrl(faviconHost)}
                      alt=""
                      data-testid="landing-website-favicon"
                      onLoad={() => setFaviconLoaded(true)}
                      onError={() => {
                        setFaviconFailed(true);
                        setFaviconLoaded(false);
                      }}
                      className={cn(
                        "absolute inset-0 size-6 rounded-md object-contain transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-none",
                        faviconLoaded && !faviconFailed
                          ? "rotate-0 scale-100 opacity-100"
                          : "rotate-12 scale-50 opacity-0",
                      )}
                    />
                  ) : null}
                </span>
                <input ref={inputRef} id="landing-website-url" type="url" inputMode="url" autoComplete="url" value={websiteUrl}
                  onChange={(event) => { setWebsiteUrl(event.target.value); if (errorMessage && phase === "idle") setErrorMessage(null); }}
                  disabled={phase === "running"} placeholder="https://yourwebsite.com" aria-invalid={Boolean(errorMessage && phase === "idle")}
                  aria-describedby={errorMessage ? "landing-analyzer-message" : undefined}
                  className="h-14 min-w-0 flex-1 bg-transparent px-4 text-base font-medium outline-none placeholder:text-[#8b91a3] disabled:opacity-70 sm:text-lg" />
              </div>
              <button type="submit" disabled={phase === "running"} className="inline-flex h-14 shrink-0 items-center justify-center gap-3 rounded-[14px] bg-[#4e28df] px-7 text-base font-semibold text-white shadow-[0_10px_25px_rgba(78,40,223,0.25)] transition-[background-color,transform] duration-200 hover:bg-[#4020c9] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#8b7fd4]/45 active:translate-y-px disabled:pointer-events-none disabled:opacity-75 sm:min-w-[252px] sm:text-lg">
                {phase === "running" ? <LoaderCircle className="size-5 animate-spin motion-reduce:animate-none" aria-hidden /> : null}
                {phase === "running" ? "Analyzing website" : "Analyze my website"}
                {phase !== "running" ? <ArrowRight className="size-5" aria-hidden /> : null}
              </button>
            </div>
          </form>

          <p className="mt-5 max-w-[900px] text-balance text-base leading-7 text-[#596078] sm:mt-6 sm:text-lg sm:leading-8 lg:text-xl">
            Leadreacher finds your ideal customers and reaches out to them for you, personally, automatically, across the channels they actually use.
          </p>

          <div className="relative mt-4 flex w-full max-w-[860px] items-center justify-center gap-3 text-center sm:mt-5 sm:gap-4">
            <span className="inline-flex items-center justify-center text-[#4f46e5] md:absolute md:left-1/2 md:top-1/2 md:mr-0 md:-translate-x-[280px] md:-translate-y-1/2" aria-hidden>
              <SquarePlay className="size-5 sm:size-[1.375rem]" />
            </span>
            <p className="max-w-[760px] justify-self-center text-balance text-sm font-semibold leading-6 text-[#090d1d] sm:text-base sm:leading-7 lg:text-lg lg:leading-8">
              <span className="block">Including personalized video outreach,</span>
              <span className="block">created <span className="text-[#4f46e5]">one prospect at a time</span> for maximum conversion.</span>
            </p>
          </div>

          <div className="min-h-[68px] w-full max-w-[760px] pt-4 sm:min-h-[118px] sm:pt-7" aria-live="polite" aria-atomic="true">
            {phase !== "idle" ? (
              <div className="animate-in fade-in duration-300 motion-reduce:animate-none">
                <p className="flex items-center justify-center gap-3 text-base font-semibold">
                  {phase === "running" ? <LoaderCircle className="size-5 animate-spin text-[#4e28df] motion-reduce:animate-none" aria-hidden /> : null}
                  {phase === "running" ? "LeadReacher is getting to work…" : "Website analysis needs attention"}
                </p>
                {phase === "running" ? (
                  <ol className="mt-5 grid grid-cols-2 gap-x-5 gap-y-3 text-sm text-[#596078] sm:grid-cols-4 sm:gap-4">
                    {LANDING_ANALYSIS_STEPS.map((step, index) => (
                      <li key={step} className={cn("flex items-center justify-center gap-2 transition-colors duration-300", index <= activeStep && "font-medium text-[#35208f]")}>
                        <span className={cn("size-2 rounded-full bg-[#c9c4e8] transition-[background-color,box-shadow] duration-300", index <= activeStep && "bg-[#4e28df] shadow-[0_0_0_4px_rgba(78,40,223,0.1)]")} aria-hidden />{step}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <div id="landing-analyzer-message" className="mt-3 text-sm text-red-700">
                    <p>{errorMessage}</p>
                    <div className="mt-3 flex items-center justify-center gap-3">
                      <button type="button" onClick={handleRetry} className="font-semibold text-[#4e28df] hover:underline">Retry</button>
                      <Link href="/signup" className="font-semibold text-[#596078] hover:text-[#090d1d]">Continue manually</Link>
                    </div>
                  </div>
                )}
              </div>
            ) : errorMessage ? <p id="landing-analyzer-message" className="text-sm font-medium text-red-700">{errorMessage}</p> : null}
          </div>

          <ul className="mt-2 flex flex-wrap items-center justify-center text-sm font-medium text-[#20263a] max-sm:flex-col max-sm:gap-1 sm:divide-x sm:divide-[#d8d9e5]">
            {TRUST_ITEMS.map(({ label, icon: Icon }) => (
              <li key={label} className="flex min-w-[220px] items-center justify-center gap-3 px-7 py-1.5 sm:py-2">
                <span className="inline-flex size-9 items-center justify-center rounded-full bg-white/55 text-[#596078] shadow-sm sm:size-10"><Icon className="size-5" aria-hidden /></span>{label}
              </li>
            ))}
          </ul>
          <button type="button" onClick={handleHowItWorksScroll} aria-label="See how LeadReacher works" className="mt-auto flex flex-col items-center gap-2 pt-6 text-sm font-medium text-[#656b80] transition-colors hover:text-[#4e28df] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b7fd4] max-sm:hidden">
            <ArrowDown className="size-6" aria-hidden /> <span className="max-sm:sr-only">See how it works</span>
          </button>
        </main>
      </div>
    </section>
  );
}
