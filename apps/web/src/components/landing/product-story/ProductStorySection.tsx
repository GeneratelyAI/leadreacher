"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { AnimatePresence, m, useReducedMotion } from "framer-motion";
import {
  Check,
  CheckCircle2,
} from "lucide-react";
import { ContainerScroll } from "@/components/ui/container-scroll-animation";
import { BackgroundPaths } from "@/components/ui/background-paths";
import AcquisitionShowcase from "./AcquisitionShowcase";
import HeroSectionBreak from "@/components/landing/hero/HeroSectionBreak";
import { InteractiveDashboardDemo } from "./InteractiveDashboardDemo";
import {
  PRODUCT_STORY_STAGE_IDS,
  progressForStageIndex,
  stageIndexForProgress,
  type ProductStoryStageId,
} from "@/lib/product-story";
import { cn } from "@/lib/utils";

type Stage = {
  id: ProductStoryStageId;
  label: string;
  eyebrow: string;
  title: string;
  description: string;
  action: string;
  result: string;
};

const STAGES: readonly Stage[] = [
  {
    id: "website",
    label: "Website",
    eyebrow: "01 · Understand",
    title: "We learn what makes your business different.",
    description: "LeadReacher reads your website and turns the important details into a usable acquisition brief.",
    action: "Share your website",
    result: "Business brief ready",
  },
  {
    id: "strategy",
    label: "Strategy",
    eyebrow: "02 · Plan",
    title: "We build a focused route to your buyers.",
    description: "Your offer becomes a clear audience, positioning angle, and channel plan before outreach begins.",
    action: "AI builds the strategy",
    result: "Audience and channels defined",
  },
  {
    id: "prospects",
    label: "Prospects",
    eyebrow: "03 · Review",
    title: "You see the real people we plan to contact.",
    description: "Review, approve, or exclude prospects before anyone is enrolled in a campaign.",
    action: "Review your prospects",
    result: "Qualified audience approved",
  },
  {
    id: "outreach",
    label: "Outreach",
    eyebrow: "04 · Reach",
    title: "Every message follows an approved sequence.",
    description: "LeadReacher coordinates personalized follow-ups across the channels your prospects actually use.",
    action: "Outreach starts",
    result: "Conversations begin",
  },
  {
    id: "conversations",
    label: "Conversations",
    eyebrow: "05 · Convert",
    title: "You step in when the prospect is ready.",
    description: "Interested replies arrive in Chat with their campaign, channel, and conversation context intact.",
    action: "Reply to warm prospects",
    result: "Qualified meetings booked",
  },
] as const;

function StagePreview({
  stageId,
  reducedMotion,
  onStageChange,
}: {
  stageId: ProductStoryStageId;
  reducedMotion: boolean;
  onStageChange: (stageId: ProductStoryStageId) => void;
}) {
  return (
    <InteractiveDashboardDemo
      stageId={stageId}
      reducedMotion={reducedMotion}
      onStageChange={onStageChange}
    />
  );
}

function WorkflowRail({ activeIndex, onSelect }: { activeIndex: number; onSelect: (index: number) => void }) {
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const direction = event.key === "ArrowRight" ? 1 : -1;
    const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    const focusedIndex = tabs.indexOf(document.activeElement as HTMLButtonElement);
    const currentIndex = focusedIndex >= 0 ? focusedIndex : activeIndex;
    const nextIndex = (currentIndex + direction + STAGES.length) % STAGES.length;
    onSelect(nextIndex);
    tabs[nextIndex]?.focus();
  }
  return (
    <div role="tablist" aria-label="LeadReacher workflow stages" onKeyDown={handleKeyDown} className="relative px-5 pb-5 pt-4 lg:px-8 lg:pb-6 lg:pt-6">
      <div aria-hidden className="absolute left-[10%] right-[10%] top-[39px] h-px bg-white/12 lg:top-[49px]" />
      <m.div
        aria-hidden
        className="absolute left-[10%] top-[38px] h-0.5 rounded-full bg-gradient-to-r from-[#7154f5] via-[#5d8cff] to-[#9a5cf1] lg:top-[48px]"
        animate={{ width: `${(activeIndex / (STAGES.length - 1)) * 80}%` }}
        transition={{ duration: 0.45, ease: "easeOut" }}
      />
      <div className="relative grid grid-cols-5 gap-2">
        {STAGES.map((stage, index) => {
          const isActive = activeIndex === index;
          const isComplete = index < activeIndex;
          return (
            <button
              key={stage.id}
              id={`product-story-tab-${stage.id}`}
              role="tab"
              aria-selected={isActive}
              aria-controls="product-story-panel"
              tabIndex={isActive ? 0 : -1}
              onClick={() => onSelect(index)}
              className="group relative z-10 flex min-w-0 flex-col items-center text-center focus-visible:outline-none"
            >
              <m.span
                animate={{ scale: isActive ? 1.08 : 1 }}
                className={cn(
                  "flex size-9 items-center justify-center rounded-full border text-xs font-semibold transition-colors duration-300 lg:size-11 lg:text-sm",
                  isActive
                    ? "border-[#9f8aff] bg-[#7154f5] text-white shadow-[0_0_0_6px_rgba(113,84,245,.13),0_0_30px_rgba(113,84,245,.48)]"
                    : isComplete
                      ? "border-[#7461d8] bg-[#262143] text-[#c7baff]"
                      : "border-white/15 bg-[#171a2d] text-white/50 group-hover:border-white/30 group-hover:text-white/80",
                )}
              >
                {isComplete ? <Check className="size-4" strokeWidth={2.4} aria-hidden /> : index + 1}
              </m.span>
              <span className={cn("mt-2.5 truncate text-[10px] font-semibold transition-colors lg:text-xs", isActive ? "text-white" : "text-white/48")}>{stage.label}</span>
              <span className={cn("mt-1 hidden max-w-[150px] text-[9px] leading-4 xl:block", isActive ? "text-white/65" : "text-white/30")}>{stage.action}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function WorkflowScene({ stage, activeIndex, reducedMotion, onSelect }: { stage: Stage; activeIndex: number; reducedMotion: boolean; onSelect: (index: number) => void }) {
  return (
    <div className="grid min-h-0 flex-1 grid-cols-[0.4fr_1.6fr] items-center gap-5 px-5 pb-5 lg:gap-8 lg:px-8 lg:pb-8">
      <div className="flex min-w-0 self-stretch flex-col justify-center py-5 lg:py-7">
        <AnimatePresence mode="popLayout" initial={false}>
          <m.div
            key={stage.id}
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -12 }}
            transition={{ duration: reducedMotion ? 0.1 : 0.34, ease: "easeOut" }}
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#aa96ff] lg:text-xs">{stage.eyebrow}</p>
            <h3 className="mt-3 text-balance text-xl font-semibold leading-tight text-white lg:text-2xl xl:text-3xl">{stage.title}</h3>
            <p className="mt-4 max-w-[30ch] text-sm leading-6 text-white/58 lg:text-[15px] lg:leading-6">{stage.description}</p>
            <div className="mt-6 space-y-2.5 border-t border-white/10 pt-5">
              <div className="flex items-center gap-2.5 text-xs text-white/62 lg:text-sm"><span className="size-1.5 rounded-full bg-[#8b7df4] shadow-[0_0_12px_#8b7df4]" />{stage.action}</div>
              <div className="flex items-center gap-2.5 text-xs font-medium text-white lg:text-sm"><CheckCircle2 className="size-4 text-emerald-400" aria-hidden />{stage.result}</div>
            </div>
          </m.div>
        </AnimatePresence>
        <div className="mt-auto flex items-center gap-3 pt-5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/36">
          <span>{String(activeIndex + 1).padStart(2, "0")}</span>
          <span className="h-px flex-1 bg-white/10" />
          <span>05</span>
        </div>
      </div>

      <div className="relative min-h-0 self-stretch py-1 lg:py-2">
        <m.div
          className="relative mx-auto flex h-full max-w-[920px] overflow-hidden rounded-[26px] border border-white/20 bg-[#070812] p-2 shadow-[0_28px_90px_rgba(0,0,0,.48),0_0_70px_rgba(102,72,233,.16)] [backface-visibility:hidden] [transform:translateZ(0)] lg:rounded-[34px] lg:p-3"
        >
          <span aria-hidden className="absolute left-1/2 top-1.5 z-30 h-1 w-10 -translate-x-1/2 rounded-full bg-white/20 lg:top-2 lg:h-1.5 lg:w-14" />
          <span aria-hidden className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-inset ring-white/10" />
          <div id="product-story-panel" role="tabpanel" aria-labelledby={`product-story-tab-${stage.id}`} className="relative min-h-0 flex-1 overflow-hidden rounded-[19px] bg-[#f7f7fb] lg:rounded-[24px]">
            <m.div
              key={stage.id}
              className="absolute inset-0 size-full [backface-visibility:hidden] [transform:translateZ(0)]"
              initial={reducedMotion ? false : { scale: 0.992 }}
              animate={{ scale: 1 }}
              transition={{ duration: reducedMotion ? 0 : 0.2, ease: "easeOut" }}
            >
              <InteractiveDashboardDemo
                stageId={stage.id}
                reducedMotion={reducedMotion}
                onStageChange={(stageId) => {
                  const index = STAGES.findIndex((candidate) => candidate.id === stageId);
                  if (index >= 0) onSelect(index);
                }}
              />
            </m.div>
          </div>
          <span aria-hidden className="absolute bottom-1.5 left-1/2 z-30 h-1 w-14 -translate-x-1/2 rounded-full bg-white/20 lg:bottom-2 lg:h-1.5 lg:w-20" />
        </m.div>
        <AnimatePresence mode="wait" initial={false}>
          <m.div
            key={`${stage.id}-result`}
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ delay: reducedMotion ? 0 : 0.16, duration: 0.3 }}
            className="absolute bottom-4 right-4 z-20 flex items-center gap-2 rounded-full border border-white/70 bg-white/92 px-3 py-2 text-[10px] font-semibold text-[#262b3e] shadow-[0_12px_30px_rgba(27,25,61,.16)] backdrop-blur-md lg:bottom-5 lg:right-5 lg:text-xs"
          >
            <span className="flex size-5 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"><Check className="size-3" strokeWidth={3} aria-hidden /></span>
            {stage.result}
          </m.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function DesktopStory() {
  const reducedMotion = Boolean(useReducedMotion());
  const [activeIndex, setActiveIndex] = useState(0);
  const activeIndexRef = useRef(0);
  const manualSelectionRef = useRef<number | null>(null);
  const activeStage = STAGES[activeIndex];
  const handleProgress = useCallback((progress: number) => {
    if (manualSelectionRef.current !== null) return;
    const nextIndex = stageIndexForProgress(progress);
    if (activeIndexRef.current === nextIndex) return;
    activeIndexRef.current = nextIndex;
    setActiveIndex(nextIndex);
  }, []);
  useEffect(() => {
    const resumeScrollTracking = () => {
      manualSelectionRef.current = null;
    };
    window.addEventListener("wheel", resumeScrollTracking, { passive: true });
    window.addEventListener("touchmove", resumeScrollTracking, { passive: true });
    return () => {
      window.removeEventListener("wheel", resumeScrollTracking);
      window.removeEventListener("touchmove", resumeScrollTracking);
    };
  }, []);
  const selectStage = useCallback((index: number) => {
    manualSelectionRef.current = index;
    activeIndexRef.current = index;
    setActiveIndex(index);
    const story = document.getElementById("product-story-scroll");
    if (!story) return;
    const top = story.getBoundingClientRect().top + window.scrollY;
    const scrollableDistance = Math.max(story.offsetHeight - window.innerHeight, 1);
    window.scrollTo({ top: top + progressForStageIndex(index) * scrollableDistance, behavior: reducedMotion ? "auto" : "smooth" });
  }, [reducedMotion]);
  return (
    <div data-navbar-theme="dark" className="relative isolate hidden overflow-clip rounded-t-[36px] bg-[#0d1020] text-white [backface-visibility:hidden] [transform:translateZ(0)] md:block lg:rounded-t-[48px]">
      <ContainerScroll backgroundComponent={<div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_30%,rgba(91,57,213,.24),transparent_42%),linear-gradient(180deg,#15182a_0%,#0d1020_48%,#111426_100%)]"><BackgroundPaths reducedMotion={reducedMotion} pathCount={12} className="opacity-95" /></div>} className="relative h-[460vh] min-h-[3000px]" contentClassName="aspect-[16/10] max-w-[1240px] rounded-[28px] border border-white/12 bg-[#111426]/94 shadow-[0_28px_72px_rgba(0,0,0,.34),0_0_56px_rgba(102,72,233,.1)] large-desktop:max-w-[1360px]" id="product-story-scroll" onProgress={handleProgress} reducedMotion={reducedMotion} titleComponent={<div className="pt-24 lg:pt-28 large-desktop:pt-32"><p className="text-xs font-semibold uppercase text-[#aa96ff] 2xl:text-sm large-desktop:text-[0.9375rem]">See LeadReacher in action</p><h2 className="mx-auto mt-3 max-w-4xl text-balance text-4xl font-semibold text-white lg:text-5xl 2xl:text-6xl large-desktop:max-w-5xl large-desktop:text-[4.125rem]">We handle everything. You close the deal.</h2><p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-white/55 lg:text-base large-desktop:max-w-3xl large-desktop:text-lg large-desktop:leading-7">Follow the full journey from your website to a qualified conversation.</p></div>}>
        <div className="flex h-full flex-col">
          <WorkflowRail activeIndex={activeIndex} onSelect={selectStage} />
          <WorkflowScene stage={activeStage} activeIndex={activeIndex} reducedMotion={reducedMotion} onSelect={selectStage} />
        </div>
      </ContainerScroll>
    </div>
  );
}

function MobileStory() {
  const reducedMotion = Boolean(useReducedMotion());
  const [activeIndex, setActiveIndex] = useState(0);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const selectStage = useCallback((stageId: ProductStoryStageId) => {
    document.getElementById(`mobile-story-${stageId}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);
  useEffect(() => {
    const elements = PRODUCT_STORY_STAGE_IDS.map((id) => document.getElementById(`mobile-story-${id}`)).filter((element): element is HTMLElement => Boolean(element));
    observerRef.current = new IntersectionObserver((entries) => { const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]; if (!visible) return; const index = elements.indexOf(visible.target as HTMLElement); if (index >= 0) setActiveIndex(index); }, { rootMargin: "-25% 0px -45%", threshold: [0.2, 0.5, 0.8] });
    elements.forEach((element) => observerRef.current?.observe(element));
    return () => observerRef.current?.disconnect();
  }, []);
  return (
    <div data-navbar-theme="dark" className="relative overflow-hidden rounded-t-[28px] bg-[#0d1020] pt-12 text-white md:hidden">
      <div aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_50%_12%,rgba(104,66,245,.22),transparent_28%),linear-gradient(180deg,#171a2e,#0d1020)]" />
      <BackgroundPaths reducedMotion={reducedMotion} pathCount={11} className="opacity-65" />
      <div className="relative px-5 text-center">
        <p className="text-[10px] font-semibold uppercase text-[#aa96ff]">See LeadReacher in action</p>
        <h2 className="mx-auto mt-3 max-w-sm text-balance text-3xl font-semibold leading-tight text-white">We handle everything. You close the deal.</h2>
        <p className="mx-auto mt-4 max-w-sm text-sm leading-6 text-white/55">Follow the full journey from your website to a qualified conversation.</p>
      </div>
      <nav aria-label="Workflow progress" className="sticky top-14 z-20 mx-4 my-8 overflow-hidden rounded-full border border-white/12 bg-[#171a2e]/90 p-1 shadow-lg backdrop-blur-xl">
        <div className="grid grid-cols-5">{STAGES.map((stage, index) => <a key={stage.id} href={`#mobile-story-${stage.id}`} aria-current={index === activeIndex ? "step" : undefined} aria-label={`${index + 1}, ${stage.label}`} className={cn("flex min-h-10 items-center justify-center rounded-full text-[10px] font-semibold text-white/55 transition-colors", index === activeIndex && "bg-[#6842f5] text-white shadow-[0_6px_18px_rgba(104,66,245,.35)]")}>{index + 1}</a>)}</div>
      </nav>
      <div className="relative px-5 pb-16">
        <span aria-hidden className="absolute bottom-20 left-[34px] top-4 w-px bg-gradient-to-b from-[#765cf0] via-white/16 to-transparent" />
        <div className="space-y-16">{STAGES.map((stage, index) => <article id={`mobile-story-${stage.id}`} key={stage.id} className="relative scroll-mt-28 pl-11"><span aria-hidden className={cn("absolute left-0 top-0 flex size-7 items-center justify-center rounded-full border text-[10px] font-semibold", index <= activeIndex ? "border-[#927df8] bg-[#6842f5] text-white shadow-[0_0_20px_rgba(104,66,245,.4)]" : "border-white/15 bg-[#171a2e] text-white/45")}>{index + 1}</span><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#aa96ff]">{stage.eyebrow}</p><h3 className="mt-2 text-balance text-2xl font-semibold leading-tight text-white">{stage.title}</h3><p className="mt-3 text-sm leading-6 text-white/60">{stage.description}</p><div className="mt-5 aspect-[16/11] overflow-hidden rounded-2xl border border-white/12 bg-white shadow-[0_24px_60px_rgba(0,0,0,0.32)]"><StagePreview stageId={stage.id} reducedMotion onStageChange={selectStage} /></div><div className="mt-4 flex items-center gap-2 text-xs font-medium text-white/75"><CheckCircle2 className="size-4 text-emerald-400" aria-hidden />{stage.result}</div></article>)}</div>
      </div>
    </div>
  );
}

export default function ProductStorySection() {
  return (
    <section data-navbar-theme="light" className="landing-light-surface relative z-[5] overflow-clip text-[#111527]">
      <div aria-hidden style={{ maskImage: "linear-gradient(to bottom, transparent, black 128px)" }} className="pointer-events-none absolute inset-x-0 bottom-0 top-20 hero-ambient-gradient sm:top-26 lg:top-32" />
      <div aria-hidden style={{ maskImage: "linear-gradient(to bottom, transparent, black 128px)" }} className="pointer-events-none absolute inset-x-0 bottom-0 top-20 bg-[radial-gradient(circle_at_50%_35%,rgba(255,255,255,0.34),transparent_46%)] sm:top-26 lg:top-32" />
      <HeroSectionBreak />
      <span id="how-it-works" className="absolute top-28 scroll-mt-24 sm:top-32 lg:top-36" aria-hidden />
      <span id="product" className="absolute top-0 scroll-mt-24" aria-hidden />
      <div className="relative">
        <AcquisitionShowcase />
        <DesktopStory />
        <MobileStory />
      </div>
    </section>
  );
}
