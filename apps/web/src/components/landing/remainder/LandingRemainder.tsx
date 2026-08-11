"use client";

import Link from "next/link";
import Image from "next/image";
import { useRef, useState, type FormEvent, type MouseEvent } from "react";
import { AnimatePresence, m, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  Check,
  CircleX,
  Eye,
  FilePenLine,
  Mail,
  Pause,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Video,
} from "lucide-react";
import { DisplayCards } from "@/components/ui/display-cards";
import { EdgeSurface } from "@/components/ui/edge-surface";
import { FaqSectionCentered } from "@/components/ui/faq-section-centered";
import { Logo } from "@/components/ui/Logo";
import RadialOrbitalTimeline from "@/components/ui/radial-orbital-timeline";
import { ScrollExpandMedia } from "@/components/ui/scroll-expansion-hero";
import AnimatedHighlightText, { Highlight, SparklesIcon } from "@/components/ui/animated-highlight-text";
import { MarkerHighlight } from "@/components/ui/marker-highlight";
import { PointerHighlight } from "@/components/ui/pointer-highlight";
import { cn } from "@/lib/utils";
import { UrlBar } from "@/components/landing/hero/UrlBar";
import { ApprovalPreview } from "./ApprovalPreview";
import { IconFeatureList } from "./IconFeatureList";
import {
  approvalBenefits,
  approvalTabs,
  channelTimeline,
  comparisonRows,
  checkoutStates,
  faqs,
  reviewCards,
  type ApprovalTab,
} from "./content";

function scrollToApproval(event: MouseEvent<HTMLAnchorElement>) {
  event.preventDefault();
  const target = document.getElementById("approval-review");
  if (!target) return;

  const targetTop = target.getBoundingClientRect().top + window.scrollY - 24;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    window.scrollTo(0, targetTop);
    return;
  }

  const startTop = window.scrollY;
  const distance = targetTop - startTop;
  const duration = 1_050;
  const startedAt = performance.now();
  const root = document.documentElement;
  const previousScrollBehavior = root.style.scrollBehavior;
  root.style.scrollBehavior = "auto";

  const animate = (now: number) => {
    const progress = Math.min((now - startedAt) / duration, 1);
    const eased = progress < 0.5
      ? 4 * progress * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 3) / 2;
    window.scrollTo(0, startTop + distance * eased);

    if (progress < 1) {
      window.requestAnimationFrame(animate);
    } else {
      root.style.scrollBehavior = previousScrollBehavior;
    }
  };

  window.requestAnimationFrame(animate);
}

function DifferentiationSection() {
  return (
    <EdgeSurface data-navbar-theme="light" className="relative z-10 -mt-7 py-16 sm:-mt-9 sm:py-24 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 min-[360px]:px-5 sm:px-8 lg:px-10 large-desktop:max-w-[88rem] large-desktop:px-12">
        <div className="grid items-center gap-14 lg:grid-cols-[0.72fr_1.28fr] lg:gap-20">
          <div>
            <p className="text-xs font-semibold uppercase text-[#5b39d5] 2xl:text-sm">Trust and differentiation</p>
            <h2 className="mt-4 max-w-lg text-balance text-4xl font-semibold leading-tight text-[#111527] sm:text-5xl 2xl:text-6xl large-desktop:max-w-xl large-desktop:text-[4.125rem]">
              Why <PointerHighlight inline rectangleClassName="rounded-lg border-[#8b7fd4]/65" pointerClassName="text-[#5b39d5]"><span className="relative z-10">LeadReacher</span></PointerHighlight> is different.
            </h2>
            <p className="mt-6 max-w-lg text-base leading-7 text-[#62697e] 2xl:text-lg 2xl:leading-8">The repetitive work stays visible, reviewable, and coordinated. You keep control of what reaches a prospect.</p>
          </div>
          <div className="grid overflow-hidden rounded-lg border border-[#dedbea] shadow-[0_20px_60px_rgba(38,27,87,0.08)] sm:grid-cols-2">
            <div className="bg-[#faf9fd] p-6 sm:p-8"><p className="text-xs font-semibold uppercase text-[#74798b]">Traditional outreach</p><div className="mt-5 divide-y divide-[#e6e3ed]">{comparisonRows.map(([traditional]) => <div key={traditional} className="flex min-h-12 items-center gap-3 py-3 text-sm text-[#555b6f]"><CircleX className="size-5 shrink-0 text-[#9ba0af]" />{traditional}</div>)}</div></div>
            <div className="bg-[#101322] p-6 text-white sm:p-8"><p className="text-xs font-semibold uppercase text-[#9278ff]">LeadReacher</p><div className="mt-5 divide-y divide-white/10">{comparisonRows.map(([, leadreacher], index) => <div key={leadreacher} className={cn("flex min-h-12 items-center gap-3 py-3 text-sm", index === comparisonRows.length - 1 ? "font-semibold text-[#b6a5ff]" : "text-white/82")}><span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[#5d36f0]"><Check className="size-3" /></span>{leadreacher}</div>)}</div></div>
          </div>
        </div>

        <div className="mt-16 grid overflow-hidden rounded-2xl bg-[#080a12] sm:mt-24 lg:grid-cols-[0.72fr_1.28fr]">
          <div className="flex flex-col justify-center p-8 text-white sm:p-12 lg:p-14">
            <p className="text-xs font-semibold uppercase text-[#5b39d5]">Meet customers where they already are</p>
            <h2 className="mt-4 max-w-md text-balance text-3xl font-semibold leading-tight text-white sm:text-4xl">One workspace. Every supported conversation.</h2>
            <p className="mt-5 max-w-lg text-base leading-7 text-white/62">Connect the accounts your audience uses, then keep campaign and reply context together.</p>
            <p className="mt-7 text-xs font-medium text-[#a995ff]">Select a channel to inspect how it fits the workflow.</p>
          </div>
          <RadialOrbitalTimeline timelineData={channelTimeline} className="rounded-none" />
        </div>
      </div>
    </EdgeSurface>
  );
}

function CampaignExpansionSection() {
  const [activeTab, setActiveTab] = useState<ApprovalTab>("Email");
  const videoTargetRef = useRef<HTMLDivElement>(null);
  const moveTab = (direction: 1 | -1) => {
    const current = approvalTabs.indexOf(activeTab);
    setActiveTab(approvalTabs[(current + direction + approvalTabs.length) % approvalTabs.length]);
  };

  return (
    <ScrollExpandMedia
      mediaSrc="/landing/product-story/personalized-video-outreach.mp4"
      mediaAlt="Personalized video outreach prepared for a prospect"
      mediaType="video"
      posterSrc="/landing/product-story/personalized-video-outreach-poster.jpg"
      eyebrow="Personalized video outreach"
      title={<>The first to feature one‑of‑a‑kind personalized video outreach for <MarkerHighlight>each prospect.</MarkerHighlight></>}
      description={<AnimatedHighlightText as="p" className="pointer-events-auto !max-w-none !text-inherit !text-base !leading-inherit sm:!text-base lg:!text-lg">Don&apos;t worry, you <a href="#approval-review" onClick={scrollToApproval} aria-label="See how approval works" className="rounded-sm text-inherit outline-offset-4 focus-visible:outline-2 focus-visible:outline-[#b6a6ff]"><Highlight tabIndex={-1} icon={<SparklesIcon />} color="#b6a6ff" autoPlay>approve all outgoing content</Highlight></a> before it reaches your customer.</AnimatedHighlightText>}
      magicMoveTargetRef={videoTargetRef}
    >
      <div className="mx-auto max-w-7xl large-desktop:max-w-[88rem]">
        <div id="approval-review" className="scroll-mt-24 grid items-center gap-10 lg:grid-cols-[0.62fr_1.38fr] lg:gap-16">
          <div>
            <p className="text-xs font-semibold uppercase text-[#ae9bff] large-desktop:text-sm">You are always in control</p>
            <h2 className="mt-4 text-balance text-4xl font-semibold leading-tight text-white large-desktop:text-[2.75rem]">
              Nothing goes live <MarkerHighlight>until you approve it.</MarkerHighlight>
            </h2>
            <p className="mt-5 text-base leading-7 text-white/64 large-desktop:text-lg large-desktop:leading-8">Review the people, message sequence, channel routing, and video choice before launch.</p>
            <IconFeatureList
              items={[
                { icon: UserCheck, label: approvalBenefits[0] },
                { icon: FilePenLine, label: approvalBenefits[1] },
                { icon: Video, label: approvalBenefits[2] },
              ]}
              className="mt-7 space-y-4 text-sm font-medium text-white/82 large-desktop:text-base"
              itemClassName="flex items-center gap-3"
              iconWrapperClassName="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#6842f5] text-white ring-1 ring-white/15"
              iconClassName="size-3.5"
            />
          </div>
          <div onKeyDown={(event) => { if (event.key === "ArrowRight") moveTab(1); if (event.key === "ArrowLeft") moveTab(-1); }}>
            <ApprovalPreview
              activeTab={activeTab}
              onTabChange={setActiveTab}
              videoTargetRef={videoTargetRef}
              videoSrc="/landing/product-story/personalized-video-outreach.mp4"
              videoPoster="/landing/product-story/personalized-video-outreach-poster.jpg"
            />
          </div>
        </div>
      </div>
    </ScrollExpandMedia>
  );
}

function PricingAndFaqSection() {
  const [activeReviewIndex, setActiveReviewIndex] = useState(1);
  const activeCheckoutState = checkoutStates[activeReviewIndex];

  return (
    <EdgeSurface as="section" id="pricing" data-navbar-theme="light" className="relative z-40 -mt-7 scroll-mt-20 rounded-[28px] py-16 sm:-mt-9 sm:rounded-[40px] sm:py-24 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 min-[360px]:px-5 sm:px-8 lg:px-10 large-desktop:max-w-[88rem] large-desktop:px-12">
        <div className="mt-20 grid items-center gap-10 sm:mt-24 lg:grid-cols-[.9fr_1.1fr] lg:gap-14">
          <div className="relative min-h-[647px] rounded-lg bg-[#101322] p-7 text-white shadow-[0_30px_80px_rgba(26,19,65,0.2)] sm:p-9 lg:order-2">
            <AnimatePresence mode="wait" initial={false}>
              <m.div
                key={activeReviewIndex}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
                className="flex h-full flex-col"
              >
                <p className="text-xs font-semibold uppercase text-[#9d86ff]">{activeCheckoutState.eyebrow}</p>
                <div className="mt-5 flex items-center justify-between gap-3 border-y border-white/10 py-3">
                  <div className="flex items-center gap-3">
                    <Image src="/landing/portraits/prospect-68.webp" alt="Sarah" width={36} height={36} className="size-9 rounded-full border border-white/20 object-cover" />
                    <div><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/42">Prepared for</p><p className="mt-0.5 text-sm font-semibold text-white">Sarah · Common Thread</p></div>
                  </div>
                  <span className="shrink-0 rounded-full border border-[#8e79ff]/35 bg-[#6240f5]/15 px-2.5 py-1 text-[10px] font-semibold text-[#c0b5ff]">{activeCheckoutState.status}</span>
                </div>
                <h3 className="mt-4 max-w-md text-3xl font-semibold">{activeCheckoutState.title}</h3>
                <p className="mt-4 min-h-[3rem] text-sm leading-6 text-white/62">{activeCheckoutState.description}</p>
                <ul className="mt-7 divide-y divide-white/10">
                  {activeCheckoutState.features.map((item) => <li key={item} className="flex items-center gap-3 py-3 text-sm"><span className="flex size-5 items-center justify-center rounded-full bg-[#6240f5]"><Check className="size-3" /></span>{item}</li>)}
                </ul>
                <div className="mt-auto pt-8">
                  <Link href="/signup" className="flex h-12 items-center justify-center gap-2 rounded-lg bg-[#5a32ed] font-semibold transition-colors hover:bg-[#6842f5]">{activeCheckoutState.action} <ArrowRight className="size-4" /></Link>
                  <p className="mt-4 text-center text-xs text-white/50">{activeCheckoutState.note}</p>
                </div>
              </m.div>
            </AnimatePresence>
          </div>
          <div className="px-1 py-4 sm:px-6 lg:order-1"><p className="text-xs font-semibold uppercase text-[#5b39d5] 2xl:text-sm">Built for review, not guesswork</p><h2 className="mt-4 text-3xl font-semibold text-[#111527] 2xl:text-4xl">The work stays visible as it moves.</h2><p className="mt-4 max-w-xl text-base leading-7 text-[#62697e] 2xl:text-lg 2xl:leading-8">Each stage has an explicit review point, a clear status, and a direct path into the next action.</p><DisplayCards cards={reviewCards} activeIndex={activeReviewIndex} onActiveChange={setActiveReviewIndex} className="mt-3" /></div>
        </div>
        <div id="resources" className="mt-20 scroll-mt-24 sm:mt-24">
          <FaqSectionCentered items={faqs} eyebrow="Questions? We have answers." heading="Know what happens before you start." description="Clear answers about setup, channels, review, personalization, and campaign control." supportEmail="support@leadreacher.com" />
        </div>
      </div>
    </EdgeSurface>
  );
}

function FooterUrlBar() {
  const [websiteUrl, setWebsiteUrl] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = websiteUrl.trim();
    const heroInput = document.getElementById("landing-website-url") as HTMLInputElement | null;
    if (heroInput && value) {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(heroInput, value);
      heroInput.dispatchEvent(new Event("input", { bubbles: true }));
    }

    const target = document.getElementById("top");
    if (target) target.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    window.setTimeout(() => heroInput?.focus(), 450);
  }

  return (
    <div className="lg:justify-self-end">
      <UrlBar
        id="footer-website-url"
        value={websiteUrl}
        onValueChange={setWebsiteUrl}
        onSubmit={handleSubmit}
        formClassName="w-full max-w-[calc(100vw-2rem)] sm:w-[34rem] lg:w-[36rem]"
      />
      <p className="mt-3 text-center text-xs text-white/50">No credit card required</p>
    </div>
  );
}

export function FinalCtaAndFooter({ navbarDark }: { navbarDark: boolean }) {
  const reducedMotion = useReducedMotion();

  return (
    <footer data-navbar-theme={navbarDark ? "dark" : undefined} className="relative z-30 mt-0 overflow-hidden bg-[linear-gradient(180deg,#0b0d19_0%,#080a14_100%)] px-4 pb-[max(2rem,var(--safe-area-bottom))] pt-20 text-white min-[360px]:px-5 sm:px-8 sm:pb-10 sm:pt-28 md:pt-32">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(circle_at_50%_0%,rgba(93,64,224,.14),transparent_62%)]" />
      <m.div
        initial={false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reducedMotion ? 0.1 : 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10"
      >
        <section className="relative mx-auto max-w-7xl overflow-hidden rounded-2xl border border-white/10 bg-[#111427] px-6 py-10 shadow-[0_30px_90px_rgba(0,0,0,.28)] sm:px-10 sm:py-12 lg:px-14 large-desktop:max-w-[88rem] large-desktop:px-16 large-desktop:py-14">
          <div className="relative grid items-center gap-9 lg:grid-cols-[1.2fr_.8fr] lg:gap-16">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase text-[#aa96ff] 2xl:text-sm"><Sparkles className="size-4" /> Start with your website</div>
              <h2 className="mt-4 max-w-3xl text-balance text-3xl font-semibold leading-tight sm:text-4xl lg:text-5xl 2xl:text-6xl large-desktop:max-w-4xl large-desktop:text-[4.125rem]">Drop your URL. We’ll take it from there.</h2>
              <p className="mt-4 max-w-xl text-sm leading-6 text-white/68 sm:text-base sm:leading-7">See how LeadReacher turns your business into a reviewable audience, campaign, and outreach workflow.</p>
            </div>
            <FooterUrlBar />
          </div>
          <div className="relative mt-10 grid gap-3 border-t border-white/10 pt-6 text-xs text-white/62 sm:grid-cols-3 sm:gap-6">
            <span className="flex items-center gap-2"><ShieldCheck className="size-4 text-[#a994ff]" /> Your campaign stays reviewable</span>
            <span className="flex items-center gap-2"><Eye className="size-4 text-[#a994ff]" /> Approve before anything launches</span>
            <span className="flex items-center gap-2"><Pause className="size-4 text-[#a994ff]" /> Pause campaign delivery anytime</span>
          </div>
        </section>

        <div className="mx-auto grid max-w-7xl gap-12 px-1 pb-4 pt-14 md:grid-cols-[1.5fr_repeat(3,1fr)] lg:gap-16 large-desktop:max-w-[88rem] large-desktop:pt-16">
          <div>
            <Logo variant="white" align="left" className="h-8" />
            <p className="mt-5 max-w-sm text-sm leading-6 text-white/62">Multi-channel outreach and personalized video in one clear, reviewable workflow.</p>
            <a href="mailto:support@leadreacher.com" className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-white/78 transition-colors hover:text-white"><Mail className="size-4 text-[#a994ff]" /> support@leadreacher.com</a>
          </div>
          <nav aria-label="Product links"><p className="text-sm font-semibold text-white">Product</p><div className="mt-3 text-sm text-white/58"><Link href="/#product" className="flex min-h-11 items-center transition-colors hover:text-white">Product tour</Link><Link href="/#how-it-works" className="flex min-h-11 items-center transition-colors hover:text-white">How it works</Link><Link href="/pricing" className="flex min-h-11 items-center transition-colors hover:text-white">Pricing</Link></div></nav>
          <nav aria-label="Resource links"><p className="text-sm font-semibold text-white">Resources</p><div className="mt-3 text-sm text-white/58"><a href="mailto:support@leadreacher.com" className="flex min-h-11 items-center transition-colors hover:text-white">Help center</a><Link href="/privacy" className="flex min-h-11 items-center transition-colors hover:text-white">Privacy</Link><Link href="/terms" className="flex min-h-11 items-center transition-colors hover:text-white">Terms</Link></div></nav>
          <nav aria-label="Account links"><p className="text-sm font-semibold text-white">Account</p><div className="mt-3 text-sm text-white/58"><Link href="/signup" className="flex min-h-11 items-center transition-colors hover:text-white">Get started</Link><Link href="/login" className="flex min-h-11 items-center transition-colors hover:text-white">Log in</Link></div></nav>
        </div>
        <div className="mx-auto flex max-w-7xl flex-col gap-3 border-t border-white/10 px-1 pt-6 text-xs text-white/40 sm:flex-row sm:items-center sm:justify-between large-desktop:max-w-[88rem]"><p>© 2026 LeadReacher. All rights reserved.</p><p>Built for visible, reviewable outreach.</p></div>
      </m.div>
    </footer>
  );
}

function FooterReveal() {
  return (
    <div className="relative z-30 isolate bg-[#111318]">
      <div className="relative z-10 bg-[#111318]">
        <PricingAndFaqSection />
      </div>
      <div className="relative z-0 md:sticky md:bottom-0">
        <FinalCtaAndFooter navbarDark />
      </div>
    </div>
  );
}

export default function LandingRemainder() {
  return <><DifferentiationSection /><CampaignExpansionSection /><FooterReveal /></>;
}
