"use client";

import Image from "next/image";
import { useState, type FormEvent } from "react";
import { m, useReducedMotion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  BriefcaseBusiness,
  ChartNoAxesCombined,
  Play,
  Send,
  Target,
  UserRound,
  UsersRound,
  WandSparkles,
} from "@/components/ui/icons";
import { ChannelLogo, type ChannelLogoName } from "@/components/onboarding/ChannelLogo";
import { CoverflowCarousel, type CoverflowSlide } from "@/components/ui/coverflow-carousel";
import { MarkerHighlight } from "@/components/ui/marker-highlight";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import ShimmerText from "@/components/ui/shimmer-text";
import { cn } from "@/lib/utils";

type AcquisitionFlowStep = CoverflowSlide & {
  description: string;
  icon: typeof Target;
};

type Channel = {
  label: string;
  logo: ChannelLogoName;
};

const CHANNELS: readonly Channel[] = [
  { label: "Instagram", logo: "instagram" },
  { label: "LinkedIn", logo: "linkedin" },
  { label: "WhatsApp", logo: "whatsapp-mark" },
  { label: "Outlook", logo: "outlook" },
] as const;

const CHANNEL_CLICK_DELAYS = [0.24, 1.14, 2.94, 2.04] as const;

const PROSPECT_AVATAR = "/landing/portraits/prospect-36.webp";

const AVATARS = [
  { src: "/landing/portraits/prospect-44.webp", alt: "Diverse prospect portrait", position: "left-[6%] top-[14%]" },
  { src: "/landing/portraits/prospect-32.webp", alt: "Diverse prospect portrait", position: "right-[6%] top-[14%]" },
  { src: "/landing/portraits/prospect-46.webp", alt: "Diverse prospect portrait", position: "left-[6%] bottom-[14%]" },
  { src: "/landing/portraits/prospect-68.webp", alt: "Diverse prospect portrait", position: "right-[6%] bottom-[14%]" },
] as const;

const ACQUISITION_FLOW_STEPS: readonly AcquisitionFlowStep[] = [
  {
    title: "LeadReacher builds your custom strategy.",
    description: "Built around your business, market and ideal customer.",
    icon: Target,
  },
  {
    title: "Finds your ideal prospects.",
    description: "Surfaces high-value prospects specific to your business.",
    icon: UsersRound,
  },
  {
    title: "Creates sales-focused content that converts.",
    description: "Personalized messaging and video built to convert.",
    icon: WandSparkles,
  },
  {
    title: "Finds the right channel. Automates the outreach.",
    description: "Routes approved outreach through the channels your prospects already use.",
    icon: Send,
  },
  {
    title: "LeadReacher reports. You approve, track and close.",
    description: "See replies, meetings and progress in real time so you can close more deals.",
    icon: Activity,
  },
] as const;

function ChannelGlyph({ channel, className }: { channel: Channel; className?: string }) {
  return <ChannelLogo name={channel.logo} className={className} />;
}

// Matches the cursor route: Instagram → LinkedIn → Outlook → WhatsApp.

function ChannelSelectionCursor({ reducedMotion }: { reducedMotion: boolean }) {
  if (reducedMotion) return null;

  return (
    <m.svg
      viewBox="0 0 220 120"
      aria-hidden
      className="pointer-events-none absolute inset-0 z-20 size-full overflow-visible"
    >
      <m.g
        className="drop-shadow-[0_4px_7px_rgba(18,12,45,.35)] [will-change:transform]"
        style={{ transformBox: "fill-box", transformOrigin: "0 0" }}
        initial={{ x: 110, y: 18, scale: 1 }}
        animate={{
          x: [110, 110, 198, 198, 110, 110, 15, 15, 110],
          y: [18, 18, 60, 60, 102, 102, 60, 60, 18],
          scale: [1, 0.8, 1, 0.8, 1, 0.8, 1, 0.8, 1],
        }}
        transition={{
          duration: 3.6,
          repeat: Infinity,
          ease: [0.25, 1, 0.5, 1],
          times: [0, 0.08, 0.25, 0.33, 0.5, 0.58, 0.75, 0.83, 1],
        }}
      >
        <path d="M0 0 20.5 17.5h-9.2l-4.6 9.2L0 0Z" fill="#fff" stroke="#17132d" strokeWidth="2.1" strokeLinejoin="round" />
      </m.g>
    </m.svg>
  );
}

function AcquisitionStepVisual({
  index,
  isSelected,
}: {
  index: number;
  isSelected: boolean;
}) {
  const reducedMotion = Boolean(useReducedMotion());
  const reveal = (delay: number) => ({
    duration: reducedMotion ? 0 : 0.3,
    delay: reducedMotion ? 0 : delay,
    ease: [0.22, 1, 0.36, 1] as const,
  });
  const visible = isSelected ? { opacity: 1, y: 0 } : { opacity: 0.76, y: 0 };

  if (index === 0) {
    return <div className="relative flex h-20 items-center justify-center overflow-hidden rounded-xl sm:h-36 h-short:h-24" aria-hidden>
      <m.span
        className="relative h-full w-full drop-shadow-[0_14px_20px_rgba(92,61,196,.16)]"
        initial={reducedMotion ? false : { opacity: 0, scale: 0.86, y: 19 }}
        animate={{ opacity: isSelected ? 1 : 0.88, scale: 1, y: 0 }}
        transition={reveal(0.18)}
      >
        <Image
          src="/landing/product-story/strategy-brain.webp"
          alt=""
          fill
          sizes="(min-width: 640px) 220px, 160px"
          className="object-contain"
        />
      </m.span>
    </div>;
  }

  if (index === 1) {
    const prospects = [
      { name: "Sarah Chen", role: "VP Marketing", score: "96%", src: "/landing/portraits/prospect-32.webp" },
      { name: "James Wilson", role: "Founder", score: "93%", src: "/landing/portraits/prospect-36.webp" },
      { name: "Michelle Park", role: "Head of Growth", score: "89%", src: "/landing/portraits/prospect-46.webp" },
    ];
    return <div className="flex h-16 flex-col justify-center gap-0.5 sm:h-28 sm:gap-1.5 h-short:h-20" aria-hidden>{prospects.map((prospect, prospectIndex) => <m.div key={prospect.name} className={cn("flex min-h-5 items-center gap-1 rounded-md border px-1 py-px shadow-[0_5px_12px_rgba(43,33,104,.06)] sm:min-h-8 sm:gap-2.5 sm:rounded-lg sm:px-2.5 sm:py-1 h-short:min-h-6 h-short:py-0", isSelected ? "border-white/10 bg-white/[.07]" : "border-[#e9e5f3] bg-white dark:border-white/10 dark:bg-white/[.055]")} initial={reducedMotion ? false : { opacity: 0, x: -8 }} animate={visible} transition={reveal(0.24 + prospectIndex * 0.08)}>
      <span className="relative size-6 shrink-0 overflow-hidden rounded-full sm:size-8"><Image src={prospect.src} alt="" fill sizes="32px" className="object-cover object-top" /></span>
      <span className="min-w-0 flex-1"><span className="block truncate text-[9px] font-semibold leading-3 sm:text-[11px] sm:leading-4">{prospect.name}</span><span className={cn("block truncate text-[7px] leading-3 sm:text-[9px]", isSelected ? "text-white/55" : "text-[#62697e] dark:text-white/55")}>{prospect.role}</span></span>
      <span className={cn("text-[10px] font-bold sm:text-sm", isSelected ? "text-[#b8a5ff]" : "text-[#6642de] dark:text-[#ad99ff]")}>{prospect.score}</span>
    </m.div>)}</div>;
  }

  if (index === 2) {
    return <m.div className="relative h-16 overflow-hidden rounded-lg border border-white/10 bg-[#090a12] shadow-[0_12px_25px_rgba(0,0,0,.22)] sm:h-28 sm:rounded-xl h-short:h-20" aria-hidden initial={reducedMotion ? false : { opacity: 0, scale: 0.95 }} animate={visible} transition={reveal(0.22)}>
      <Image src="/landing/product-story/content-aggressive.webp" alt="" fill sizes="288px" className="object-cover object-[50%_30%]" />
      <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/10" />
      <m.span className="absolute left-1/2 top-1/2 flex size-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/70 bg-black/45 text-white" initial={reducedMotion ? false : { opacity: 0, scale: 0.65 }} animate={{ opacity: 1, scale: 1 }} transition={reveal(0.34)}><Play className="ml-0.5 size-4" weight="fill" /></m.span>
      <span className="absolute bottom-2 left-2 right-2 truncate rounded bg-black/55 px-2 py-1 text-center text-[9px] font-medium text-white">For Sarah at Acme Inc.</span>
    </m.div>;
  }

  if (index === 3) {
    const positions = ["left-1/2 top-[15%] -translate-x-1/2 -translate-y-1/2", "left-[86%] top-1/2 -translate-x-1/2 -translate-y-1/2", "left-[14%] top-1/2 -translate-x-1/2 -translate-y-1/2", "left-1/2 top-[85%] -translate-x-1/2 -translate-y-1/2"];
    return <div className="relative h-16 sm:h-28 h-short:h-20" aria-hidden>
      {CHANNELS.map((channel, channelIndex) => <m.span
        key={channel.label}
        className={cn("absolute flex size-9 items-center justify-center [will-change:transform,filter]", positions[channelIndex])}
        initial={reducedMotion ? false : { opacity: 0, scale: 0.75 }}
        animate={isSelected && !reducedMotion
          ? { opacity: 1, scale: [1, 0.9, 1.14, 1], filter: ["drop-shadow(0 0 0 rgba(126,92,255,0))", "drop-shadow(0 0 0 rgba(126,92,255,0))", "drop-shadow(0 0 9px rgba(126,92,255,.72))", "drop-shadow(0 0 0 rgba(126,92,255,0))"] }
          : visible}
        transition={isSelected && !reducedMotion
          ? { delay: CHANNEL_CLICK_DELAYS[channelIndex], duration: 0.26, repeat: Infinity, repeatDelay: 3.34, ease: [0.22, 1, 0.36, 1] }
          : reveal(0.3 + channelIndex * 0.07)}
      ><ChannelGlyph channel={channel} className="size-8" /></m.span>)}
      {isSelected ? <ChannelSelectionCursor reducedMotion={reducedMotion} /> : null}
    </div>;
  }

  return <m.div className={cn("flex h-16 flex-col rounded-lg border p-1 shadow-[0_9px_20px_rgba(43,33,104,.08)] sm:h-28 sm:rounded-xl sm:p-2.5 h-short:h-20 h-short:p-1.5", isSelected ? "border-white/10 bg-white/[.07]" : "border-[#e9e5f3] bg-white dark:border-white/10 dark:bg-white/[.055]")} aria-hidden initial={reducedMotion ? false : { opacity: 0, y: 8 }} animate={visible} transition={reveal(0.22)}>
    <div className="flex items-center justify-between text-[9px] font-semibold"><span>Campaign performance</span><span className="flex items-center gap-1 text-[#2bac6a]"><span className="size-1.5 rounded-full bg-[#2bac6a]" />Live</span></div>
    <svg className="my-1 h-12 w-full" viewBox="0 0 200 50" fill="none" preserveAspectRatio="none"><m.path d="M2 43 L22 34 L40 37 L60 23 L80 29 L100 18 L120 22 L140 10 L160 15 L181 4 L198 7" stroke={isSelected ? "#ad99ff" : "#6843e7"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" initial={reducedMotion ? false : { pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }} transition={{ duration: reducedMotion ? 0 : 0.52, delay: reducedMotion ? 0 : 0.28, ease: "easeOut" }} /><m.path d="M2 43 L22 34 L40 37 L60 23 L80 29 L100 18 L120 22 L140 10 L160 15 L181 4 L198 7 L198 50 L2 50 Z" fill={isSelected ? "rgba(173,153,255,.08)" : "rgba(104,67,231,.07)"} initial={reducedMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: reducedMotion ? 0 : 0.36, delay: reducedMotion ? 0 : 0.46 }} /></svg>
    <div className="grid grid-cols-3 gap-1 border-t border-current/10 pt-1.5">{[{label:"Replies",value:"268"},{label:"Booked",value:"64"},{label:"Conversion",value:"3.8%"}].map((metric, metricIndex) => <m.span key={metric.label} initial={reducedMotion ? false : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={reveal(0.48 + metricIndex * 0.06)}><span className={cn("block text-[7px]", isSelected ? "text-white/50" : "text-[#7a7f90] dark:text-white/50")}>{metric.label}</span><span className="block text-xs font-bold">{metric.value}</span></m.span>)}</div>
  </m.div>;
}

function AcquisitionUrlPrompt() {
  const [websiteUrl, setWebsiteUrl] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const heroInput = document.getElementById("landing-website-url") as HTMLInputElement | null;
    if (!heroInput) return;

    const value = websiteUrl.trim();
    if (value) {
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      valueSetter?.call(heroInput, value);
      heroInput.dispatchEvent(new Event("input", { bubbles: true }));
    }

    document.getElementById("top")?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
    window.setTimeout(() => heroInput.focus(), 450);
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto mt-10 max-w-3xl px-5 sm:mt-12">
      <SpotlightCard spotlightColor="rgba(139, 92, 246, 0.14)" spotlightClassName="z-10 mix-blend-multiply" className="rounded-[18px] border-0 bg-transparent shadow-none">
        <div className="rounded-[18px] border border-[#dcd9ea] bg-[linear-gradient(105deg,rgba(248,247,255,.96),rgba(255,255,255,.98),rgba(241,240,255,.94))] p-1 shadow-[0_18px_45px_rgba(66,42,148,0.10)]">
          <div className="flex flex-col items-stretch gap-4 rounded-[14px] px-5 py-5 sm:min-h-20 sm:flex-row sm:items-center sm:gap-6 sm:px-8 sm:py-3">
          <div className="shrink-0">
            <p className="text-base font-semibold leading-5 text-[#171729]">Too good to be true?</p>
            <p className="mt-1 text-sm leading-5 text-[#62697e]">Just pop in your URL.</p>
          </div>
          <div className="hidden h-9 w-px bg-[#e1deea] sm:block" aria-hidden />
          <div className="flex min-h-12 min-w-0 items-center rounded-xl border border-[#ded9ef] bg-white/90 px-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,.9)] transition-shadow focus-within:border-[#8c73f6] focus-within:shadow-[0_0_0_3px_rgba(109,79,238,.13)] sm:flex-1">
            <label htmlFor="acquisition-showcase-url" className="sr-only">Company website</label>
            <input
              id="acquisition-showcase-url"
              type="url"
              inputMode="url"
              autoComplete="url"
              value={websiteUrl}
              onChange={(event) => setWebsiteUrl(event.target.value)}
              placeholder="https://yourwebsite.com"
              className="min-w-0 flex-1 bg-transparent px-2 text-sm text-[#49516a] outline-none placeholder:text-[#8b91a3] sm:text-base"
            />
            <button
              type="submit"
              aria-label="Analyze your website"
              className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#5a32ed] text-white shadow-[0_6px_14px_rgba(90,50,237,.28)] transition-[transform,background-color,box-shadow] hover:-translate-y-0.5 hover:bg-[#6842f5] hover:shadow-[0_10px_18px_rgba(90,50,237,.34)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5a32ed] focus-visible:ring-offset-2 active:translate-y-0 sm:size-11"
            >
              <ArrowRight className="size-5" aria-hidden />
            </button>
          </div>
          </div>
        </div>
      </SpotlightCard>
    </form>
  );
}

export function OrbitNetwork() {
  const reducedMotion = Boolean(useReducedMotion());

  return (
    <div className="relative mx-auto h-[290px] w-full max-w-[350px] overflow-hidden" aria-label="Orbiting network of prospects" role="img">
      <div aria-hidden className="absolute left-1/2 top-1/2 size-[176px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(119,80,255,.18),rgba(155,124,255,.08)_48%,transparent_72%)] blur-[2px]" />
      {[216, 158, 92].map((size, index) => (
        <span
          key={size}
          aria-hidden
          className={cn(
            "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed",
            index === 2 ? "border-[#d7cff6]" : "border-[#dfe0ed]",
          )}
          style={{ width: size, height: size }}
        />
      ))}

      <m.div
        className="absolute left-1/2 top-1/2 size-[275px] -translate-x-1/2 -translate-y-1/2"
        animate={reducedMotion ? undefined : { rotate: 360 }}
        transition={reducedMotion ? undefined : { duration: 24, repeat: Infinity, ease: "linear" }}
      >
        <m.div
          className="absolute left-1/2 top-0 flex size-12 -translate-x-1/2 items-center justify-center rounded-full bg-gradient-to-br from-[#f3ecff] to-[#d8ccff] text-[#6340db] shadow-[0_8px_18px_rgba(91,57,213,.14)]"
          animate={reducedMotion ? undefined : { rotate: -360 }}
          transition={reducedMotion ? undefined : { duration: 24, repeat: Infinity, ease: "linear" }}
        >
          <ChartNoAxesCombined className="size-7" aria-hidden />
        </m.div>
        {AVATARS.map((avatar) => (
          <m.div
            key={avatar.src}
            className={cn("absolute size-12 overflow-hidden rounded-full bg-white shadow-[0_8px_18px_rgba(48,36,99,.14)]", avatar.position)}
            animate={reducedMotion ? undefined : { rotate: -360 }}
            transition={reducedMotion ? undefined : { duration: 24, repeat: Infinity, ease: "linear" }}
          >
            <Image src={avatar.src} alt={avatar.alt} fill sizes="48px" className="rounded-full object-cover" />
          </m.div>
        ))}
        <m.div
          className="absolute bottom-0 left-1/2 flex size-12 -translate-x-1/2 items-center justify-center rounded-full bg-[#f0edff] text-[#5c3ad0] shadow-[0_7px_16px_rgba(91,57,213,.12)]"
          animate={reducedMotion ? undefined : { rotate: -360 }}
          transition={reducedMotion ? undefined : { duration: 24, repeat: Infinity, ease: "linear" }}
        >
          <BriefcaseBusiness className="size-6" aria-hidden />
        </m.div>
      </m.div>

      <m.div
        className="absolute left-1/2 top-1/2 z-10 flex size-[82px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white bg-white shadow-[0_14px_30px_rgba(81,49,202,.18)]"
        animate={reducedMotion ? undefined : { boxShadow: ["0 14px 30px rgba(81,49,202,.16)", "0 14px 42px rgba(102,70,239,.3)", "0 14px 30px rgba(81,49,202,.16)"] }}
        transition={reducedMotion ? undefined : { duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
      >
        <span aria-hidden className="absolute -inset-2 rounded-full border border-[#a994ff]/35" />
        <span aria-hidden className="absolute -inset-4 rounded-full border border-[#c8bcff]/25" />
        <UserRound className="relative size-10 text-[#5530d1]" strokeWidth={1.8} aria-hidden />
      </m.div>
    </div>
  );
}

export function ChannelFlow() {
  const reducedMotion = Boolean(useReducedMotion());
  const channelY = [78, 134, 190, 246];
  const paths = [
    ...channelY.map((y) => `M 36 145 C 98 145, 112 ${y}, 180 ${y}`),
    ...channelY.map((y) => `M 180 ${y} C 248 ${y}, 262 145, 324 145`),
  ];

  return (
    <div className="relative mx-auto h-[290px] w-full max-w-[360px]" aria-label="LeadReacher routing social channels to a prospect" role="img">
      <svg aria-hidden className="pointer-events-none absolute inset-0 size-full" viewBox="0 0 360 290" fill="none" preserveAspectRatio="none">
        {paths.map((path, index) => (
          <g key={path}>
            <path d={path} stroke="#d9d7eb" strokeWidth="1.2" />
            <m.path
              d={path}
              stroke={index % 2 === 0 ? "#7454ee" : "#8ca8ff"}
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray="1 15"
              initial={reducedMotion ? undefined : { strokeDashoffset: 0 }}
              animate={reducedMotion ? undefined : { strokeDashoffset: -64 }}
              transition={reducedMotion ? undefined : { duration: 2.8 + index * 0.35, repeat: Infinity, ease: "linear", delay: index * 0.35 }}
            />
          </g>
        ))}
      </svg>

      <m.div
        className="absolute left-1 top-1/2 flex size-16 -translate-y-1/2 items-center justify-center"
        initial={reducedMotion ? undefined : { opacity: 0, scale: 0.86 }}
        whileInView={reducedMotion ? undefined : { opacity: 1, scale: 1 }}
        viewport={{ once: true, amount: 0.5 }}
        transition={{ duration: 0.45 }}
      >
        <Image src="/logo/leadreacher_plane_only.svg" alt="LeadReacher" width={64} height={64} className="size-14 object-contain" />
      </m.div>

      {CHANNELS.map((channel, index) => (
        <m.div
          key={channel.label}
          aria-hidden
          className="absolute left-1/2 flex size-14 -translate-x-1/2 items-center justify-center"
          style={{ top: channelY[index] - 28 }}
          initial={reducedMotion ? undefined : { opacity: 0, scale: 0.8 }}
          whileInView={reducedMotion ? undefined : { opacity: 1, scale: 1 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ delay: index * 0.08, duration: 0.35 }}
        >
          <ChannelGlyph channel={channel} className="size-12" />
        </m.div>
      ))}

      <m.div
        className="absolute right-1 top-1/2 size-16 -translate-y-1/2 overflow-hidden rounded-full shadow-[0_12px_26px_rgba(76,46,205,.18)]"
        initial={reducedMotion ? undefined : { opacity: 0, scale: 0.86 }}
        whileInView={reducedMotion ? undefined : { opacity: 1, scale: 1 }}
        viewport={{ once: true, amount: 0.5 }}
        transition={{ duration: 0.45, delay: 0.25 }}
      >
        <Image src={PROSPECT_AVATAR} alt="Prospect" fill sizes="64px" className="object-cover" />
      </m.div>
    </div>
  );
}

type AcquisitionWorkflowCarouselProps = {
  compact?: boolean;
  className?: string;
};

export function AcquisitionWorkflowCarousel({
  compact = false,
  className,
}: AcquisitionWorkflowCarouselProps) {
  const reducedMotion = Boolean(useReducedMotion());

  return (
    <CoverflowCarousel
      slides={ACQUISITION_FLOW_STEPS}
      label="The LeadReacher customer acquisition workflow"
      cardWidth={compact ? "clamp(14.5rem, min(22vw, 36vh), 18rem)" : "clamp(13rem, 20vw, 20rem)"}
      cardAspectRatio={compact ? 17 / 25 : 11 / 16}
      autoPlay
      autoPlayInterval={3800}
      finalSlideHold={2000}
      settleDuration={compact ? 190 : 260}
      showNavigation={compact}
      className={cn(compact ? "acquisition-workflow--compact max-w-[92rem]" : "max-w-[100rem]", className)}
      cardClassName={cn(
        compact ? "aspect-[17/25] border border-[#e2deef]" : "aspect-[11/16] border border-[#e2deef]",
        compact && "dark:border-white/12 dark:bg-[#1a1f29]",
      )}
      renderSlide={(slide, index, _isSelected, isVisuallyActive) => {
        const step = slide as AcquisitionFlowStep;
        const Icon = step.icon;
        return (
          <SpotlightCard
            className={cn(
              "size-full rounded-none border-0 bg-transparent shadow-none",
              isVisuallyActive && "shadow-[0_18px_42px_rgba(93,66,229,.2)]",
              compact && isVisuallyActive && "ring-1 ring-[#8268f4] dark:ring-[#a792ff]",
            )}
            spotlightColor={isVisuallyActive ? "rgba(155, 123, 255, 0.3)" : "rgba(111, 76, 255, 0.18)"}
          >
            <div className={cn(
              "theme-transition-surface relative size-full overflow-hidden",
              isVisuallyActive
                ? "bg-[#151625] text-white"
                : "bg-white text-[#171729] dark:bg-[#1a1f29] dark:text-[#f5f2ff]",
            )}>
              <div
                data-acquisition-card-content
                className={cn(
                  "absolute inset-0 flex size-full flex-col text-left",
                  compact ? "p-4 sm:p-[1.15rem] h-short:p-4" : "p-4 sm:p-5 h-short:p-3.5",
                )}
              >
              <m.div initial={reducedMotion ? false : { opacity: 0.72, y: 6 }} animate={{ opacity: isVisuallyActive ? 1 : 0.72, y: isVisuallyActive ? 0 : 3 }} transition={{ duration: reducedMotion ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }} className="flex items-center justify-between">
                <span className={cn("text-xl font-semibold tracking-[-0.03em] sm:text-2xl", isVisuallyActive ? "text-[#a792ff]" : "text-[#6948e4] dark:text-[#a792ff]")}>0{index + 1}</span>
                <Icon className={cn("size-7 sm:size-9", isVisuallyActive ? "text-[#ad9bff]" : "text-[#a79be0]")} strokeWidth={1.6} aria-hidden />
              </m.div>
              <m.div initial={reducedMotion ? false : { opacity: 0.62, y: 8 }} animate={{ opacity: isVisuallyActive ? 1 : 0.78, y: isVisuallyActive ? 0 : 3 }} transition={{ duration: reducedMotion ? 0 : 0.28, delay: reducedMotion || !isVisuallyActive ? 0 : 0.04, ease: [0.22, 1, 0.36, 1] }} className={compact ? "mt-2.5 sm:mt-3 h-short:mt-2" : "mt-2.5 sm:mt-4 h-short:mt-2"}>
                <AcquisitionStepVisual index={index} isSelected={isVisuallyActive} />
              </m.div>
              <m.span initial={reducedMotion ? false : { opacity: 0.65, scaleX: 0.75, originX: 0 }} animate={{ opacity: isVisuallyActive ? 1 : 0.72, scaleX: isVisuallyActive ? 1 : 0.82 }} transition={{ duration: reducedMotion ? 0 : 0.24, delay: reducedMotion || !isVisuallyActive ? 0 : 0.06, ease: [0.22, 1, 0.36, 1] }} className={cn("mt-2.5 block h-0.5 w-7 rounded-full sm:mt-4 sm:w-8 h-short:mt-2", isVisuallyActive ? "bg-[#9c83ff]" : "bg-[#6d49e4]")} aria-hidden />
              <m.h3 initial={reducedMotion ? false : { opacity: 0.68, y: 7 }} animate={{ opacity: isVisuallyActive ? 1 : 0.72, y: isVisuallyActive ? 0 : 3 }} transition={{ duration: reducedMotion ? 0 : 0.28, delay: reducedMotion || !isVisuallyActive ? 0 : 0.08, ease: [0.22, 1, 0.36, 1] }} className={cn("mt-3 text-balance font-semibold leading-[1.18] tracking-[-0.025em] h-short:mt-2", compact ? "text-[1.05rem] sm:mt-3.5 sm:text-[1.22rem] h-short:text-[1.05rem]" : "text-[17px] sm:mt-4 sm:text-[1.4rem] sm:leading-[1.18] h-short:text-[1.05rem]")}>
                {step.title}
              </m.h3>
              <m.span initial={reducedMotion ? false : { opacity: 0.55, scaleX: 0.75, originX: 0 }} animate={{ opacity: isVisuallyActive ? 0.9 : 0.7, scaleX: isVisuallyActive ? 1 : 0.82 }} transition={{ duration: reducedMotion ? 0 : 0.24, delay: reducedMotion || !isVisuallyActive ? 0 : 0.1, ease: [0.22, 1, 0.36, 1] }} className={cn("mt-3 block h-px w-8 rounded-full sm:mt-3.5", isVisuallyActive ? "bg-[#9c83ff]" : "bg-[#6d49e4]")} aria-hidden />
              <m.p initial={reducedMotion ? false : { opacity: 0.64, y: 7 }} animate={{ opacity: isVisuallyActive ? 1 : 0.72, y: isVisuallyActive ? 0 : 3 }} transition={{ duration: reducedMotion ? 0 : 0.28, delay: reducedMotion || !isVisuallyActive ? 0 : 0.12, ease: [0.22, 1, 0.36, 1] }} className={cn("mt-3 leading-[1.5] h-short:mt-2 h-short:text-xs", compact ? "text-[0.8rem] sm:mt-3 sm:text-[0.86rem]" : "text-xs sm:mt-3.5 sm:text-[0.95rem] sm:leading-[1.5]", isVisuallyActive ? "text-white/76" : "text-[#62697e] dark:text-white/68")}>
                {step.description}
              </m.p>
              </div>
            </div>
          </SpotlightCard>
        );
      }}
    />
  );
}

function AcquisitionFlow() {
  return (
    <div className="bg-white py-16 sm:py-20 lg:py-24">
      <div className="mx-auto max-w-7xl px-5 text-center sm:px-8 lg:px-10 large-desktop:max-w-[88rem] large-desktop:px-12">
        <h2 className="mx-auto max-w-4xl text-balance text-4xl font-semibold leading-[1.06] tracking-[-0.03em] text-[#111527] sm:text-5xl lg:text-6xl large-desktop:max-w-5xl large-desktop:text-7xl">
          Fully automates new <ShimmerText className="text-[#5d42e5]">customer acquisition.</ShimmerText>
        </h2>
        <p className="mx-auto mt-4 text-balance text-[1.375rem] font-medium leading-8 text-[#646b82] sm:text-[1.625rem] sm:leading-9">
          And still <MarkerHighlight>outperforms agencies.</MarkerHighlight>
        </p>
        <p className="mx-auto mt-5 max-w-2xl text-pretty text-base leading-7 text-[#62697e] sm:text-lg sm:leading-8">
          Converts better and costs less than the outdated marketing and lead generation agency process.
        </p>
        <div className="mx-auto mt-7 flex w-fit items-center gap-4 text-xs font-semibold uppercase tracking-[0.14em] text-[#7454ee]" aria-hidden>
          <span className="h-px w-12 bg-[#b9aaf9] sm:w-20" />
          How it works
          <span className="h-px w-12 bg-[#b9aaf9] sm:w-20" />
        </div>
      </div>

      <AcquisitionWorkflowCarousel className="mx-auto mt-3" />
      <AcquisitionUrlPrompt />
    </div>
  );
}

export default function AcquisitionShowcase() {
  return <AcquisitionFlow />;
}
