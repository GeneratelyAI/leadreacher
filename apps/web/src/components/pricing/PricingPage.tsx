"use client";

import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Video } from "lucide-react";
import { cn } from "@/lib/utils";
import ShimmerText from "@/components/ui/shimmer-text";
import { FaqSectionCentered } from "@/components/ui/faq-section-centered";
import LandingFooter from "@/components/landing/remainder/LandingFooter";
import { ChannelLogo, type ChannelLogoName } from "@/components/onboarding/ChannelLogo";
import PricingComparison, { type ComparisonRow } from "@/components/pricing/PricingComparison";
import { SUPPORT_EMAIL } from "@/lib/constants/brand";

type CampaignGoal = "personalized_outreach" | "ai_video_ad" | "uploaded_video";
type BillingCycle = "monthly" | "yearly";
type PublicPlan = {
  campaignType: CampaignGoal;
  label: string;
  unitAmount: number | null;
  currency: string | null;
  interval: string | null;
};

const PLANS: Record<CampaignGoal, {
  name: string;
  subtitle: string;
  description: string;
  highlights: string[];
  features: string[];
  featured?: boolean;
  dark?: boolean;
}> = {
  uploaded_video: {
    name: "Uploaded video",
    subtitle: "Bring your creative",
    description: "Use an approved video while LeadReacher handles targeting and delivery.",
    highlights: ["Unlimited supported channels", "Unified reply inbox"],
    features: ["Audience research", "Uploaded video delivery", "Multi-channel sequencing", "Campaign controls"],
  },
  personalized_outreach: {
    name: "Personalized outreach",
    subtitle: "Done for you",
    description: "An individualized campaign built around each prospect and your offer.",
    highlights: ["Prospect-level personalization", "Video personalization included"],
    features: ["Everything in Uploaded video", "Personalized video choices", "Automated follow-ups", "Reply-aware sequence stopping"],
    featured: true,
  },
  ai_video_ad: {
    name: "AI video campaign",
    subtitle: "Creative at scale",
    description: "Generate AI campaign creative and deliver it through a reviewed workflow.",
    highlights: ["AI-generated creative", "Approval before delivery"],
    features: ["Audience and positioning strategy", "Channel routing", "Performance reporting", "Unified reply context"],
    dark: true,
  },
};

const ORDER: CampaignGoal[] = ["uploaded_video", "personalized_outreach", "ai_video_ad"];
const comparisonRows: ComparisonRow[] = [
  { label: "Audience research", values: [true, true, true] },
  { label: "Multi-channel outreach", values: [true, true, true] },
  { label: "Automated follow-ups", values: [true, true, true] },
  { label: "Unified reply inbox", values: [true, true, true] },
  { label: "Prospect-level personalization", values: [false, true, true] },
  { label: "Personalized video choices", values: [false, true, false] },
  { label: "AI-generated video creative", values: [false, false, true] },
];

const pricingFaqs = [
  ["Why is the amount confirmed during setup?", "Your campaign and video choices determine the Stripe line items. LeadReacher shows the complete total before checkout."],
  ["Is this a per-seat price?", "No. Pricing follows the campaign configuration, not the number of teammates or connected channels."],
  ["Can I review the campaign first?", "Yes. Audience, messages, routing, and video choices remain reviewable before anything launches."],
  ["Can I pause delivery?", "Yes. Active delivery can be paused from the campaign controls."],
] as const;

const supportedChannels: readonly ({ label: string; logo: ChannelLogoName } | { label: string; icon: typeof Video })[] = [
  { label: "LinkedIn", logo: "linkedin" },
  { label: "WhatsApp", logo: "whatsapp-mark" },
  { label: "Instagram", logo: "instagram" },
  { label: "Gmail", logo: "gmail" },
  { label: "Outlook", logo: "outlook" },
  { label: "Video", icon: Video },
];

function formatPrice(plan?: PublicPlan) {
  if (!plan || plan.unitAmount === null || !plan.currency) return null;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: plan.currency.toUpperCase(),
    maximumFractionDigits: plan.unitAmount % 100 === 0 ? 0 : 2,
  }).format(plan.unitAmount / 100);
}

export default function PricingPage() {
  const [prices, setPrices] = useState<Partial<Record<CampaignGoal, PublicPlan>>>({});
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");

  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");
    if (!base) return;
    const controller = new AbortController();
    fetch(`${base}/public/pricing`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data: { plans: PublicPlan[] }) => setPrices(Object.fromEntries(data.plans.map((plan) => [plan.campaignType, plan]))))
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

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
            Pay for the campaign you need.<br />Connect every supported channel.
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
          {ORDER.map((type) => {
            const plan = PLANS[type];
            const price = formatPrice(prices[type]);
            return (
              <article key={type} className={cn(
                "group relative flex min-h-0 flex-col overflow-hidden rounded-[20px] border p-5 shadow-[0_18px_45px_rgba(66,42,148,0.08)] transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-1 hover:shadow-[0_24px_60px_rgba(66,42,148,0.16)] sm:min-h-[640px] sm:rounded-[22px] sm:p-7",
                plan.dark
                  ? "border-[#2e2860] bg-[linear-gradient(150deg,#111322_0%,#18133e_52%,#201257_100%)] text-white"
                  : plan.featured
                    ? "border-brand-purple/25 bg-[linear-gradient(150deg,rgba(255,255,255,.88),rgba(246,241,255,.88))] text-[#111322] backdrop-blur-xl"
                    : "border-white/80 bg-white/72 text-[#111322] backdrop-blur-xl",
              )}>
                {!plan.dark ? <span aria-hidden className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-brand-purple/35 to-transparent" /> : null}
                {plan.featured && (
                  <span className="absolute right-0 top-0 -translate-y-px rounded-bl-xl rounded-tr-[22px] bg-[#24106e] px-4 py-2 text-sm font-medium text-[#e7f56f] shadow-[0_8px_24px_rgba(36,16,110,.2)]">
                    <span className="mr-2">◉</span>Most popular
                  </span>
                )}
                <h2 className={cn("text-[1.45rem] font-medium leading-tight sm:text-[1.75rem]", plan.featured && "pr-28")}>{plan.name}</h2>
                <p className={cn("mt-2 text-sm", plan.dark ? "text-white/60" : "text-[#757575]")}>{plan.subtitle}</p>
                <div className="mt-7 min-h-[68px] sm:mt-11 sm:min-h-[76px]">
                  <p className="text-[2.15rem] font-medium leading-none sm:text-[2.5rem]">{price ?? "Custom"}</p>
                  <p className={cn("mt-3 text-sm", plan.dark ? "text-white/60" : "text-[#757575]")}>
                    {price ? "Per campaign" : "Confirmed before checkout"}
                  </p>
                </div>
                <ul className="mt-6 space-y-2.5">
                  {plan.highlights.map((highlight) => (
                    <li key={highlight} className={cn("flex items-center gap-3 text-sm", plan.dark ? "text-white/70" : "text-[#596078]")}>
                      <span className={cn("flex size-5 items-center justify-center rounded-full text-[9px]", plan.dark ? "bg-white/10 text-[#8b7fd4]" : "bg-brand-purple/8 text-brand-purple")}>●</span>{highlight}
                    </li>
                  ))}
                </ul>
                <div className={cn("mt-8 border-t pt-6", plan.dark ? "border-white/12" : "border-[#ededed]")}>
                  <p className="text-sm font-medium">{plan.description}</p>
                  <ul className="mt-5 space-y-3">
                    {plan.features.map((feature) => (
                    <li key={feature} className={cn("flex gap-3 text-sm", plan.dark ? "text-white/65" : "text-[#596078]")}>
                        <Check className="mt-0.5 size-4 shrink-0" />{feature}
                      </li>
                    ))}
                  </ul>
                </div>
                <Link href={`/signup?campaignType=${type}`} className={cn(
                  "mt-8 inline-flex min-h-12 items-center justify-center gap-2 rounded-full border px-5 text-sm font-medium transition-[background-color,border-color,color,transform] hover:-translate-y-px sm:mt-auto",
                  plan.dark ? "border-white/40 text-white hover:border-white hover:bg-white hover:text-[#111]" : "border-brand-purple/20 text-brand-purple hover:border-brand-purple hover:bg-brand-purple hover:text-white",
                )}>
                  Build campaign <ArrowRight className="size-4" />
                </Link>
                <p className={cn("mt-3 text-center text-xs", plan.dark ? "text-white/45" : "text-[#8a8a8a]")}>No card required to start</p>
              </article>
            );
          })}
        </div>

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
          eyebrow="Choose the workflow that fits"
          heading="Compare campaigns"
          ctaLabel="Choose plan"
          plans={ORDER.map((type) => {
            const plan = PLANS[type];
            const price = formatPrice(prices[type]);
            return {
              id: type,
              name: plan.name,
              price: price ?? "Custom",
              priceSuffix: price ? "/campaign" : "",
              featured: plan.featured,
              href: `/signup?campaignType=${type}`,
            };
          })}
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
