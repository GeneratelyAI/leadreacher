"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { AnimatePresence, m, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  Building2,
  CalendarCheck2,
  Check,
  CheckCircle2,
  CircleUserRound,
  Globe2,
  Search,
  Sparkles,
  Target,
} from "lucide-react";
import { siWhatsapp } from "simple-icons";
import { ContainerScroll } from "@/components/ui/container-scroll-animation";
import AcquisitionShowcase from "./AcquisitionShowcase";
import HeroSectionBreak from "@/components/landing/hero/HeroSectionBreak";
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
};

const STAGES: readonly Stage[] = [
  {
    id: "website",
    label: "Website",
    eyebrow: "01 · Understand",
    title: "We learn what makes your business different.",
    description: "LeadReacher reads your website and turns the important details into a usable acquisition brief.",
  },
  {
    id: "strategy",
    label: "Strategy",
    eyebrow: "02 · Plan",
    title: "We build a focused route to your buyers.",
    description: "Your offer becomes a clear audience, positioning angle, and channel plan before outreach begins.",
  },
  {
    id: "prospects",
    label: "Prospects",
    eyebrow: "03 · Review",
    title: "You see the real people we plan to contact.",
    description: "Review, approve, or exclude prospects before anyone is enrolled in a campaign.",
  },
  {
    id: "outreach",
    label: "Outreach",
    eyebrow: "04 · Reach",
    title: "Every message follows an approved sequence.",
    description: "LeadReacher coordinates personalized follow-ups across the channels your prospects actually use.",
  },
  {
    id: "conversations",
    label: "Conversations",
    eyebrow: "05 · Convert",
    title: "You step in when the prospect is ready.",
    description: "Interested replies arrive in Chat with their campaign, channel, and conversation context intact.",
  },
] as const;

const CHANNEL_IMAGES = {
  linkedin: "/landing/linkedin-logo.webp",
  instagram: "/landing/instagram-logo.webp",
  facebook: "/landing/facebook-logo.webp",
  gmail: "/landing/gmail-logo.webp",
  outlook: "/landing/outlook-logo.webp",
} as const;

const DASHBOARD_STAGE_IMAGES: Record<ProductStoryStageId, { src: string; alt: string }> = {
  website: { src: "/landing/product-story/website.png", alt: "LeadReacher overview dashboard showing acquisition progress and live campaign activity" },
  strategy: { src: "/landing/product-story/strategy.png", alt: "LeadReacher analytics dashboard showing campaign and channel performance" },
  prospects: { src: "/landing/product-story/prospects.png", alt: "LeadReacher prospects dashboard with review and lifecycle states" },
  outreach: { src: "/landing/product-story/outreach.png", alt: "LeadReacher campaigns dashboard showing draft, running, and completed outreach" },
  conversations: { src: "/landing/product-story/conversations.png", alt: "LeadReacher inbox showing a prospect conversation and reply composer" },
};

function ChannelLogo({ channel, size = "md" }: { channel: keyof typeof CHANNEL_IMAGES | "whatsapp"; size?: "sm" | "md" }) {
  const dimensions = size === "sm" ? "size-4" : "size-6";
  if (channel === "whatsapp") {
    return (
      <span className={cn("inline-flex items-center justify-center rounded-md bg-[#25D366] p-1 text-white", dimensions)} aria-hidden>
        <svg viewBox="0 0 24 24" className="size-full fill-current" aria-hidden><path d={siWhatsapp.path} /></svg>
      </span>
    );
  }
  return <Image src={CHANNEL_IMAGES[channel]} width={24} height={24} alt={`${channel} logo`} className={cn(dimensions, "object-contain")} />;
}

function ProductShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-[#fbfbfe] text-[#171b2c]">
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-[#e7e5ef] bg-white px-3 sm:h-11 sm:px-5">
        <div className="flex items-center gap-1.5" aria-hidden>
          <span className="size-2 rounded-full bg-[#ef7d77]" />
          <span className="size-2 rounded-full bg-[#efc866]" />
          <span className="size-2 rounded-full bg-[#75c98c]" />
        </div>
        <div className="flex items-center gap-2 text-[9px] font-semibold text-[#383d50] sm:text-xs">
          <Image src="/logo/leadreacher_plane_only.svg" width={18} height={18} alt="" className="size-3 sm:size-4" />
          LeadReacher workspace
        </div>
        <span className="rounded-full bg-[#efeafe] px-2 py-0.5 text-[8px] font-semibold text-[#4e28df] sm:text-[10px]">LIVE PREVIEW</span>
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}

function WebsitePreview() {
  return (
    <ProductShell>
      <div className="grid h-full grid-cols-[0.82fr_1.18fr] gap-3 p-3 sm:gap-6 sm:p-7">
        <div className="flex min-w-0 flex-col justify-center">
          <span className="text-[9px] font-semibold uppercase text-[#6b5bc7] sm:text-xs">Website analysis</span>
          <h3 className="mt-1 text-base font-semibold text-[#171b2c] sm:mt-2 sm:text-2xl">Generately</h3>
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-[#ddd9ed] bg-white px-2.5 py-2 text-[9px] text-[#62697d] shadow-sm sm:mt-5 sm:rounded-xl sm:px-4 sm:py-3 sm:text-sm">
            <Globe2 className="size-3.5 text-[#4e28df] sm:size-4" aria-hidden /> generately.ai
            <CheckCircle2 className="ml-auto size-3.5 text-emerald-500 sm:size-4" aria-hidden />
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#ebe9f4] sm:mt-5">
            <m.div className="h-full rounded-full bg-[#4e28df]" initial={{ width: "18%" }} animate={{ width: "100%" }} transition={{ duration: 1.4, ease: "easeOut" }} />
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-[9px] font-medium text-[#4e28df] sm:text-xs"><Sparkles className="size-3" /> Business understood</p>
        </div>
        <div className="flex min-w-0 flex-col justify-center gap-2 sm:gap-3">
          {[
            ["What they do", "Integrated social and web production for growing businesses"],
            ["Best fit", "Growth teams that need consistent execution"],
            ["Positioning", "Keep teams focused on growth while production stays coordinated"],
          ].map(([label, value], index) => (
            <m.div key={label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 + index * 0.12 }} className="rounded-lg border border-[#e4e1ef] bg-white p-2.5 shadow-[0_5px_20px_rgba(56,43,107,0.05)] sm:rounded-xl sm:p-4">
              <p className="text-[8px] font-semibold uppercase text-[#626879] sm:text-[10px]">{label}</p>
              <p className="mt-1 text-[9px] font-medium leading-tight text-[#282d40] sm:text-sm sm:leading-5">{value}</p>
            </m.div>
          ))}
        </div>
      </div>
    </ProductShell>
  );
}

function StrategyPreview() {
  const items = [
    { label: "Target market", value: "B2B service companies", icon: Building2 },
    { label: "Decision makers", value: "Founder · Head of Growth", icon: CircleUserRound },
    { label: "Company criteria", value: "11–200 employees", icon: Target },
  ];
  return (
    <ProductShell>
      <div className="flex h-full flex-col p-3 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div><p className="text-[9px] font-semibold uppercase text-[#6b5bc7] sm:text-xs">Generated strategy</p><h3 className="mt-1 text-sm font-semibold sm:text-xl">Reach teams ready to consolidate growth work.</h3></div>
          <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-1 text-[8px] font-semibold text-emerald-700 sm:text-[10px]">READY TO REVIEW</span>
        </div>
        <div className="mt-3 grid flex-1 grid-cols-3 gap-2 sm:mt-6 sm:gap-4">
          {items.map(({ label, value, icon: Icon }, index) => (
            <m.div key={label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.1 }} className="flex min-w-0 flex-col justify-center rounded-lg border border-[#e4e1ef] bg-white p-2 sm:rounded-xl sm:p-4">
              <Icon className="size-4 text-[#4e28df] sm:size-6" aria-hidden /><p className="mt-2 text-[8px] text-[#626879] sm:text-xs">{label}</p><p className="mt-1 text-[9px] font-semibold leading-tight sm:text-sm">{value}</p>
            </m.div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2 border-t border-[#e4e1ef] pt-3 sm:mt-5 sm:gap-4 sm:pt-4">
          <span className="text-[8px] font-medium text-[#5f6576] sm:text-xs">Recommended channels</span>
          {(["linkedin", "whatsapp", "instagram", "gmail"] as const).map((channel) => <ChannelLogo key={channel} channel={channel} size="sm" />)}
        </div>
      </div>
    </ProductShell>
  );
}

const PROSPECTS = [
  ["Hannah Lewis", "VP Commercial", "Common Thread", "Approved"],
  ["Caleb Young", "Chief Operating Officer", "Atlas Vertex", "Approved"],
  ["Zara Patel", "Marketing Director", "Meridian Group", "Pending"],
  ["Noah Wilson", "Founder", "Ridgeway AI", "Approved"],
] as const;

function ProspectsPreview() {
  return (
    <ProductShell>
      <div className="flex h-full flex-col p-2.5 sm:p-5">
        <div className="flex items-center gap-2"><div className="flex h-7 flex-1 items-center gap-2 rounded-lg border border-[#e1deeb] bg-white px-2.5 text-[8px] text-[#858a9a] sm:h-9 sm:px-3 sm:text-xs"><Search className="size-3" /> Search prospects</div><span className="rounded-lg bg-[#4e28df] px-2.5 py-2 text-[8px] font-semibold text-white sm:px-4 sm:text-xs">Review selected</span></div>
        <div className="mt-2 overflow-hidden rounded-lg border border-[#e2dfeb] bg-white sm:mt-4 sm:rounded-xl">
          <div className="grid grid-cols-[1.35fr_1fr_.7fr] bg-[#f6f5fa] px-2 py-1.5 text-[7px] font-semibold text-[#74798a] sm:px-4 sm:py-2.5 sm:text-[10px]"><span>Prospect</span><span>Company</span><span>Review</span></div>
          {PROSPECTS.map(([name, role, company, status], index) => (
            <m.div key={name} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.08 }} className="grid grid-cols-[1.35fr_1fr_.7fr] items-center border-t border-[#eeecf3] px-2 py-1.5 sm:px-4 sm:py-2.5">
              <div className="flex min-w-0 items-center gap-1.5 sm:gap-2"><span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[#eee9ff] text-[7px] font-semibold text-[#4e28df] sm:size-7 sm:text-[9px]">{name.split(" ").map((part) => part[0]).join("")}</span><span className="min-w-0"><span className="block truncate text-[8px] font-semibold sm:text-xs">{name}</span><span className="block truncate text-[7px] text-[#7b8091] sm:text-[10px]">{role}</span></span></div>
              <span className="truncate text-[8px] sm:text-xs">{company}</span>
              <span className={cn("w-fit rounded-full px-1.5 py-0.5 text-[7px] font-semibold sm:px-2 sm:text-[9px]", status === "Approved" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700")}>{status}</span>
            </m.div>
          ))}
        </div>
        <div className="mt-auto flex items-center justify-between pt-2 text-[8px] text-[#767b8b] sm:pt-3 sm:text-[10px]"><span>4 of 124 prospects</span><span className="font-semibold text-[#4e28df]">Reviewable before launch</span></div>
      </div>
    </ProductShell>
  );
}

function OutreachPreview() {
  const steps = [
    ["Connection note", "A short introduction based on their role", "LinkedIn"],
    ["Value follow-up", "A relevant reason to continue the conversation", "LinkedIn"],
    ["Helpful reminder", "A concise follow-up through an available channel", "Multi-channel"],
  ] as const;
  return (
    <ProductShell>
      <div className="grid h-full grid-cols-[1.15fr_.85fr] gap-3 p-3 sm:gap-5 sm:p-6">
        <div className="min-w-0"><p className="text-[9px] font-semibold uppercase text-[#6b5bc7] sm:text-xs">Approved sequence</p><div className="mt-2 space-y-1.5 sm:mt-4 sm:space-y-2.5">{steps.map(([title, text, channel], index) => <m.div key={title} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.12 }} className="flex gap-2 rounded-lg border border-[#e4e1ef] bg-white p-2 sm:gap-3 sm:rounded-xl sm:p-3"><span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[#4e28df] text-[8px] font-semibold text-white sm:size-7 sm:text-[10px]">{index + 1}</span><span className="min-w-0"><span className="flex items-center gap-2 text-[8px] font-semibold sm:text-xs">{title}<span className="hidden font-normal text-[#7b8091] sm:inline">{channel}</span></span><span className="mt-0.5 block truncate text-[7px] text-[#7b8091] sm:mt-1 sm:text-[10px]">{text}</span></span></m.div>)}</div></div>
        <div className="flex min-w-0 flex-col rounded-lg border border-[#e4e1ef] bg-white p-2.5 sm:rounded-xl sm:p-4"><p className="text-[8px] font-semibold sm:text-xs">Channel routing</p><div className="mt-2 grid grid-cols-2 gap-1.5 sm:mt-4 sm:gap-2.5">{(["linkedin", "whatsapp", "instagram", "gmail", "outlook"] as const).map((channel) => <div key={channel} className="flex items-center gap-1.5 rounded-md bg-[#f7f6fb] p-1.5 text-[7px] font-medium capitalize sm:p-2 sm:text-[10px]"><ChannelLogo channel={channel} size="sm" />{channel}</div>)}</div><div className="mt-auto border-t border-[#eceaf2] pt-2 text-[7px] leading-tight text-[#6f7587] sm:pt-3 sm:text-[10px]"><Check className="mr-1 inline size-3 text-emerald-500" />You review prospects and outreach before launch.</div></div>
      </div>
    </ProductShell>
  );
}

function ConversationsPreview() {
  return (
    <ProductShell>
      <div className="grid h-full grid-cols-[.72fr_1.28fr] bg-white">
        <div className="border-r border-[#e5e2ed] p-2 sm:p-4"><div className="flex items-center justify-between"><span className="text-[9px] font-semibold sm:text-sm">Chat</span><span className="rounded-full bg-[#4e28df] px-1.5 py-0.5 text-[7px] text-white sm:text-[9px]">3</span></div><div className="mt-2 space-y-1.5 sm:mt-4 sm:space-y-2">{["Hannah Lewis", "Maya Chen", "Daniel Ortiz"].map((name, index) => <div key={name} className={cn("flex items-center gap-1.5 rounded-lg p-1.5 sm:gap-2 sm:p-2", index === 0 ? "bg-[#f0ecff]" : "bg-[#fafafd]")}><span className="flex size-5 items-center justify-center rounded-full bg-white text-[7px] font-semibold sm:size-7 sm:text-[9px]">{name.split(" ").map((part) => part[0]).join("")}</span><span className="min-w-0"><span className="block truncate text-[7px] font-semibold sm:text-[10px]">{name}</span><span className="block truncate text-[6px] text-[#7c8292] sm:text-[9px]">Inbound reply</span></span></div>)}</div></div>
        <div className="flex min-w-0 flex-col p-2.5 sm:p-5"><div className="flex items-center gap-2 border-b border-[#ebe9f1] pb-2"><span className="flex size-6 items-center justify-center rounded-full bg-[#eee9ff] text-[8px] font-semibold text-[#4e28df] sm:size-8 sm:text-[10px]">HL</span><span><span className="block text-[8px] font-semibold sm:text-xs">Hannah Lewis</span><span className="flex items-center gap-1 text-[7px] text-[#747a8c] sm:text-[9px]"><ChannelLogo channel="linkedin" size="sm" /> LinkedIn · Pipeline acceleration</span></span></div><div className="flex flex-1 flex-col justify-center gap-2 sm:gap-3"><div className="max-w-[76%] self-end rounded-xl rounded-br-sm bg-[#4e28df] px-2.5 py-2 text-[7px] leading-relaxed text-white sm:px-4 sm:py-3 sm:text-[10px]">Would a short overview of how teams consolidate this work be useful?</div><m.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="max-w-[82%] rounded-xl rounded-bl-sm bg-[#f0eff5] px-2.5 py-2 text-[7px] leading-relaxed text-[#252a3c] sm:px-4 sm:py-3 sm:text-[10px]">Yes, I would be open to learning more. Next Tuesday afternoon works.</m.div></div><m.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.7 }} className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-[7px] font-semibold text-emerald-800 sm:p-3 sm:text-[10px]"><CalendarCheck2 className="size-3.5" /> Meeting ready to book <ArrowRight className="ml-auto size-3.5" /></m.div></div>
      </div>
    </ProductShell>
  );
}

const PREVIEWS: Record<ProductStoryStageId, () => ReactNode> = {
  website: WebsitePreview,
  strategy: StrategyPreview,
  prospects: ProspectsPreview,
  outreach: OutreachPreview,
  conversations: ConversationsPreview,
};

function StagePreview({ stageId, reducedMotion }: { stageId: ProductStoryStageId; reducedMotion: boolean }) {
  const Preview = PREVIEWS[stageId];
  return (
    <AnimatePresence mode="wait" initial={false}>
      <m.div key={stageId} className="h-full" initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -10 }} transition={{ duration: reducedMotion ? 0.1 : 0.3, ease: "easeOut" }}>
        <Preview />
      </m.div>
    </AnimatePresence>
  );
}

function DashboardStageImage({ stageId, reducedMotion }: { stageId: ProductStoryStageId; reducedMotion: boolean }) {
  const image = DASHBOARD_STAGE_IMAGES[stageId];
  return (
    <AnimatePresence mode="wait" initial={false}>
      <m.div key={stageId} className="relative h-full bg-white" initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 1.015 }} animate={{ opacity: 1, scale: 1 }} exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.992 }} transition={{ duration: reducedMotion ? 0.1 : 0.38, ease: "easeOut" }}>
        <Image
          src={image.src}
          alt={image.alt}
          fill
          sizes="(min-width: 1280px) 1180px, 92vw"
          className="object-cover object-top"
        />
      </m.div>
    </AnimatePresence>
  );
}

function StageTabs({ activeIndex, onSelect }: { activeIndex: number; onSelect: (index: number) => void }) {
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const direction = event.key === "ArrowRight" ? 1 : -1;
    const nextIndex = (activeIndex + direction + STAGES.length) % STAGES.length;
    onSelect(nextIndex);
    event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')[nextIndex]?.focus();
  }
  return (
    <div role="tablist" aria-label="LeadReacher workflow stages" onKeyDown={handleKeyDown} className="relative grid grid-cols-5 border-b border-[#e6e3ed] bg-white px-1 sm:px-4">
      {STAGES.map((stage, index) => <button key={stage.id} id={`product-story-tab-${stage.id}`} role="tab" aria-selected={activeIndex === index} aria-controls="product-story-panel" tabIndex={activeIndex === index ? 0 : -1} onClick={() => onSelect(index)} className={cn("relative z-10 flex h-9 items-center justify-center px-1 text-[7px] font-semibold text-[#7b8090] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#8b7fd4] sm:h-12 sm:text-xs", activeIndex === index && "text-[#3f20ba]")}><span className="hidden sm:inline">{String(index + 1).padStart(2, "0")} · </span>{stage.label}{activeIndex === index ? <m.span layoutId="product-story-tab-indicator" className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-[#4e28df]" /> : null}</button>)}
    </div>
  );
}

function DesktopStory() {
  const reducedMotion = Boolean(useReducedMotion());
  const [activeIndex, setActiveIndex] = useState(0);
  const activeStage = STAGES[activeIndex];
  const handleProgress = useCallback((progress: number) => setActiveIndex(stageIndexForProgress(progress)), []);
  const selectStage = useCallback((index: number) => {
    setActiveIndex(index);
    const story = document.getElementById("product-story-scroll");
    if (!story) return;
    const top = story.getBoundingClientRect().top + window.scrollY;
    const scrollableDistance = Math.max(story.offsetHeight - window.innerHeight, 1);
    window.scrollTo({ top: top + progressForStageIndex(index) * scrollableDistance, behavior: reducedMotion ? "auto" : "smooth" });
  }, [reducedMotion]);
  return (
    <div data-navbar-theme="dark" className="relative hidden overflow-clip rounded-t-[36px] bg-[#0d1020] text-white md:block lg:rounded-t-[48px]">
      <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_35%,rgba(91,57,213,.2),transparent_42%),linear-gradient(180deg,#15182a_0%,#0d1020_48%,#111426_100%)]" />
      <ContainerScroll className="relative" id="product-story-scroll" onProgress={handleProgress} reducedMotion={reducedMotion} titleComponent={<div><p className="text-xs font-semibold uppercase text-[#aa96ff] 2xl:text-sm">See LeadReacher in action</p><h2 className="mx-auto mt-3 max-w-4xl text-balance text-4xl font-semibold text-white lg:text-5xl 2xl:text-6xl">We handle everything. You close the deal.</h2></div>}>
        <div className="flex h-full flex-col">
          <StageTabs activeIndex={activeIndex} onSelect={selectStage} />
          <div id="product-story-panel" role="tabpanel" aria-labelledby={`product-story-tab-${activeStage.id}`} className="relative min-h-0 flex-1 overflow-hidden">
            <DashboardStageImage stageId={activeStage.id} reducedMotion={reducedMotion} />
          </div>
          <div className="flex h-14 shrink-0 items-center justify-between border-t border-[#e6e3ed] bg-white px-5 lg:px-7"><div><p className="text-[9px] font-semibold uppercase text-[#6b5bc7] lg:text-[10px]">{activeStage.eyebrow}</p><p className="mt-0.5 text-xs font-semibold text-[#1f2436] lg:text-sm">{activeStage.title}</p></div><p className="hidden max-w-[42%] text-right text-[10px] leading-4 text-[#747a8c] lg:block">{activeStage.description}</p></div>
        </div>
      </ContainerScroll>
      <div aria-hidden className="h-36 sm:h-40 lg:h-48" />
    </div>
  );
}

function MobileStory() {
  const [activeIndex, setActiveIndex] = useState(0);
  const observerRef = useRef<IntersectionObserver | null>(null);
  useEffect(() => {
    const elements = PRODUCT_STORY_STAGE_IDS.map((id) => document.getElementById(`mobile-story-${id}`)).filter((element): element is HTMLElement => Boolean(element));
    observerRef.current = new IntersectionObserver((entries) => { const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]; if (!visible) return; const index = elements.indexOf(visible.target as HTMLElement); if (index >= 0) setActiveIndex(index); }, { rootMargin: "-25% 0px -45%", threshold: [0.2, 0.5, 0.8] });
    elements.forEach((element) => observerRef.current?.observe(element));
    return () => observerRef.current?.disconnect();
  }, []);
  return (
    <div data-navbar-theme="dark" className="relative overflow-hidden rounded-t-[28px] bg-[#0d1020] pt-8 text-white md:hidden">
      <div aria-hidden className="absolute inset-0 bg-[linear-gradient(180deg,#171a2e,#0d1020)]" />
      <div className="sticky top-16 z-20 mx-4 mb-8 overflow-hidden rounded-xl border border-white/12 bg-[#171a2e]/92 p-1 shadow-lg backdrop-blur-xl"><div className="grid grid-cols-5">{STAGES.map((stage, index) => <a key={stage.id} href={`#mobile-story-${stage.id}`} aria-label={`${index + 1}, ${stage.label}`} className={cn("rounded-lg px-1 py-2 text-center text-[9px] font-semibold text-white/70", index === activeIndex && "bg-[#6842f5] text-white")}>{index + 1}</a>)}</div></div>
      <div className="relative space-y-16 px-5 pb-20">{STAGES.map((stage) => <article id={`mobile-story-${stage.id}`} key={stage.id} className="scroll-mt-32"><p className="text-[10px] font-semibold uppercase text-[#aa96ff]">{stage.eyebrow}</p><h3 className="mt-2 text-balance text-2xl font-semibold text-white">{stage.title}</h3><p className="mt-3 text-sm leading-6 text-white/60">{stage.description}</p><div className="mt-5 aspect-[16/11] overflow-hidden rounded-2xl border border-white/12 bg-white shadow-[0_24px_60px_rgba(0,0,0,0.32)]"><StagePreview stageId={stage.id} reducedMotion /></div></article>)}</div>
    </div>
  );
}

export default function ProductStorySection() {
  return (
    <section data-navbar-theme="light" className="landing-light-surface relative z-[5] -mt-7 overflow-clip text-[#111527] sm:-mt-9">
      <div aria-hidden className="pointer-events-none absolute inset-0 hero-ambient-gradient" />
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(255,255,255,0.34),transparent_46%)]" />
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
