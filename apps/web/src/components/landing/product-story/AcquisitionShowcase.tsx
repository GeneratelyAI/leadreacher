"use client";

import Image from "next/image";
import { m, useReducedMotion } from "framer-motion";
import {
  BriefcaseBusiness,
  ChartNoAxesCombined,
  Check,
  ChevronRight,
  UserRound,
} from "lucide-react";
import { ChannelLogo, type ChannelLogoName } from "@/components/onboarding/ChannelLogo";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import ShimmerText from "@/components/ui/shimmer-text";
import { cn } from "@/lib/utils";

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

function ChannelGlyph({ channel, className }: { channel: Channel; className?: string }) {
  return <ChannelLogo name={channel.logo} className={className} />;
}

function OrbitNetwork() {
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

function ChannelFlow() {
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

function ReviewPreview() {
  return (
    <div className="relative mx-auto h-[258px] w-full max-w-[360px] overflow-hidden sm:h-[290px]">
      <div className="absolute inset-x-5 top-1 rounded-2xl border border-white bg-white p-3 shadow-[0_12px_25px_rgba(55,42,112,.1)]">
        <div className="flex items-center justify-between">
          <div className="space-y-1.5"><span className="block h-2 w-16 rounded-full bg-[#d8d6e9]" /><span className="block h-1.5 w-24 rounded-full bg-[#eeeef6]" /></div>
          <span className="rounded-full bg-[#f0edff] px-2 py-1 text-[7px] font-semibold text-[#5735ce]">READY TO REVIEW</span>
        </div>
        <div className="relative mt-4 h-[135px] overflow-hidden rounded-xl bg-[#15182a]">
          <Image src="/landing/product-story/outreach.png" alt="LeadReacher outreach campaign preview" fill sizes="320px" className="object-cover object-top opacity-90" />
          <span className="absolute inset-0 bg-gradient-to-t from-[#121426]/65 via-transparent to-transparent" />
          <span className="absolute bottom-3 left-3 rounded-full bg-white/90 px-2 py-1 text-[8px] font-semibold text-[#252a3c]">Personalized outreach</span>
        </div>
        <div className="mt-3 flex gap-2"><span className="h-2 flex-1 rounded-full bg-[#dedcf0]" /><span className="h-2 w-16 rounded-full bg-[#7454ee]" /><span className="h-2 w-10 rounded-full bg-[#dedcf0]" /></div>
      </div>
      <m.div
        className="absolute -right-1 bottom-7 w-[132px] rounded-2xl border border-white bg-white p-3 shadow-[0_14px_30px_rgba(55,42,112,.13)]"
        initial={{ opacity: 0, x: 12 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true, amount: 0.5 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <p className="text-[8px] font-medium text-[#777c90]">Replies</p>
        <p className="mt-1 text-xl font-semibold tracking-tight text-[#171b2c]">2.4x</p>
        <svg viewBox="0 0 110 34" className="mt-2 h-8 w-full" fill="none" aria-hidden>
          <path d="M2 27 C16 26 18 14 31 19 S48 30 62 13 S82 22 108 5" stroke="#7354ee" strokeWidth="2" />
          <path d="M2 32 H108" stroke="#e6e3f0" strokeDasharray="3 4" />
        </svg>
        <p className="mt-3 text-[8px] font-medium text-[#777c90]">Conversions</p>
        <p className="mt-1 text-xl font-semibold tracking-tight text-[#171b2c]">3–8%</p>
      </m.div>
    </div>
  );
}

const SHOWCASE_CARDS = [
  { number: "1", label: "Understand", description: "We learn about your business, ideal customers and goals. AI analyzes your data and builds your target audience." },
  { number: "2", label: "Reach", description: "We create personalized video outreach and deliver it across the channels your prospects actually use." },
  { number: "3", label: "Convert", description: "More replies. More conversations. More qualified meetings. You focus on closing deals, not chasing leads." },
] as const;

export default function AcquisitionShowcase() {
  return (
    <section className="bg-white">
    <div className="mx-auto max-w-7xl px-5 pb-16 pt-14 text-center sm:px-8 sm:pb-20 sm:pt-16 lg:px-10 lg:pb-24 lg:pt-20 large-desktop:max-w-[88rem] large-desktop:px-12 large-desktop:pb-28 large-desktop:pt-24">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#3034d7] 2xl:text-sm">What LeadReacher does</p>
      <h2 className="mx-auto mt-4 max-w-4xl text-balance text-4xl font-semibold leading-[1.06] tracking-[-0.03em] sm:text-5xl lg:text-7xl large-desktop:max-w-5xl large-desktop:text-[5rem]">
        Customer acquisition
        <br />
        that runs <ShimmerText className="text-[#4f46e5]">itself.</ShimmerText>
      </h2>
      <p className="mx-auto mt-5 max-w-2xl text-pretty text-base leading-7 text-[#62697e] sm:text-lg sm:leading-8 2xl:text-xl 2xl:leading-9">
        We combine AI, social channels and personalized video to find, reach and convert your ideal customers - on autopilot.
      </p>

      <div className="relative mt-12 grid gap-10 text-left sm:mt-16 lg:grid-cols-3 lg:gap-8 large-desktop:gap-10">
        {SHOWCASE_CARDS.map((card, index) => (
          <div key={card.label} className="relative">
            <SpotlightCard className="overflow-visible border-[#e5e2f0]/80 bg-white/35 p-4 shadow-[0_18px_38px_rgba(55,42,112,.045)] sm:p-5">
              <div className="flex min-h-[290px] items-center justify-center rounded-xl bg-[radial-gradient(circle_at_50%_52%,rgba(233,229,255,.9),rgba(248,248,253,.35)_62%,transparent)] large-desktop:min-h-[320px]">
                {index === 0 ? <OrbitNetwork /> : index === 1 ? <ChannelFlow /> : <ReviewPreview />}
              </div>
            </SpotlightCard>
            {index < SHOWCASE_CARDS.length - 1 ? (
              <ChevronRight
                aria-hidden
                className="pointer-events-none absolute left-[calc(100%+1rem)] top-[145px] z-10 hidden size-5 -translate-x-1/2 -translate-y-1/2 text-[#4f46e5] lg:block"
                strokeWidth={1.8}
              />
            ) : null}
            <div className="mt-6 px-2 sm:px-4">
              <div className="flex items-center gap-3"><span className="flex size-9 items-center justify-center rounded-full bg-white text-lg font-semibold text-[#4f46e5] shadow-[0_6px_14px_rgba(77,53,189,.1)]">{card.number}</span><h3 className="text-2xl font-semibold tracking-[-0.02em] text-[#111527] 2xl:text-3xl">{card.label}</h3></div>
              <p className="mt-4 max-w-sm text-base leading-7 text-[#62697e] 2xl:text-lg 2xl:leading-8">{card.description}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mx-auto mt-14 flex max-w-3xl items-center gap-4 rounded-2xl border border-[#e3e0ef] bg-white/45 px-5 py-4 text-left shadow-[0_12px_28px_rgba(55,42,112,.045)] backdrop-blur-sm sm:mt-16 sm:px-7 sm:py-5 large-desktop:max-w-[52rem] large-desktop:px-8 large-desktop:py-6">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-white text-[#4f46e5] shadow-sm"><Check className="size-6" strokeWidth={3} aria-hidden /></span>
        <p className="text-sm leading-6 text-[#394064] sm:text-base"><strong className="font-semibold">AI + human touch. Built for B2B. Focused on results.</strong><br />Fully done-for-you. You reply and close.</p>
      </div>
    </div>
    </section>
  );
}
