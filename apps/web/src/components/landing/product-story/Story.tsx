"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { AnimatePresence, m, useReducedMotion } from "framer-motion";
import {
  Check,
  CheckCircle2,
  Link2,
  MessageSquare,
  Pencil,
  Search,
  Send,
  UsersRound,
  Zap,
  type AppIcon,
} from "@/components/ui/icons";
import { ContainerScroll } from "@/components/ui/container-scroll-animation";
import { EdgeSurface } from "@/components/ui/edge-surface";
import { BackgroundPaths } from "@/components/ui/background-paths";
import { WorkflowStepper } from "@/components/ui/workflow-stepper";
import ShimmerText from "@/components/ui/shimmer-text";
import Showcase from "./Showcase";
import Break from "@/components/landing/hero/Break";
import Brands from "./Brands";
import { Demo } from "./Demo";
import {
  progressForStageIndex,
  stageIndexForProgress,
  type ProductStoryStageId,
} from "@/lib/product-story";
import { cn } from "@/lib/utils";
import { PRODUCT_STORY_STAGES as STAGES, type ProductStoryStage } from "./content";

type SideStoryItem = {
  icon: AppIcon;
  text: string;
  detail?: string;
  active?: boolean;
};

type SideStoryCopy = {
  eyebrow: string;
  titleLines: readonly string[];
  accentLine?: string;
  description: string;
  items: readonly SideStoryItem[];
};

const PRODUCT_STORY_SHIMMER_STYLE = {
  "--lr-shimmer-base": "#7d5cff",
  "--lr-shimmer-core": "#58a6ff",
  "--lr-shimmer-edge": "rgba(125, 183, 255, 0.8)",
} as CSSProperties;

const SIDE_STORY_COPY: Record<ProductStoryStageId, SideStoryCopy> = {
  website: {
    eyebrow: "01 · Strategy",
    titleLines: ["Drop your URL.", "LeadReacher learns your business."],
    description: "It analyzes your market, ideal customer and positioning to build a custom acquisition strategy.",
    items: [{ icon: Link2, text: "Your URL is all it needs.", detail: "LeadReacher does the rest." }],
  },
  strategy: {
    eyebrow: "02 · Prospects",
    titleLines: ["Review and approve", "your prospects."],
    description: "LeadReacher scrapes the web for high-value prospects matched to your business and strategy.",
    items: [{ icon: UsersRound, text: "All prospects have intent to buy or are relevant to your business." }],
  },
  prospects: {
    eyebrow: "03 · Content",
    titleLines: ["Generates unique,", "world-class content"],
    accentLine: "in seconds.",
    description: "Professional video ads and sales-focused messaging, built around your business and ready to convert.",
    items: [
      { icon: Zap, text: "Pick one." },
      { icon: Pencil, text: "Edit if you want." },
      { icon: Check, text: "Approve when ready." },
    ],
  },
  outreach: {
    eyebrow: "04 · Outreach",
    titleLines: ["Finds the right channels.", "Messages your prospects."],
    accentLine: "Automatically.",
    description: "LeadReacher connects to the major social channels through approved APIs. We find where your prospects are, you approve, and we handle the outreach.",
    items: [
      { icon: Search, text: "We find." },
      { icon: Check, text: "You approve." },
      { icon: Send, text: "We send." },
    ],
  },
  conversations: {
    eyebrow: "05 · Conversations",
    titleLines: ["Qualified replies", "come to you."],
    accentLine: "You close.",
    description: "Interested prospects reply directly in your connected channels. You jump in, continue the conversation, and close more deals.",
    items: [
      { icon: Search, text: "We find." },
      { icon: Check, text: "You approve." },
      { icon: Send, text: "We send." },
      { icon: MessageSquare, text: "You close.", active: true },
    ],
  },
};

function StoryHeading({ className }: { className?: string }) {
  return (
    <div className={cn("product-story-heading text-center", className)}>
      <p className="text-xs font-semibold uppercase text-[#aa96ff] 2xl:text-sm large-desktop:text-[0.9375rem]">See LeadReacher in action</p>
      <h2 className="mx-auto mt-3 max-w-4xl text-balance text-4xl font-semibold text-white lg:text-5xl 2xl:text-6xl large-desktop:max-w-5xl large-desktop:text-[4.125rem]">Leadreacher.ai brings the <ShimmerText duration={3.6} style={PRODUCT_STORY_SHIMMER_STYLE}>leads to you.</ShimmerText></h2>
      <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-white/80 lg:text-base large-desktop:max-w-3xl large-desktop:text-lg large-desktop:leading-7">Simply reply and close deals.</p>
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
    <Demo
      stageId={stageId}
      reducedMotion={reducedMotion}
      onStageChange={onStageChange}
    />
  );
}

function StageSideCopy({ stageId }: { stageId: ProductStoryStageId }) {
  const copy = SIDE_STORY_COPY[stageId];

  return (
    <div className="product-story-side-copy min-w-0">
      <p className="text-[11px] font-medium uppercase tracking-[0.04em] text-[#aa55ff] lg:text-xs xl:text-sm">{copy.eyebrow}</p>
      <h3 className="mt-2.5 text-[1.35rem] font-semibold leading-[1.18] tracking-[-0.025em] text-white lg:text-[1.55rem] xl:text-[1.75rem] 2xl:mt-4 2xl:text-[2rem]">
        {copy.titleLines.map((line) => <span key={line} className="block">{line}</span>)}
        {copy.accentLine ? <span className="block"><ShimmerText duration={3.6} style={PRODUCT_STORY_SHIMMER_STYLE}>{copy.accentLine}</ShimmerText></span> : null}
      </h3>
      <p className="mt-3 max-w-[29ch] text-[12px] leading-5 text-white/68 lg:text-[13px] xl:text-sm xl:leading-6 2xl:mt-5 2xl:text-[15px] 2xl:leading-7">{copy.description}</p>
      <div aria-hidden className="mt-4 h-px w-full bg-gradient-to-r from-[#cb5aae]/70 via-[#9a589c]/40 to-white/8 2xl:mt-6" />
      <div className="mt-3 space-y-2 xl:space-y-2.5 2xl:mt-5 2xl:space-y-3">
        {copy.items.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.text} className={cn("flex items-center gap-3 text-[12px] leading-5 text-white/82 lg:text-[13px] xl:text-sm 2xl:gap-4 2xl:text-base", item.active && "font-semibold text-white")}>
              <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-full border border-[#d16ab7]/65 bg-[#3d174a]/16 text-[#f0a1dc] shadow-[inset_0_0_18px_rgba(164,65,228,.08)] lg:size-9 2xl:size-11", item.active && "border-[#9c70ff] bg-[#6237dc] text-white shadow-[0_0_0_5px_rgba(113,75,238,.13),0_0_24px_rgba(112,69,244,.6)]")}>
                <Icon className="size-4 2xl:size-5" weight="regular" aria-hidden />
              </span>
              <span>
                <span className={cn("block", item.detail && "font-semibold text-white")}>{item.text}</span>
                {item.detail ? <span className="block text-white/62">{item.detail}</span> : null}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WorkflowScene({ stage, reducedMotion, onSelect }: { stage: ProductStoryStage; reducedMotion: boolean; onSelect: (index: number) => void }) {
  return (
    <div className="product-story-workflow grid min-h-0 flex-1 grid-cols-[minmax(0,0.4fr)_minmax(0,1.6fr)] grid-rows-[minmax(0,1fr)] items-center gap-5 px-5 pb-5 lg:gap-8 lg:px-8 lg:pb-8">
      <div className="product-story-copy-column flex min-w-0 self-stretch flex-col justify-center overflow-hidden py-3 lg:py-4 2xl:py-6">
        <AnimatePresence mode="wait" initial={false}>
          <m.div
            key={stage.id}
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -12 }}
            transition={{ duration: reducedMotion ? 0.1 : 0.34, ease: "easeOut" }}
          >
            <StageSideCopy stageId={stage.id} />
          </m.div>
        </AnimatePresence>
      </div>

      <div className="product-story-tablet-column relative min-h-0 self-stretch py-1 lg:py-2">
        <m.div
          className="relative mx-auto flex h-full w-full max-w-[920px] shrink-0 overflow-hidden rounded-[26px] border border-white/20 bg-[#070812] p-2 shadow-[0_28px_90px_rgba(0,0,0,.48),0_0_70px_rgba(102,72,233,.16)] [backface-visibility:hidden] [transform:translateZ(0)] lg:rounded-[34px] lg:p-3"
        >
          <span aria-hidden className="absolute left-1/2 top-1.5 z-30 h-1 w-10 -translate-x-1/2 rounded-full bg-white/20 lg:top-2 lg:h-1.5 lg:w-14" />
          <span aria-hidden className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-inset ring-white/10" />
          <div id="product-story-panel" role="tabpanel" aria-labelledby={`product-story-tab-${stage.id}`} className="relative h-full min-h-0 w-full flex-1 overflow-hidden rounded-[19px] bg-[#f7f7fb] lg:rounded-[24px]">
            <m.div
              key={stage.id}
              className="absolute inset-0 size-full [backface-visibility:hidden] [transform:translateZ(0)]"
              initial={reducedMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: reducedMotion ? 0 : 0.18, ease: "easeOut" }}
            >
              <Demo
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
        {stage.id !== "website" && stage.id !== "strategy" && stage.id !== "prospects" && stage.id !== "outreach" && stage.id !== "conversations" ? (
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
        ) : null}
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
      <StoryHeading className="shrink-0 px-5 pt-4 lg:pt-5" />
      <WorkflowStepper
        items={STAGES}
        activeIndex={activeIndex}
        onSelect={selectStage}
        ariaLabel="LeadReacher workflow stages"
      />
      <WorkflowScene stage={activeStage} reducedMotion={reducedMotion} onSelect={selectStage} />
    </div>
  );

  return (
    <EdgeSurface as="div" tone="dark" data-navbar-theme="dark" className="hidden overflow-visible text-white md:block">
      <ContainerScroll backgroundComponent={storyBackground} className="relative h-[460vh] min-h-[3000px]" contentClassName="product-story-frame aspect-[16/11] max-w-[1240px] rounded-[28px] border border-white/12 bg-[#111426]/94 shadow-[0_28px_72px_rgba(0,0,0,.34),0_0_56px_rgba(102,72,233,.1)] large-desktop:max-w-[1360px]" disableFrameTransform id="product-story-scroll" onProgress={handleProgress} reducedMotion={reducedMotion}>
        {workflow}
      </ContainerScroll>
    </EdgeSurface>
  );
}

function MobileStory() {
  const reducedMotion = Boolean(useReducedMotion());
  const [activeIndex, setActiveIndex] = useState(0);
  const selectStage = useCallback((stageId: ProductStoryStageId) => {
    const stageIndex = STAGES.findIndex((stage) => stage.id === stageId);
    if (stageIndex < 0) return;
    setActiveIndex(stageIndex);
  }, []);
  const handleRailKeyDown = useCallback((event: KeyboardEvent<HTMLElement>) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    const focusedIndex = tabs.indexOf(document.activeElement as HTMLButtonElement);
    const currentIndex = focusedIndex >= 0 ? focusedIndex : activeIndex;
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? STAGES.length - 1
        : (currentIndex + (event.key === "ArrowRight" ? 1 : -1) + STAGES.length) % STAGES.length;
    selectStage(STAGES[nextIndex].id);
    tabs[nextIndex]?.focus();
  }, [activeIndex, selectStage]);
  const activeStage = STAGES[activeIndex];
  const activeCopy = SIDE_STORY_COPY[activeStage.id];

  return (
    <EdgeSurface as="div" tone="dark" data-navbar-theme="dark" className="overflow-hidden py-14 text-white md:hidden sm:py-16">
      <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_8%,rgba(103,68,235,.28),transparent_30%),radial-gradient(ellipse_at_50%_72%,rgba(86,62,195,.16),transparent_42%),linear-gradient(180deg,#171a34_0%,#0c1025_56%,#090c1d_100%)]" />
      <BackgroundPaths reducedMotion={reducedMotion} pathCount={6} colors={["#9b7cff", "#755ee3"]} className="opacity-35" />
      <div id="mobile-product-story-scroll" className="relative mx-auto w-full max-w-md px-5">
        <header className="text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#ad97ff]">See LeadReacher in action</p>
          <h2 className="mx-auto mt-4 max-w-[22rem] text-balance text-[2.35rem] font-semibold leading-[0.98] tracking-[-0.045em] text-white">Leadreacher.ai brings the <ShimmerText duration={3.6} style={PRODUCT_STORY_SHIMMER_STYLE}>leads to you.</ShimmerText></h2>
          <p className="mx-auto mt-5 max-w-xs text-[15px] leading-6 text-white/74">Simply reply and close deals.</p>
        </header>

        <nav aria-label="Workflow progress" onKeyDown={handleRailKeyDown} className="relative mt-10">
          <span aria-hidden className="absolute left-[10%] right-[10%] top-4 h-px bg-white/16" />
          <m.span
            aria-hidden
            className="absolute left-[10%] top-4 h-px origin-left bg-gradient-to-r from-[#a284ff] via-[#704af5] to-[#7c64fa]"
            animate={{ scaleX: activeIndex / (STAGES.length - 1) }}
            transition={{ duration: reducedMotion ? 0 : 0.28, ease: "easeOut" }}
            style={{ width: "80%" }}
          />
          <div role="tablist" aria-label="LeadReacher workflow stages" className="relative grid grid-cols-5 gap-1">
            {STAGES.map((stage, index) => {
              const isActive = index === activeIndex;
              const isComplete = index < activeIndex;
              return (
                <button
                  key={stage.id}
                  id={`mobile-story-tab-${stage.id}`}
                  type="button"
                  role="tab"
                  tabIndex={isActive ? 0 : -1}
                  aria-label={`${stage.label}, step ${index + 1} of ${STAGES.length}`}
                  aria-selected={isActive}
                  aria-controls="mobile-story-panel"
                  onClick={() => selectStage(stage.id)}
                  className={cn("group flex min-h-[76px] min-w-0 flex-col items-center rounded-lg text-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c0adff]", isActive && "text-white")}
                >
                  <span className={cn("relative z-10 flex size-8 items-center justify-center rounded-full border text-[11px] font-semibold transition-colors", isActive ? "border-[#c0adff] bg-[#7651f5] text-white shadow-[0_0_0_5px_rgba(120,82,245,.16),0_0_22px_rgba(128,94,255,.46)]" : isComplete ? "border-[#9479ee] bg-[#2b2552] text-[#d4c9ff]" : "border-white/20 bg-[#12172e] text-white/48 group-hover:border-white/40") }>
                    {isComplete ? <Check className="size-4" weight="bold" aria-hidden /> : <span aria-hidden>{index + 1}</span>}
                  </span>
                  <span className={cn("mt-2 line-clamp-2 text-[9px] font-semibold uppercase leading-3 tracking-[0.025em]", isActive || isComplete ? "text-white" : "text-white/52")}>{stage.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
        <p aria-live="polite" aria-atomic="true" className="sr-only">{activeStage.label} selected. {activeStage.result}.</p>

        <AnimatePresence mode="wait" initial={false}>
          <m.div
            id="mobile-story-panel"
            key={activeStage.id}
            role="tabpanel"
            aria-labelledby={`mobile-story-tab-${activeStage.id}`}
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
            transition={{ duration: reducedMotion ? 0.1 : 0.26, ease: "easeOut" }}
            className="mt-7"
          >
            <div className="mb-4 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#b09bff]">{activeCopy.eyebrow}</p>
              <h3 className="mx-auto mt-2 max-w-[21rem] text-balance text-[1.45rem] font-semibold leading-[1.1] tracking-[-0.035em] text-white">
                {activeCopy.titleLines.map((line) => <span key={line} className="block">{line}</span>)}
                {activeCopy.accentLine ? <span className="block"><ShimmerText duration={3.6} style={PRODUCT_STORY_SHIMMER_STYLE}>{activeCopy.accentLine}</ShimmerText></span> : null}
              </h3>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-5 text-white/68">{activeCopy.description}</p>
              <p className="mx-auto mt-3 max-w-sm text-xs font-medium leading-5 text-white/84">
                {activeCopy.items.map((item) => [item.text, item.detail].filter(Boolean).join(" ")).join(" ")}
              </p>
            </div>
            <div className="aspect-[0.88] overflow-hidden rounded-[26px] border border-white/70 bg-white shadow-[0_24px_64px_rgba(1,4,20,.48),0_0_0_1px_rgba(157,134,255,.14)]">
              <StagePreview stageId={activeStage.id} reducedMotion={reducedMotion} onStageChange={selectStage} />
            </div>
            <p className="mt-4 flex items-center justify-center gap-2 text-center text-xs font-medium text-white/76">
              <CheckCircle2 className="size-4 shrink-0 text-emerald-300" aria-hidden />{activeStage.result}
            </p>
          </m.div>
        </AnimatePresence>
      </div>
    </EdgeSurface>
  );
}

export default function Story() {
  return (
    <section data-navbar-theme="light" className="relative z-[5] overflow-clip bg-white text-[#111527] md:overflow-visible">
      <Break />
      <span id="how-it-works" className="absolute top-28 scroll-mt-24 sm:top-32 lg:top-36" aria-hidden />
      <span id="product" className="absolute top-0 scroll-mt-24" aria-hidden />
      <div className="relative bg-white">
        <Brands />
        <Showcase />
        <DesktopStory />
        <MobileStory />
      </div>
    </section>
  );
}
