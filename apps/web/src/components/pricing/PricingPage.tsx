"use client";

import type { CSSProperties } from "react";
import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Check, Minus, Plus, Video } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import ShimmerText from "@/components/ui/shimmer-text";
import { FaqSectionCentered } from "@/components/ui/faq-section-centered";
import LandingFooter from "@/components/landing/remainder/LandingFooter";
import { ChannelLogo, type ChannelLogoName } from "@/components/onboarding/ChannelLogo";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import { SUPPORT_EMAIL } from "@/lib/constants/brand";

type BillingCycle = "monthly" | "yearly";

function billingPrice(monthlyPrice: number, billingCycle: BillingCycle, yearlyPrice: number): string {
  const amount = billingCycle === "yearly"
    ? yearlyPrice
    : monthlyPrice;

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function AnimatedBillingPrice({
  monthlyPrice,
  yearlyPrice,
  billingCycle,
  prefix = "",
}: {
  monthlyPrice: number;
  yearlyPrice: number;
  billingCycle: BillingCycle;
  prefix?: string;
}) {
  const monthly = `${prefix}${billingPrice(monthlyPrice, "monthly", yearlyPrice)}`;
  const yearly = `${prefix}${billingPrice(monthlyPrice, "yearly", yearlyPrice)}`;

  return (
    <span className="relative inline-grid h-[1.08em] overflow-hidden align-baseline [mask-image:linear-gradient(to_bottom,transparent_0%,black_16%,black_84%,transparent_100%)]" aria-live="polite">
      <span className="sr-only">{billingCycle === "yearly" ? yearly : monthly}</span>
      <span
        aria-hidden
        className={cn(
          "col-start-1 row-start-1 flex flex-col transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform motion-reduce:transition-none",
          billingCycle === "yearly" ? "-translate-y-1/2" : "translate-y-0",
        )}
      >
        <span className="flex h-[1.08em] items-center whitespace-nowrap">{monthly}</span>
        <span className="flex h-[1.08em] items-center whitespace-nowrap">{yearly}</span>
      </span>
    </span>
  );
}

const pricingFaqs = [
  ["What does LeadReacher Pro include?", "LeadReacher Pro is $199.99 per month or $2,000 per year and includes the platform, your first outreach channel, campaign controls, and the unified reply inbox."],
  ["How are additional channels priced?", "Your first outreach channel is included. Each additional channel costs $50 per month or $500 per year."],
  ["How much does personalized video cost?", "Personalized video is an optional $30 per month or $300 per year. It is only added when you select personalized video."],
  ["Is this a per-seat or per-campaign price?", "No. The base price is a monthly platform subscription. Your total changes only when you add channels or personalized video."],
  ["Can I review the campaign first?", "Yes. Audience, messages, routing, and video choices remain reviewable before anything launches."],
] as const;

const supportedChannels: readonly ({ label: string; logo: ChannelLogoName } | { label: string; icon: typeof Video })[] = [
  { label: "LinkedIn", logo: "linkedin" },
  { label: "WhatsApp", logo: "whatsapp-mark" },
  { label: "Instagram", logo: "instagram" },
  { label: "Gmail", logo: "gmail" },
  { label: "Outlook", logo: "outlook" },
  { label: "Video", icon: Video },
];

function AnimatedSlotPrice({ value }: { value: string }) {
  const reducedMotion = Boolean(useReducedMotion());

  return (
    <span className="relative inline-grid overflow-hidden align-bottom" aria-live="polite" aria-atomic="true">
      <span className="invisible col-start-1 row-start-1" aria-hidden>{value}</span>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={value}
          className="col-start-1 row-start-1 block whitespace-nowrap"
          initial={reducedMotion ? { opacity: 0 } : { y: "105%", opacity: 0, filter: "blur(4px)" }}
          animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
          exit={reducedMotion ? { opacity: 0 } : { y: "-105%", opacity: 0, filter: "blur(4px)" }}
          transition={reducedMotion ? { duration: 0 } : { duration: 0.48, ease: [0.22, 1, 0.36, 1] }}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function SubscriptionBuilder({ billingCycle }: { billingCycle: BillingCycle }) {
  const [additionalChannels, setAdditionalChannels] = useState(0);
  const [personalizedVideo, setPersonalizedVideo] = useState(false);
  const basePrice = billingCycle === "yearly" ? 2000 : 199.99;
  const channelPrice = billingCycle === "yearly" ? 500 : 50;
  const videoPrice = billingCycle === "yearly" ? 300 : 30;
  const total = basePrice + additionalChannels * channelPrice + (personalizedVideo ? videoPrice : 0);
  const period = billingCycle === "yearly" ? "year" : "month";

  return (
    <div className="mx-auto max-w-[1100px]">
      <p className="text-center text-xs font-semibold uppercase tracking-[0.18em] text-[#6b5fbf]">Build your subscription</p>
      <h2 className="mt-3 text-balance text-center text-3xl font-semibold sm:text-[2.6rem]">See your price as you build</h2>
      <p className="mx-auto mt-4 max-w-xl text-center text-sm leading-6 text-[#62697e] sm:text-base">Start with Pro, choose how many additional channels you need, then decide whether to add personalized video.</p>

      <div data-testid="subscription-builder" className="mt-10">
      <SpotlightCard
        spotlightColor="rgba(139, 99, 255, 0.28)"
        spotlightClassName="z-10 motion-reduce:transition-none"
        contentClassName="grid lg:grid-cols-[1.2fr_.8fr]"
        className="cursor-default rounded-[30px] border border-[#e3def4] bg-white/88 p-2 shadow-[0_28px_80px_rgba(66,42,148,0.13)] backdrop-blur-xl"
      >
        <div className="grid h-full gap-3 p-3 sm:grid-rows-3 sm:p-5 lg:p-6">
          <div className="flex flex-col items-stretch gap-5 rounded-2xl border border-[#e7e2f5] bg-[#f8f6ff] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div className="flex min-w-0 items-start gap-4">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#5a32ed] text-xs font-bold text-white shadow-[0_6px_16px_rgba(90,50,237,.22)]">01</span>
              <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h3 className="text-lg font-semibold text-[#111322] sm:text-xl">LeadReacher Pro</h3>
                <span className="rounded-full bg-[#eeeaff] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#5a32ed]">Required</span>
              </div>
              <p className="mt-2 text-sm text-[#6a6d7d]">Platform access and your first outreach channel.</p>
              </div>
            </div>
            <div className="flex shrink-0 items-end justify-between border-t border-[#ded8ef] pt-4 text-left sm:block sm:border-0 sm:pt-0 sm:text-right"><p className="text-sm font-medium text-[#777486] sm:hidden">Base price</p><div><p className="text-xl font-semibold text-[#111322] sm:text-lg">{billingPrice(199.99, billingCycle, 2000)}</p><p className="mt-1 text-xs text-[#777486]">per {period}</p></div></div>
          </div>

          <div className="flex flex-col items-stretch gap-5 rounded-2xl border border-[#ece9f3] bg-white p-5 shadow-[0_8px_24px_rgba(55,39,105,.04)] sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div className="flex min-w-0 items-start gap-4">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#eeeaff] text-xs font-bold text-[#5a32ed]">02</span>
              <div className="min-w-0">
              <h3 className="text-lg font-semibold text-[#111322] sm:text-xl">Additional channels</h3>
              <p className="mt-2 text-sm text-[#6a6d7d]">{billingPrice(50, billingCycle, 500)} per channel, per {period}.</p>
              </div>
            </div>
            <div className="flex w-full shrink-0 items-center justify-between gap-2 rounded-full border border-[#ded9ef] bg-[#f8f6ff] p-1.5 sm:w-auto sm:justify-start" aria-label="Additional channel quantity">
              <button type="button" onClick={() => setAdditionalChannels((count) => Math.max(0, count - 1))} disabled={additionalChannels === 0} aria-label="Remove an additional channel" className="flex size-9 items-center justify-center rounded-full bg-white text-[#4e28df] shadow-sm transition-colors hover:bg-[#eeeaff] disabled:cursor-not-allowed disabled:text-[#bbb8c5] disabled:shadow-none"><Minus className="size-4" aria-hidden /></button>
              <output aria-live="polite" className="min-w-8 text-center text-lg font-semibold tabular-nums text-[#111322]">{additionalChannels}</output>
              <button type="button" onClick={() => setAdditionalChannels((count) => Math.min(5, count + 1))} disabled={additionalChannels === 5} aria-label="Add an additional channel" className="flex size-9 items-center justify-center rounded-full bg-[#5a32ed] text-white shadow-[0_6px_16px_rgba(90,50,237,0.25)] transition-colors hover:bg-[#6842f5] disabled:cursor-not-allowed disabled:bg-[#aaa2ca]"><Plus className="size-4" aria-hidden /></button>
            </div>
          </div>

          <div className="flex flex-col items-stretch gap-5 rounded-2xl border border-[#ece9f3] bg-white p-5 shadow-[0_8px_24px_rgba(55,39,105,.04)] sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div className="flex min-w-0 items-start gap-4">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#eeeaff] text-xs font-bold text-[#5a32ed]">03</span>
              <div className="min-w-0">
              <h3 className="text-lg font-semibold text-[#111322] sm:text-xl">Personalized video</h3>
              <p className="mt-2 text-sm text-[#6a6d7d]">Add prospect-level video for {billingPrice(30, billingCycle, 300)} per {period}.</p>
              </div>
            </div>
            <button type="button" role="switch" aria-checked={personalizedVideo} onClick={() => setPersonalizedVideo((enabled) => !enabled)} className={cn("relative h-8 w-14 shrink-0 self-end rounded-full p-1 transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7c58ed] focus-visible:ring-offset-2 sm:self-auto", personalizedVideo ? "bg-[#5a32ed]" : "bg-[#d9d6e2]")}>
              <span aria-hidden className={cn("block size-6 rounded-full bg-white shadow-sm transition-transform duration-300", personalizedVideo && "translate-x-6")} />
              <span className="sr-only">Add personalized video</span>
            </button>
          </div>
        </div>

        <aside className="flex flex-col justify-between rounded-[24px] bg-[radial-gradient(circle_at_90%_0%,rgba(126,88,255,.38),transparent_42%),linear-gradient(145deg,#101321,#1a1246)] p-7 text-white shadow-[0_18px_45px_rgba(26,18,74,.22)] sm:p-9 lg:p-10">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#b8a9ff]">Your subscription</p>
            <p className="mt-5 text-sm text-white/60">Estimated total</p>
            <p className="mt-2 min-h-[1.1em] text-4xl font-semibold tracking-tight sm:text-5xl"><AnimatedSlotPrice value={billingPrice(total, billingCycle, total)} /></p>
            <p className="mt-2 text-sm text-white/55">per {period}, billed {billingCycle}</p>
          </div>

          <div className="mt-10 border-t border-white/12 pt-6">
            <ul className="space-y-3 text-sm text-white/72">
              <li className="flex items-center justify-between gap-4"><span>LeadReacher Pro</span><span>{billingPrice(basePrice, billingCycle, basePrice)}</span></li>
              <li className="flex items-center justify-between gap-4"><span>{additionalChannels} additional {additionalChannels === 1 ? "channel" : "channels"}</span><span>{billingPrice(additionalChannels * channelPrice, billingCycle, additionalChannels * channelPrice)}</span></li>
              <li className="flex items-center justify-between gap-4"><span>Personalized video</span><span>{personalizedVideo ? billingPrice(videoPrice, billingCycle, videoPrice) : "Not added"}</span></li>
            </ul>
            <Link href="/signup" className="mt-7 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-[#211557] transition-[transform,background-color] hover:-translate-y-0.5 hover:bg-[#f2edff] motion-reduce:transform-none">Start setup <ArrowRight className="size-4" aria-hidden /></Link>
            <p className="mt-4 text-center text-xs text-white/48">Your final total is confirmed before purchase.</p>
          </div>
        </aside>
      </SpotlightCard>
      </div>
    </div>
  );
}

export default function PricingPage() {
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const billingPeriod = billingCycle === "yearly" ? "per year" : "per month";

  return (
    <>
    <main className="pricing-page pricing-dots relative min-h-dvh overflow-x-clip pt-[88px] text-[#090d1d] sm:pt-[122px]">
      <section className="relative px-4 pb-16 sm:px-6 sm:pb-28">
        <div className="mx-auto w-full max-w-[860px] text-center">
          <h1 className="mx-auto mt-6 max-w-[860px] text-balance text-[2.25rem] font-semibold leading-[1.06] sm:mt-9 sm:text-[4rem]">
            <span className="block">Pricing designed for</span>
            <span className="block">effortless <ShimmerText
                style={{
                  "--lr-shimmer-base": "#4f46e5",
                  "--lr-shimmer-core": "#58a6ff",
                  "--lr-shimmer-edge": "rgba(125, 183, 255, 0.7)",
                } as CSSProperties}
              >outreach.</ShimmerText>
            </span>
          </h1>
          <p className="mx-auto mt-4 max-w-[520px] text-balance text-[0.95rem] leading-6 text-[#596078] sm:mt-6 sm:text-xl sm:leading-8">
            Start with LeadReacher Pro, then add only the channels and video personalization you need.
          </p>
          <div role="group" aria-label="Billing cycle" className="mx-auto mt-9 inline-flex max-w-full flex-nowrap items-center justify-center gap-1.5 rounded-full bg-white px-2 py-1.5 text-xs font-semibold text-[#111] shadow-[0_14px_35px_rgba(66,42,148,0.10)] sm:mt-14 sm:gap-3 sm:px-3.5 sm:py-2.5 sm:text-sm">
            <button type="button" aria-pressed={billingCycle === "monthly"} onClick={() => setBillingCycle("monthly")} className={cn("px-0.5 transition-colors duration-500 hover:text-[#4e28df] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7c58ed] focus-visible:ring-offset-4", billingCycle === "monthly" ? "text-[#111]" : "text-[#656070]")}>Monthly</button>
            <button
              type="button"
              role="switch"
              aria-checked={billingCycle === "yearly"}
              aria-label="Switch between monthly and yearly billing"
              onClick={() => setBillingCycle((cycle) => cycle === "monthly" ? "yearly" : "monthly")}
              className={cn("relative h-6 w-11 shrink-0 rounded-full border bg-white p-0.5 shadow-[inset_0_1px_3px_rgba(0,0,0,0.12)] transition-[border-color,box-shadow] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7c58ed] focus-visible:ring-offset-4 sm:h-7 sm:w-14", billingCycle === "yearly" ? "border-[#5a32ed] shadow-[inset_0_1px_3px_rgba(90,50,237,0.12),0_0_0_1px_rgba(90,50,237,0.08)]" : "border-[#111]")}
            >
              <span aria-hidden className={cn("absolute left-[3px] top-[3px] size-4 rounded-full shadow-[0_2px_5px_rgba(0,0,0,0.3)] will-change-transform transition-[background-color,box-shadow,translate] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none sm:left-1 sm:top-1 sm:size-5", billingCycle === "yearly" ? "translate-x-5 bg-[#5a32ed] shadow-[0_2px_10px_rgba(90,50,237,0.45)] sm:translate-x-6" : "translate-x-0 bg-[#111]")} />
            </button>
            <button type="button" aria-pressed={billingCycle === "yearly"} onClick={() => setBillingCycle("yearly")} className={cn("px-0.5 transition-colors duration-500 hover:text-[#4e28df] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7c58ed] focus-visible:ring-offset-4", billingCycle === "yearly" ? "text-[#4e28df]" : "text-[#111]")}>Yearly</button>
            <span className={cn("whitespace-nowrap rounded-full px-2 py-1.5 text-[11px] font-medium text-white transition-[background-color,box-shadow] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] sm:px-3.5 sm:text-sm", billingCycle === "yearly" ? "bg-[#4e28df] shadow-[0_8px_22px_rgba(78,40,223,0.3)]" : "bg-[#111] shadow-none")}>
              <span className="sr-only">17% Discount</span>
              <span aria-hidden className="grid">
                <span className={cn("col-start-1 row-start-1 transition-opacity duration-300", billingCycle === "yearly" ? "opacity-0" : "opacity-100 line-through decoration-white/80 decoration-1")}>17% Discount</span>
                <ShimmerText
                  className={cn("col-start-1 row-start-1 transition-opacity duration-300", billingCycle === "yearly" ? "opacity-100" : "opacity-0")}
                  style={{ "--lr-shimmer-base": "#ffffff", "--lr-shimmer-core": "#d9cfff", "--lr-shimmer-edge": "rgba(255,255,255,0.35)" } as CSSProperties}
                >
                  17% Discount
                </ShimmerText>
              </span>
            </span>
          </div>
        </div>

        <div className="mx-auto mt-10 grid max-w-[1100px] gap-4 sm:mt-12 sm:gap-5 min-[1000px]:mt-16 min-[1000px]:grid-cols-3">
          <SpotlightCard spotlightColor="rgba(151, 112, 255, 0.42)" spotlightClassName="z-10 mix-blend-screen motion-reduce:transition-none" contentClassName="contents" className="flex h-full flex-col rounded-[22px] border border-[#2e2860] bg-[linear-gradient(150deg,#111322_0%,#18133e_52%,#201257_100%)] px-6 pb-6 pt-14 text-white shadow-[0_24px_60px_rgba(66,42,148,0.18)] sm:px-8 sm:pb-8 sm:pt-14">
            <span className="absolute right-0 top-0 rounded-bl-xl rounded-tr-[22px] bg-brand-purple px-4 py-2 text-sm font-semibold text-white">Base subscription</span>
            <h2 className="whitespace-nowrap text-[1.55rem] font-medium sm:text-[1.8rem]">LeadReacher Pro</h2>
            <p className="mt-2 text-sm text-white/60">Everything you need to launch outreach</p>
            <div className="mt-9"><p className="text-[2.5rem] font-medium leading-none"><AnimatedBillingPrice monthlyPrice={199.99} yearlyPrice={2000} billingCycle={billingCycle} /></p><p className="mt-3 text-sm text-white/60 transition-opacity duration-500">{billingPeriod}</p></div>
            <p className="mt-8 border-t border-white/12 pt-6 text-sm font-medium">Includes the platform and your first outreach channel.</p>
            <ul className="mt-5 space-y-3 text-sm text-white/70">
              {["Audience research", "Campaign controls", "Automated follow-ups", "Unified reply inbox"].map((feature) => <li key={feature} className="flex gap-3"><Check className="mt-0.5 size-4 shrink-0" />{feature}</li>)}
            </ul>
            <Link href="/signup" className="mt-8 inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/40 px-5 text-sm font-medium transition-colors hover:bg-white hover:text-[#111]">Start with Pro <ArrowRight className="size-4" /></Link>
          </SpotlightCard>

          <SpotlightCard spotlightColor="rgba(91, 47, 244, 0.22)" spotlightClassName="z-10 mix-blend-multiply motion-reduce:transition-none" contentClassName="contents" className="flex h-full flex-col rounded-[22px] border border-white/80 bg-white/72 px-6 pb-6 pt-14 text-[#111322] shadow-[0_18px_45px_rgba(66,42,148,0.08)] backdrop-blur-xl sm:px-8 sm:pb-8 sm:pt-14">
            <span aria-hidden className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-brand-purple/35 to-transparent" />
            <h2 className="text-[1.55rem] font-medium sm:text-[1.8rem]">Additional channels</h2>
            <p className="mt-2 text-sm text-[#757575]">Reach people where they already respond</p>
            <div className="mt-9"><p className="text-[2.5rem] font-medium leading-none"><AnimatedBillingPrice monthlyPrice={50} yearlyPrice={500} billingCycle={billingCycle} prefix="+" /></p><p className="mt-3 text-sm text-[#757575]">per additional channel, {billingPeriod}</p></div>
            <p className="mt-8 border-t border-[#ededed] pt-6 text-sm font-medium">Your first channel is included with Pro. Add more during setup.</p>
            <ul className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 text-sm text-[#596078]">
              {([
                { label: "LinkedIn", logo: "linkedin" },
                { label: "Gmail", logo: "gmail" },
                { label: "Outlook", logo: "outlook" },
                { label: "WhatsApp", logo: "whatsapp-mark" },
                { label: "Instagram", logo: "instagram" },
                { label: "Facebook", logo: "facebook" },
              ] satisfies { label: string; logo: ChannelLogoName }[]).map(({ label, logo }) => (
                <li key={label} className="flex items-center gap-2.5">
                  <ChannelLogo name={logo} className="size-5 shrink-0" />
                  {label}
                </li>
              ))}
            </ul>
          </SpotlightCard>

          <SpotlightCard spotlightColor="rgba(91, 47, 244, 0.24)" spotlightClassName="z-10 mix-blend-multiply motion-reduce:transition-none" contentClassName="contents" className="flex h-full flex-col rounded-[22px] border border-brand-purple/25 bg-[linear-gradient(150deg,rgba(255,255,255,.88),rgba(246,241,255,.88))] px-6 pb-6 pt-14 text-[#111322] shadow-[0_18px_45px_rgba(66,42,148,0.08)] backdrop-blur-xl sm:px-8 sm:pb-8 sm:pt-14">
            <span aria-hidden className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-brand-purple/35 to-transparent" />
            <h2 className="text-[1.55rem] font-medium sm:text-[1.8rem]">Personalized video</h2>
            <p className="mt-2 text-sm text-[#757575]">Add prospect-level video personalization</p>
            <div className="mt-9"><p className="text-[2.5rem] font-medium leading-none"><AnimatedBillingPrice monthlyPrice={30} yearlyPrice={300} billingCycle={billingCycle} prefix="+" /></p><p className="mt-3 text-sm text-[#757575]">{billingPeriod}</p></div>
            <p className="mt-8 border-t border-[#ededed] pt-6 text-sm font-medium">Optional. Added only when you choose personalized video.</p>
            <ul className="mt-5 space-y-3 text-sm text-[#596078]">
              {["Personalized for each prospect", "Message and video work together", "Review before delivery", "Included in your monthly total"].map((feature) => <li key={feature} className="flex gap-3"><Check className="mt-0.5 size-4 shrink-0" />{feature}</li>)}
            </ul>
          </SpotlightCard>
        </div>

        <p className="mx-auto mt-7 max-w-[760px] text-center text-sm leading-6 text-[#596078]">
          Example: Pro + two additional channels + personalized video = <strong className="text-[#111322]"><AnimatedBillingPrice monthlyPrice={329.99} yearlyPrice={3300} billingCycle={billingCycle} /> {billingPeriod}</strong>. Your exact total is shown before checkout.
        </p>

        <div className="mx-auto mt-16 max-w-[1100px] text-center sm:mt-28 sm:px-8">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6b5fbf]">Supported across your outreach workflow</p>
          <div className="mt-7 grid grid-cols-2 gap-x-4 gap-y-6 min-[440px]:grid-cols-3 sm:grid-cols-6 sm:gap-y-4">
            {supportedChannels.map((channel) => {
              return (
                <div key={channel.label} className="group/channel flex min-h-24 flex-col items-center justify-center gap-2.5 text-sm font-semibold text-[#3f4260] sm:min-h-28 sm:gap-3">
                  <span className="flex size-16 items-center justify-center transition-transform duration-300 group-hover/channel:scale-110 sm:size-20">
                    {"logo" in channel ? <ChannelLogo name={channel.logo} className="size-14 sm:size-[4.5rem]" /> : <channel.icon className="size-14 text-[#5a32ed] sm:size-[4.5rem]" strokeWidth={1.7} aria-hidden />}
                  </span>
                  <span>{channel.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="relative border-t border-white/45 bg-transparent px-4 py-16 sm:px-6 sm:py-28">
        <SubscriptionBuilder billingCycle={billingCycle} />
      </section>

    </main>
    <LandingFooter>
      <div className="relative bg-[#111318] pt-px">
        <section data-navbar-theme="light" className="relative z-40 -mt-7 isolate overflow-hidden rounded-[28px] bg-white px-4 py-16 sm:-mt-9 sm:rounded-[40px] sm:px-6 sm:py-24 lg:py-28">
          <FaqSectionCentered
            items={pricingFaqs}
            eyebrow="Questions before you launch"
            heading="Know what happens before you choose a campaign."
            description="Clear answers about pricing, review, delivery, and campaign control."
            supportEmail={SUPPORT_EMAIL}
          />
        </section>
      </div>
    </LandingFooter>
    </>
  );
}
