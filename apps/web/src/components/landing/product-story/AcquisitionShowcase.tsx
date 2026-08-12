"use client";

import Image from "next/image";
import { useState, type FormEvent } from "react";
import { m, useReducedMotion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  BriefcaseBusiness,
  ChartNoAxesCombined,
  Send,
  Target,
  UserRound,
  UsersRound,
  WandSparkles,
} from "lucide-react";
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

const PROSPECT_AVATAR = "/landing/portraits/prospect-36.webp";

const AVATARS = [
  { src: "/landing/portraits/prospect-44.webp", alt: "Diverse prospect portrait", position: "left-[6%] top-[14%]" },
  { src: "/landing/portraits/prospect-32.webp", alt: "Diverse prospect portrait", position: "right-[6%] top-[14%]" },
  { src: "/landing/portraits/prospect-46.webp", alt: "Diverse prospect portrait", position: "left-[6%] bottom-[14%]" },
  { src: "/landing/portraits/prospect-68.webp", alt: "Diverse prospect portrait", position: "right-[6%] bottom-[14%]" },
] as const;

const ACQUISITION_FLOW_STEPS: readonly AcquisitionFlowStep[] = [
  {
    title: "Build the game plan.",
    description: "We turn your business, market and ideal customer into a focused acquisition strategy.",
    icon: Target,
  },
  {
    title: "Find your best prospects.",
    description: "We surface the people and companies that fit your offer before outreach begins.",
    icon: UsersRound,
  },
  {
    title: "Create content that converts.",
    description: "Personalized messages and video are built around the reason each prospect should care.",
    icon: WandSparkles,
  },
  {
    title: "Reach them where they are.",
    description: "The right message is routed through the channels your audience already uses.",
    icon: Send,
  },
  {
    title: "Show what matters.",
    description: "Replies, conversations and qualified meetings stay visible in one workspace.",
    icon: Activity,
  },
] as const;

function ChannelGlyph({ channel, className }: { channel: Channel; className?: string }) {
  return <ChannelLogo name={channel.logo} className={className} />;
}

function AcquisitionStepVisual({ index, isSelected }: { index: number; isSelected: boolean }) {
  const reducedMotion = Boolean(useReducedMotion());
  const reveal = (delay: number) => ({
    duration: reducedMotion ? 0 : 0.3,
    delay: reducedMotion ? 0 : delay,
    ease: [0.22, 1, 0.36, 1] as const,
  });
  const visible = isSelected ? { opacity: 1, y: 0 } : { opacity: 0.55, y: 0 };

  if (index === 0) {
    return <div className="grid grid-cols-3 gap-1.5 pt-1" aria-hidden>
      {["w-3/5", "w-4/5", "w-2/5"].map((width, lineIndex) => <m.span key={width} className={cn("h-1.5 rounded-full bg-[#8f76ff]", width)} initial={reducedMotion ? false : { opacity: 0, scaleX: 0, originX: 0 }} animate={isSelected ? { opacity: 1, scaleX: 1 } : { opacity: 0.45, scaleX: 1 }} transition={reveal(0.34 + lineIndex * 0.07)} />)}
    </div>;
  }

  if (index === 1) {
    return <div className="flex items-center gap-2 pt-1" aria-hidden>
      {["/landing/portraits/prospect-32.webp", "/landing/portraits/prospect-44.webp", "/landing/portraits/prospect-46.webp"].map((src, avatarIndex) => <m.span key={src} className="relative size-10 overflow-hidden rounded-full border-2 border-white/80" initial={reducedMotion ? false : { opacity: 0, scale: 0.72, y: 6 }} animate={visible} transition={reveal(0.34 + avatarIndex * 0.07)}><Image src={src} alt="" fill sizes="40px" className="object-cover" /></m.span>)}
      <m.span className="ml-1 rounded-full border border-current/20 px-3 py-1.5 text-xs font-semibold" initial={reducedMotion ? false : { opacity: 0, y: 6 }} animate={visible} transition={reveal(0.58)}>+247</m.span>
    </div>;
  }

  if (index === 2) {
    return <div className="space-y-1.5 pt-1" aria-hidden>
      {["w-4/5", "w-full", "w-3/5"].map((width, lineIndex) => <m.span key={width} className={cn("block h-1.5 rounded-full bg-current/20", width)} initial={reducedMotion ? false : { opacity: 0, x: -8 }} animate={visible} transition={reveal(0.34 + lineIndex * 0.08)} />)}
    </div>;
  }

  if (index === 3) {
    return <div className="flex items-center gap-3 pt-1" aria-hidden>
      {CHANNELS.slice(0, 3).map((channel, channelIndex) => <m.span key={channel.label} className="flex size-9 items-center justify-center" initial={reducedMotion ? false : { opacity: 0, scale: 0.76, y: 6 }} animate={visible} transition={reveal(0.34 + channelIndex * 0.1)}><ChannelGlyph channel={channel} className="size-9" /></m.span>)}
    </div>;
  }

  return <div className="flex h-10 items-end gap-1.5 pt-1" aria-hidden>
    {["h-3", "h-5", "h-4", "h-7", "h-9"].map((height, barIndex) => <m.span key={height} className={cn("w-2 rounded-t-full bg-[#8f76ff]", height)} initial={reducedMotion ? false : { opacity: 0, scaleY: 0, originY: 1 }} animate={isSelected ? { opacity: 1, scaleY: 1 } : { opacity: 0.45, scaleY: 1 }} transition={reveal(0.32 + barIndex * 0.07)} />)}
    <m.span className="ml-2 text-xs font-semibold text-[#8f76ff]" initial={reducedMotion ? false : { opacity: 0, y: 5 }} animate={visible} transition={reveal(0.68)}>+31%</m.span>
  </div>;
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

function AcquisitionFlow() {
  const reducedMotion = Boolean(useReducedMotion());

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

      <CoverflowCarousel
        slides={ACQUISITION_FLOW_STEPS}
        label="The LeadReacher customer acquisition workflow"
        cardWidth="clamp(12rem, 18vw, 18rem)"
        cardAspectRatio={4 / 5}
        autoPlay
        autoPlayInterval={3800}
        finalSlideHold={2000}
        className="mx-auto mt-3 max-w-[100rem]"
        cardClassName="border border-[#e2deef]"
        renderSlide={(slide, index, isSelected) => {
          const step = slide as AcquisitionFlowStep;
          const Icon = step.icon;
          return (
            <SpotlightCard
              className={cn(
                "size-full rounded-none border-0 bg-transparent shadow-none",
                isSelected && "shadow-[0_18px_42px_rgba(93,66,229,.2)]",
              )}
              spotlightColor={isSelected ? "rgba(155, 123, 255, 0.3)" : "rgba(111, 76, 255, 0.18)"}
            >
              <m.div
                key={`${index}-${isSelected ? "active" : "inactive"}`}
                initial={reducedMotion ? false : { opacity: 0, rotateY: isSelected ? -6 : 0, scale: isSelected ? 0.96 : 1 }}
                animate={{ opacity: 1, rotateY: 0, scale: 1 }}
                transition={{ duration: reducedMotion ? 0 : 0.5, ease: [0.22, 1, 0.36, 1] }}
                className={cn("flex size-full flex-col p-6 text-left transition-colors duration-500 sm:p-7", isSelected ? "bg-[#151625]/90 text-white" : "bg-white/90 text-[#171729]")}
              >
                <m.div initial={reducedMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reducedMotion ? 0 : 0.28, ease: [0.22, 1, 0.36, 1] }} className="flex items-center justify-between">
                  <span className={cn("text-xl font-semibold tracking-[-0.03em]", isSelected ? "text-[#a792ff]" : "text-[#6948e4]")}>0{index + 1}</span>
                  <Icon className={cn("size-8", isSelected ? "text-[#ad9bff]" : "text-[#a79be0]")} strokeWidth={1.6} aria-hidden />
                </m.div>
                <m.h3 initial={reducedMotion ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reducedMotion ? 0 : 0.32, delay: reducedMotion ? 0 : 0.08, ease: [0.22, 1, 0.36, 1] }} className="mt-8 text-balance text-2xl font-semibold leading-tight tracking-[-0.025em] sm:text-[1.75rem]">
                  {step.title}
                </m.h3>
                <m.p initial={reducedMotion ? false : { opacity: 0, y: 10 }} animate={{ opacity: isSelected ? 1 : 0.72, y: 0 }} transition={{ duration: reducedMotion ? 0 : 0.32, delay: reducedMotion ? 0 : 0.16, ease: [0.22, 1, 0.36, 1] }} className={cn("mt-4 text-sm leading-6 sm:text-base sm:leading-7", isSelected ? "text-white/72" : "text-[#62697e]")}>
                  {step.description}
                </m.p>
                <m.div initial={reducedMotion ? false : { opacity: 0, y: 10 }} animate={{ opacity: isSelected ? 1 : 0.68, y: 0 }} transition={{ duration: reducedMotion ? 0 : 0.32, delay: reducedMotion ? 0 : 0.24, ease: [0.22, 1, 0.36, 1] }} className="mt-4">
                  <AcquisitionStepVisual index={index} isSelected={isSelected} />
                </m.div>
              </m.div>
            </SpotlightCard>
          );
        }}
      />
      <AcquisitionUrlPrompt />
    </div>
  );
}

export default function AcquisitionShowcase() {
  return <AcquisitionFlow />;
}
