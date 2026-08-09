"use client";

import { FormEvent, useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, DollarSign, Link2, LoaderCircle, ShieldCheck, SquarePlay, UserRound, Zap } from "lucide-react";
import { useWebsiteScrapeStatus } from "@/hooks/useWebsiteScrapeStatus";
import { getWebsiteFaviconUrl } from "@/lib/discovery-website";
import { analysisStepForElapsedTime, LANDING_ANALYSIS_STEPS, normalizeLandingWebsiteUrl } from "@/lib/landing-url-analyzer";
import { cn } from "@/lib/utils";
import ShimmerText from "@/components/ui/shimmer-text";
import HeroBackground from "./HeroBackground";

type AnalyzerPhase = "idle" | "running" | "failed";

const TRUST_ITEMS = [
  { label: "Fraction of agency cost.", icon: DollarSign },
  { label: "Setup in 60 seconds.", icon: Zap },
  { label: "Personalized. No Spam Guarantee.", icon: ShieldCheck },
  { label: "You approve everything.", icon: UserRound },
] as const;

const MINIMUM_PROGRESS_MS = 1_500;
const NAVIGATION_WAIT_MS = 5_000;
const delay = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

function AnalysisStatusPanel({
  phase,
  activeStep,
  errorMessage,
  onRetry,
}: {
  phase: AnalyzerPhase;
  activeStep: number;
  errorMessage: string | null;
  onRetry: () => void;
}) {
  const isVisible = phase !== "idle" || Boolean(errorMessage);

  return (
    <div
      className={cn(
        "hero-status-panel grid w-full max-w-[760px] transition-[grid-template-rows,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
        isVisible ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
      )}
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="min-h-0 overflow-hidden">
        {phase !== "idle" ? (
          <div className="animate-in fade-in pb-3 pt-5 duration-300 motion-reduce:animate-none sm:pb-4 sm:pt-7 h-compact:lg:pb-2 h-compact:lg:pt-3">
            <p className="flex items-center justify-center gap-3 text-base font-semibold">
              {phase === "running" ? <LoaderCircle className="size-5 animate-spin text-[#4e28df] motion-reduce:animate-none" aria-hidden /> : null}
              {phase === "running" ? "LeadReacher is getting to work…" : "Website analysis needs attention"}
            </p>
            {phase === "running" ? (
              <ol className="mt-5 grid grid-cols-2 gap-x-5 gap-y-3 text-sm text-[#596078] sm:grid-cols-4 sm:gap-4">
                {LANDING_ANALYSIS_STEPS.map((step, index) => (
                  <li key={step} className={cn("flex items-center justify-center gap-2 transition-colors duration-300", index <= activeStep && "font-medium text-[#35208f]")}>
                    <span className={cn("size-2 rounded-full bg-[#c9c4e8] transition-[background-color,box-shadow] duration-300", index <= activeStep && "bg-[#4e28df] shadow-[0_0_0_4px_rgba(78,40,223,0.1)]")} aria-hidden />
                    {step}
                  </li>
                ))}
              </ol>
            ) : (
              <div id="landing-analyzer-message" className="mt-3 text-sm text-red-700">
                <p>{errorMessage}</p>
                <div className="mt-3 flex items-center justify-center gap-3">
                  <button type="button" onClick={onRetry} className="font-semibold text-[#4e28df] hover:underline">Retry</button>
                  <Link href="/signup" className="font-semibold text-[#596078] hover:text-[#090d1d]">Continue manually</Link>
                </div>
              </div>
            )}
          </div>
        ) : errorMessage ? (
          <p id="landing-analyzer-message" className="pb-2 pt-4 text-sm font-medium text-red-700">{errorMessage}</p>
        ) : null}
      </div>
    </div>
  );
}

export default function HeroSection() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const fiberTargetRef = useRef<HTMLFormElement>(null);
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
        { backgroundPosition: "0 0, 100% 50%", offset: 0.16 },
        { backgroundPosition: "0 0, 0% 50%", offset: 0.34 },
        { backgroundPosition: "0 0, 0% 50%", offset: 1 },
      ],
      { duration: 10_000, easing: "ease-in-out", iterations: Number.POSITIVE_INFINITY },
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
    <section id="top" data-navbar-theme="light" className="relative isolate flex min-h-svh w-full scroll-mt-20 overflow-hidden text-[#090d1d] lg:min-h-[calc(100svh-2rem)]">
      <HeroBackground />
      <div className="hero-shell mx-auto flex min-h-svh w-full max-w-[1536px] flex-col px-4 pb-7 pt-22 min-[360px]:px-5 sm:px-8 sm:pt-28 lg:min-h-[calc(100svh-2rem)] lg:px-12 lg:pb-8 lg:pt-32 h-compact:lg:pb-3 h-compact:lg:pt-20 h-short:lg:pb-1 h-short:lg:pt-16">
        <main data-analysis-phase={phase} className="hero-composition flex flex-1 flex-col items-center text-center lg:grid lg:grid-cols-1 lg:grid-rows-[1fr_auto_1fr]">
          <div className="flex flex-col items-center lg:self-end lg:pb-[clamp(1.25rem,4vh,3rem)]">
          <h1 className="hero-headline max-w-[930px] text-balance text-[2.25rem] font-semibold leading-[1.06] min-[360px]:text-[2.6rem] sm:text-[4rem] xl:text-[5.5rem] h-compact:lg:text-[3.75rem] h-compact:lg:leading-[1.03] h-short:lg:text-[3rem]">
            <span className="block">Drop your URL.</span>
            <span className="block">Go back to <ShimmerText
              className="hero-business-shimmer"
              style={
                {
                  "--lr-shimmer-base": "#4f46e5",
                  "--lr-shimmer-core": "#58a6ff",
                  "--lr-shimmer-edge": "rgba(125, 183, 255, 0.7)",
                } as CSSProperties
              }
            >business.</ShimmerText></span>
          </h1>
          <p className="hero-entrance hero-entrance--category mt-5 max-w-[820px] text-balance text-[1.375rem] font-medium leading-8 tracking-[0.0125em] text-[#596078] sm:mt-6 sm:text-[1.5625rem] lg:text-[1.875rem] lg:leading-9 h-compact:sm:mt-4 h-compact:lg:text-[1.5625rem] h-compact:lg:leading-8 h-short:lg:mt-2 h-short:lg:text-[1.375rem] h-short:lg:leading-7 2xl:text-[2rem]">
            Finds prospects. Reaches out. Converts. You close.
          </p>
          </div>

          <form
            ref={fiberTargetRef}
            data-fiber-flow-target
            onSubmit={handleSubmit}
            className="hero-entrance hero-entrance--analyzer mt-7 w-full max-w-[820px] justify-self-center sm:mt-9 lg:row-start-2 lg:mt-0 h-compact:sm:mt-6 h-short:lg:mt-3"
            noValidate
          >
            <div
              ref={waveTargetRef}
              data-invalid={errorMessage && phase === "idle" ? "true" : undefined}
              className={cn(
                "hero-analyzer flex min-h-20 items-center rounded-[22px] border border-transparent p-2 shadow-[0_18px_45px_rgba(66,42,148,0.10)] transition-[box-shadow] duration-300 focus-within:shadow-[0_18px_45px_rgba(66,42,148,0.16),0_0_0_3px_rgba(124,58,237,0.10),0_0_30px_rgba(99,102,241,0.14)] max-sm:flex-col max-sm:items-stretch max-sm:gap-2 max-sm:rounded-2xl",
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
                {phase === "running" ? "Analyzing website" : "Get Started"}
                {phase !== "running" ? <ArrowRight className="size-5" aria-hidden /> : null}
              </button>
            </div>
          </form>

          <div className="flex w-full flex-col items-center lg:row-start-3 lg:min-h-[clamp(11rem,21vh,16rem)] lg:justify-between lg:pt-[clamp(1.5rem,3.25vh,3rem)]">
          <p className="hero-entrance hero-entrance--description mt-6 max-w-[900px] text-balance text-base leading-7 text-[#66708b] sm:mt-7 sm:text-lg sm:leading-8 lg:text-xl h-compact:sm:mt-3 h-compact:lg:text-lg h-compact:lg:leading-7 h-short:lg:mt-2 h-short:lg:text-base h-short:lg:leading-6 2xl:text-[1.375rem] 2xl:leading-8">
            <span className="font-semibold text-[#171729]">LeadReacher automates customer acquisition from start to finish.</span>{" "}
            It scrapes for prospects, creates personalized content and runs social outreach campaigns that convert. <span className="font-semibold text-[#5b41ef]">All you have to do is reply.</span>
          </p>

          <div className="hero-entrance hero-entrance--video relative mt-4 flex w-full max-w-[860px] items-center justify-center text-center sm:mt-5 h-compact:sm:mt-3 h-short:lg:mt-2">
            <p className="max-w-[760px] justify-self-center text-balance text-sm font-semibold leading-6 text-[#171729] sm:text-base sm:leading-7 lg:text-lg lg:leading-8 2xl:text-xl">
              <span className="block"><span className="inline-flex items-center gap-1.5"><SquarePlay className="size-4 text-[#5b41ef] sm:size-5" aria-hidden />The net's first <span className="text-[#5b41ef]">personalized video outreach</span>,</span></span>
              <span className="block">created <span className="text-[#5b41ef]">one prospect at a time</span>, delivered via social media DM.</span>
            </p>
          </div>

          <AnalysisStatusPanel phase={phase} activeStep={activeStep} errorMessage={errorMessage} onRetry={handleRetry} />

          <ul className="hero-entrance hero-entrance--trust mt-2 flex flex-wrap items-center justify-center text-sm font-medium text-[#20263a] max-sm:flex-col max-sm:gap-1 sm:divide-x sm:divide-[#d8d9e5] h-compact:lg:text-[0.8125rem] h-short:lg:mt-0 2xl:text-base">
            {TRUST_ITEMS.map(({ label, icon: Icon }) => (
              <li key={label} className="hero-trust-item flex min-w-[220px] items-center justify-center gap-3 px-7 py-1.5 sm:py-2 h-compact:lg:min-w-[190px] h-compact:lg:px-5 h-compact:lg:py-1">
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
