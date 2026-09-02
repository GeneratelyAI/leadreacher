"use client";

import type { CSSProperties } from "react";
import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Video } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import ShimmerText from "@/components/ui/shimmer-text";
import { FaqSectionCentered } from "@/components/ui/faq-section-centered";
import LandingFooter from "@/components/landing/remainder/LandingFooter";
import { ChannelLogo, type ChannelLogoName } from "@/components/onboarding/ChannelLogo";
import PricingComparison, { type ComparisonRow } from "@/components/pricing/PricingComparison";
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

const comparisonRows: ComparisonRow[] = [
  { label: "How it is billed", values: ["Required base", "Optional add-on", "Optional add-on"] },
  { label: "What it adds", values: ["Core platform", "One more channel", "Personalized video"] },
  { label: "Platform and campaign controls", values: ["Included", "Requires Pro", "Requires Pro"] },
  { label: "Outreach channels", values: ["First channel included", "Adds one channel", "No channel added"] },
  { label: "Audience research", values: ["Included", "Uses Pro workflow", "Uses Pro workflow"] },
  { label: "Automated follow-ups", values: ["Included", "Available through Pro", "Available through Pro"] },
  { label: "Unified reply inbox", values: ["Included", "Replies stay unified", "Replies stay unified"] },
  { label: "Prospect-level personalized video", values: ["Not included", "Not included", "Included"] },
  { label: "Review before delivery", values: ["Included", "Included", "Included"] },
];

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
        <PricingComparison
          eyebrow="Build your subscription"
          heading="See what each price includes"
          ctaLabel="Start setup"
          plans={[
            {
              id: "pro",
              name: "LeadReacher Pro",
              price: billingPrice(199.99, billingCycle, 2000),
              priceSuffix: billingPeriod,
              featured: true,
              href: "/signup",
            },
            {
              id: "channel",
              name: "Additional channel",
              price: `+${billingPrice(50, billingCycle, 500)}`,
              priceSuffix: billingPeriod,
              href: "/signup",
            },
            {
              id: "video",
              name: "Personalized video",
              price: `+${billingPrice(30, billingCycle, 300)}`,
              priceSuffix: billingPeriod,
              href: "/signup",
            },
          ]}
          rows={comparisonRows}
        />
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
