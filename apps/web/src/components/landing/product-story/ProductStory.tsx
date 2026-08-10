"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, m, useReducedMotion } from "framer-motion";
import {
  Check,
  CheckCircle2,
} from "lucide-react";
import { ContainerScroll } from "@/components/ui/container-scroll-animation";
import { EdgeSurface } from "@/components/ui/edge-surface";
import { BackgroundPaths } from "@/components/ui/background-paths";
import { WorkflowStepper } from "@/components/ui/workflow-stepper";
import AcquisitionShowcase from "./AcquisitionShowcase";
import HeroBreak from "@/components/landing/hero/HeroBreak";
import { InteractiveDashboardDemo } from "./InteractiveDashboardDemo";
import {
  PRODUCT_STORY_STAGE_IDS,
  progressForStageIndex,
  stageIndexForProgress,
  type ProductStoryStageId,
} from "@/lib/product-story";
import { cn } from "@/lib/utils";
import { PRODUCT_STORY_STAGES as STAGES, type ProductStoryStage } from "./content";

function StoryHeading({ className }: { className?: string }) {
  return (
    <div className={cn("text-center", className)}>
      <p className="text-xs font-semibold uppercase text-[#aa96ff] 2xl:text-sm large-desktop:text-[0.9375rem]">See LeadReacher in action</p>
      <h2 className="mx-auto mt-3 max-w-4xl text-balance text-4xl font-semibold text-white lg:text-5xl 2xl:text-6xl large-desktop:max-w-5xl large-desktop:text-[4.125rem]">We handle everything. You close the deal.</h2>
      <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-white/55 lg:text-base large-desktop:max-w-3xl large-desktop:text-lg large-desktop:leading-7">Follow the full journey from your website to a qualified conversation.</p>
    </div>
  );
}

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

function WorkflowScene({ stage, activeIndex, reducedMotion, onSelect }: { stage: ProductStoryStage; activeIndex: number; reducedMotion: boolean; onSelect: (index: number) => void }) {
  return (
    <div className="grid min-h-0 flex-1 grid-cols-[0.4fr_1.6fr] items-center gap-5 px-5 pb-5 lg:gap-8 lg:px-8 lg:pb-8">
      <div className="flex min-w-0 self-stretch flex-col justify-center py-5 lg:py-7">
        <AnimatePresence mode="wait" initial={false}>
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
  const storyBackground = (
    <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_30%,rgba(91,57,213,.24),transparent_42%),linear-gradient(180deg,#15182a_0%,#0d1020_48%,#111426_100%)]">
      <BackgroundPaths reducedMotion={reducedMotion} pathCount={12} className="opacity-95" />
    </div>
  );
  const workflow = (
    <div className="flex h-full flex-col">
      <WorkflowStepper
        items={STAGES}
        activeIndex={activeIndex}
        onSelect={selectStage}
        ariaLabel="LeadReacher workflow stages"
      />
      <WorkflowScene stage={activeStage} activeIndex={activeIndex} reducedMotion={reducedMotion} onSelect={selectStage} />
    </div>
  );

  return (
    <EdgeSurface as="div" tone="dark" data-navbar-theme="dark" className="hidden overflow-visible text-white md:block">
      <ContainerScroll backgroundComponent={storyBackground} className="relative h-[460vh] min-h-[3000px]" contentClassName="aspect-[16/10] max-w-[1240px] rounded-[28px] border border-white/12 bg-[#111426]/94 shadow-[0_28px_72px_rgba(0,0,0,.34),0_0_56px_rgba(102,72,233,.1)] large-desktop:max-w-[1360px]" id="product-story-scroll" onProgress={handleProgress} reducedMotion={reducedMotion} titleComponent={<StoryHeading className="pt-24 lg:pt-28 large-desktop:pt-32" />}>
        {workflow}
      </ContainerScroll>
    </EdgeSurface>
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
    <EdgeSurface as="div" tone="dark" data-navbar-theme="dark" className="pt-12 text-white md:hidden">
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
    </EdgeSurface>
  );
}

export default function ProductStory() {
  return (
    <section data-navbar-theme="light" className="landing-light-surface relative z-[5] overflow-clip text-[#111527] md:overflow-visible">
      <div aria-hidden style={{ maskImage: "linear-gradient(to bottom, transparent, black 128px)" }} className="pointer-events-none absolute inset-x-0 bottom-0 top-20 hero-ambient-gradient sm:top-26 lg:top-32" />
      <div aria-hidden style={{ maskImage: "linear-gradient(to bottom, transparent, black 128px)" }} className="pointer-events-none absolute inset-x-0 bottom-0 top-20 bg-[radial-gradient(circle_at_50%_35%,rgba(255,255,255,0.34),transparent_46%)] sm:top-26 lg:top-32" />
      <HeroBreak />
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
