"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  Check,
  CircleX,
  Eye,
  FilePenLine,
  Mail,
  MessagesSquare,
  Pause,
  Play,
  ShieldCheck,
  Sparkles,
  UserCheck,
  UsersRound,
  Video,
} from "lucide-react";
import { DisplayCards } from "@/components/ui/display-cards";
import { FaqSectionCentered } from "@/components/ui/faq-section-centered";
import { Logo } from "@/components/ui/Logo";
import RadialOrbitalTimeline, { type OrbitalTimelineItem } from "@/components/ui/radial-orbital-timeline";
import { ScrollExpansion } from "@/components/ui/scroll-expansion";
import { ScrollExpandMedia } from "@/components/ui/scroll-expansion-hero";
import { cn } from "@/lib/utils";

const comparisonRows = [
  ["Learn complex software", "LeadReacher learns your business"],
  ["Build and manage lists", "You review a focused audience"],
  ["Write every campaign", "LeadReacher drafts the outreach"],
  ["Send follow-ups manually", "Approved follow-ups run automatically"],
  ["Chase replies across inboxes", "Interested replies arrive in Chat"],
] as const;

const channelTimeline: OrbitalTimelineItem[] = [
  { id: 1, title: "LinkedIn", date: "Social", content: "Invites and follow-ups from your connected LinkedIn account.", category: "Social", relatedIds: [2, 3], status: "completed", energy: 100, image: "/dashboard/linkedin-logo.png" },
  { id: 2, title: "WhatsApp", date: "Messaging", content: "Direct conversations with campaign and reply context attached.", category: "Messaging", relatedIds: [1, 3], status: "completed", energy: 100, whatsapp: true },
  { id: 3, title: "Instagram", date: "Social", content: "Professional outreach through a connected Instagram inbox.", category: "Social", relatedIds: [1, 2, 4], status: "completed", energy: 100, image: "/dashboard/instagram-logo.png" },
  { id: 4, title: "Gmail", date: "Email", content: "Approved email sequences sent from your connected Google inbox.", category: "Email", relatedIds: [3, 5], status: "completed", energy: 100, image: "/dashboard/gmail-logo.png" },
  { id: 5, title: "Outlook", date: "Email", content: "Approved email sequences sent from your connected Microsoft inbox.", category: "Email", relatedIds: [4], status: "completed", energy: 100, image: "/dashboard/outlook-logo.png" },
];

const approvalTabs = ["Email", "LinkedIn", "WhatsApp", "Video"] as const;

const faqs = [
  ["How quickly can I get started?", "Drop in your website to begin. LeadReacher analyzes the business first, then guides you through audience, campaign, checkout, and channel connection."],
  ["Do I need technical skills?", "No. The workflow is designed around review and approval rather than technical configuration."],
  ["Which channels can I connect?", "LeadReacher supports LinkedIn, WhatsApp, Instagram, Facebook Messenger, Gmail, and Outlook through connected accounts."],
  ["What can I review before launch?", "You can review prospects, outreach copy, sequence steps, channel routing, and video choices before a campaign goes live."],
  ["How does personalization work?", "LeadReacher uses the business brief, approved strategy, and available prospect context to prepare relevant outreach for review."],
  ["Can I pause a campaign?", "Yes. Campaigns can be paused, and the product exposes delivery state so you can see what is running."],
] as const;

function DifferentiationSection() {
  return (
    <section data-navbar-theme="light" className="relative z-10 -mt-7 rounded-t-[28px] bg-white py-20 sm:-mt-9 sm:rounded-t-[40px] sm:py-24 lg:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
        <div className="grid items-center gap-14 lg:grid-cols-[0.72fr_1.28fr] lg:gap-20">
          <div>
            <p className="text-xs font-semibold uppercase text-[#5b39d5]">Trust and differentiation</p>
            <h2 className="mt-4 max-w-md text-balance text-4xl font-semibold leading-tight text-[#111527] sm:text-5xl">Why LeadReacher is different.</h2>
            <p className="mt-6 max-w-md text-base leading-7 text-[#62697e]">The repetitive work stays visible, reviewable, and coordinated. You keep control of what reaches a prospect.</p>
          </div>
          <div className="grid overflow-hidden rounded-lg border border-[#dedbea] shadow-[0_20px_60px_rgba(38,27,87,0.08)] md:grid-cols-2">
            <div className="bg-[#faf9fd] p-6 sm:p-8"><p className="text-xs font-semibold uppercase text-[#74798b]">Traditional outreach</p><div className="mt-5 divide-y divide-[#e6e3ed]">{comparisonRows.map(([traditional]) => <div key={traditional} className="flex min-h-12 items-center gap-3 py-3 text-sm text-[#555b6f]"><CircleX className="size-5 shrink-0 text-[#9ba0af]" />{traditional}</div>)}</div></div>
            <div className="bg-[#101322] p-6 text-white sm:p-8"><p className="text-xs font-semibold uppercase text-[#9278ff]">LeadReacher</p><div className="mt-5 divide-y divide-white/10">{comparisonRows.map(([, leadreacher], index) => <div key={leadreacher} className={cn("flex min-h-12 items-center gap-3 py-3 text-sm", index === comparisonRows.length - 1 ? "font-semibold text-[#b6a5ff]" : "text-white/82")}><span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[#5d36f0]"><Check className="size-3" /></span>{leadreacher}</div>)}</div></div>
          </div>
        </div>

        <div className="mt-20 grid overflow-hidden rounded-2xl bg-[#080a12] sm:mt-24 lg:grid-cols-[0.72fr_1.28fr]">
          <div className="flex flex-col justify-center p-8 text-white sm:p-12 lg:p-14">
            <p className="text-xs font-semibold uppercase text-[#5b39d5]">Meet customers where they already are</p>
            <h2 className="mt-4 max-w-md text-balance text-3xl font-semibold leading-tight text-white sm:text-4xl">One workspace. Every supported conversation.</h2>
            <p className="mt-5 max-w-md text-base leading-7 text-white/62">Connect the accounts your audience uses, then keep campaign and reply context together.</p>
            <p className="mt-7 text-xs font-medium text-[#a995ff]">Select a channel to inspect how it fits the workflow.</p>
          </div>
          <RadialOrbitalTimeline timelineData={channelTimeline} className="rounded-none" />
        </div>
      </div>
    </section>
  );
}

function ApprovalPreview({ activeTab, onTabChange }: { activeTab: (typeof approvalTabs)[number]; onTabChange: (tab: (typeof approvalTabs)[number]) => void }) {
  return (
    <div className="overflow-hidden rounded-lg border border-[#dcd8e9] bg-[#f9f8fd] shadow-[0_30px_80px_rgba(42,28,104,0.16)]">
      <div role="tablist" aria-label="Outreach preview type" className="grid grid-cols-4 border-b border-[#dfdbe9] bg-white px-2 sm:px-5">
        {approvalTabs.map((tab) => <button key={tab} type="button" role="tab" aria-selected={activeTab === tab} onClick={() => onTabChange(tab)} className={cn("relative h-12 rounded-sm text-xs font-medium text-[#6c7284] transition-colors hover:text-[#292f43] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#8b7fd4] sm:text-sm", activeTab === tab && "text-[#4e28df]")}>{tab}{activeTab === tab ? <span className="absolute inset-x-2 bottom-0 h-0.5 bg-[#4e28df]" /> : null}</button>)}
      </div>
      <div className="grid min-h-[360px] gap-5 p-5 md:grid-cols-[0.9fr_1.1fr] md:p-7">
        <div className="rounded-lg border border-[#e1deeb] bg-white p-5">
          <p className="text-sm font-semibold text-[#4e28df]">Hi Sarah,</p>
          <div className="mt-4 space-y-3 text-sm leading-6 text-[#444a5d]"><p>I noticed your team is focused on making growth execution more consistent.</p><p>We prepared a short idea showing how outreach could stay coordinated without adding another manual workflow.</p><p>Would it be useful to compare notes?</p></div>
          <p className="mt-5 text-sm text-[#444a5d]">Best,<br />Alex</p>
        </div>
        <div className="flex flex-col">
          <div className="relative flex min-h-56 flex-1 items-center justify-center overflow-hidden rounded-lg bg-[#121426]">
            <div aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_65%_35%,rgba(112,76,255,.28),transparent_34%),linear-gradient(145deg,#191d32,#0e1020)]" />
            <div className="relative text-center text-white"><span className="mx-auto flex size-14 items-center justify-center rounded-full bg-white/12 ring-1 ring-white/25"><Play className="ml-1 size-6 fill-white" /></span><p className="mt-4 text-sm font-medium">Personalized video preview</p><p className="mt-1 text-xs text-white/55">Review before launch</p></div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3"><button type="button" className="h-11 rounded-lg border border-[#d9d5e5] bg-white text-sm font-semibold text-[#4b5163] transition-colors hover:bg-[#f5f3fb] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b7fd4]">Edit</button><Link href="/signup" className="flex h-11 items-center justify-center gap-2 rounded-lg bg-[#4e28df] text-sm font-semibold text-white transition-colors hover:bg-[#4020c9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b7fd4]">Approve &amp; continue <ArrowRight className="size-4" /></Link></div>
        </div>
      </div>
    </div>
  );
}

function CampaignExpansionSection() {
  return (
    <ScrollExpandMedia
      mediaSrc="/landing/product-story/outreach.png"
      mediaAlt="LeadReacher outreach dashboard showing a reviewed campaign sequence"
      eyebrow="From review to delivery"
      title="See the work before it reaches a prospect."
      description="LeadReacher keeps the audience, message sequence, and delivery status visible while the campaign moves forward."
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-[#b6a6ff]">Campaign ready</p>
          <p className="mt-2 max-w-xl text-xl font-semibold sm:text-2xl">Approved outreach moves into scheduled delivery.</p>
        </div>
        <div className="flex shrink-0 items-center gap-2 rounded-full border border-white/15 bg-[#111426]/80 px-4 py-2 text-xs font-medium text-white/78 backdrop-blur-md">
          <span className="size-2 rounded-full bg-[#54d69b]" /> Review complete
        </div>
      </div>
    </ScrollExpandMedia>
  );
}

function ApprovalSection() {
  const [activeTab, setActiveTab] = useState<(typeof approvalTabs)[number]>("Email");
  return (
    <section data-navbar-theme="dark" className="relative z-20 -mt-7 overflow-hidden rounded-t-[28px] bg-[#111318] py-20 text-white sm:-mt-9 sm:rounded-t-[40px] sm:py-24 lg:py-28">
      <div aria-hidden className="absolute inset-0 bg-[linear-gradient(90deg,rgba(17,19,24,.86),rgba(17,19,24,.48)_48%,rgba(17,19,24,.7))]" />
      <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-5 sm:px-8 lg:grid-cols-[0.62fr_1.38fr] lg:px-10">
        <div><p className="text-xs font-semibold uppercase text-[#ae9bff]">You are always in control</p><h2 className="mt-4 text-balance text-4xl font-semibold leading-tight text-white">Nothing goes live until you approve it.</h2><p className="mt-5 text-base leading-7 text-white/64">Review the people, message sequence, channel routing, and video choice before launch.</p><ul className="mt-7 space-y-4 text-sm font-medium text-white/82">{[[UserCheck, "Review and approve prospects"], [FilePenLine, "Edit personalized messages"], [Video, "Watch and approve video choices"]].map(([Icon, text]) => { const ItemIcon = Icon as typeof UserCheck; return <li key={text as string} className="flex items-center gap-3"><span className="flex size-6 items-center justify-center rounded-full bg-[#6842f5] text-white ring-1 ring-white/15"><ItemIcon className="size-3.5" /></span>{text as string}</li>; })}</ul></div>
        <ScrollExpansion><ApprovalPreview activeTab={activeTab} onTabChange={setActiveTab} /></ScrollExpansion>
      </div>
    </section>
  );
}

function PricingAndFaqSection() {
  const cards = [
    { title: "Audience ready", description: "Review the people selected for outreach.", icon: UsersRound, eyebrow: "Prospects", status: "Ready for review", accent: "blue" as const },
    { title: "Outreach approved", description: "Edit messages and channel routing before launch.", icon: ShieldCheck, eyebrow: "Campaign", status: "Approved", accent: "violet" as const },
    { title: "Conversations visible", description: "Replies arrive with their campaign context intact.", icon: MessagesSquare, eyebrow: "Chat", status: "Live context", accent: "green" as const },
  ] as const;
  return (
    <section id="pricing" data-navbar-theme="light" className="relative z-30 -mt-7 scroll-mt-20 rounded-t-[28px] bg-white py-20 sm:-mt-9 sm:rounded-t-[40px] sm:py-24 lg:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
        <div id="resources" className="scroll-mt-24">
          <FaqSectionCentered items={faqs} eyebrow="Questions? We have answers." heading="Know what happens before you start." description="Clear answers about setup, channels, review, personalization, and campaign control." supportEmail="support@leadreacher.com" />
        </div>
        <div className="mt-20 grid items-center gap-10 sm:mt-24 lg:grid-cols-[.9fr_1.1fr] lg:gap-14">
          <div className="rounded-lg bg-[#101322] p-7 text-white shadow-[0_30px_80px_rgba(26,19,65,0.2)] sm:p-9"><p className="text-xs font-semibold uppercase text-[#9d86ff]">Simple, transparent checkout</p><h3 className="mt-4 text-3xl font-semibold">Choose the campaign that fits the work.</h3><p className="mt-4 text-sm leading-6 text-white/62">Your campaign selection and video choice determine the final total, shown clearly before purchase.</p><ul className="mt-7 divide-y divide-white/10">{["AI strategy and audience research", "Personalized messaging and video choices", "Multi-channel outreach", "Automated follow-ups", "Unified reply management", "Campaign controls and visibility"].map((item) => <li key={item} className="flex items-center gap-3 py-3 text-sm"><span className="flex size-5 items-center justify-center rounded-full bg-[#6240f5]"><Check className="size-3" /></span>{item}</li>)}</ul><Link href="/signup" className="mt-8 flex h-12 items-center justify-center gap-2 rounded-lg bg-[#5a32ed] font-semibold transition-colors hover:bg-[#6842f5]">Build your campaign <ArrowRight className="size-4" /></Link><p className="mt-4 text-center text-xs text-white/50">The final amount is confirmed before purchase.</p></div>
          <div className="px-1 py-4 sm:px-6"><p className="text-xs font-semibold uppercase text-[#5b39d5]">Built for review, not guesswork</p><h2 className="mt-4 text-3xl font-semibold text-[#111527]">The work stays visible as it moves.</h2><p className="mt-4 max-w-xl text-base leading-7 text-[#62697e]">Each stage has an explicit review point, a clear status, and a direct path into the next action.</p><DisplayCards cards={cards} className="mt-3" /></div>
        </div>
      </div>
    </section>
  );
}

function FinalCtaAndFooter() {
  return (
    <footer data-navbar-theme="dark" className="relative z-40 -mt-7 overflow-hidden rounded-t-[28px] bg-[#0b0d19] px-5 pb-8 pt-10 text-white sm:-mt-9 sm:rounded-t-[40px] sm:px-8 sm:pb-10 sm:pt-12">
      <section className="relative mx-auto max-w-7xl overflow-hidden rounded-2xl border border-white/10 bg-[#111427] px-6 py-10 shadow-[0_30px_90px_rgba(0,0,0,.28)] sm:px-10 sm:py-12 lg:px-14">
        <div className="relative grid items-center gap-9 lg:grid-cols-[1.2fr_.8fr] lg:gap-16">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase text-[#aa96ff]"><Sparkles className="size-4" /> Start with your website</div>
            <h2 className="mt-4 max-w-2xl text-balance text-3xl font-semibold leading-tight sm:text-4xl lg:text-5xl">Drop your URL. We’ll take it from there.</h2>
            <p className="mt-4 max-w-xl text-sm leading-6 text-white/68 sm:text-base sm:leading-7">See how LeadReacher turns your business into a reviewable audience, campaign, and outreach workflow.</p>
          </div>
          <div className="lg:justify-self-end">
            <Link href="#top" className="group flex h-14 w-full min-w-64 items-center justify-between rounded-lg bg-[#5a32ed] px-5 font-semibold text-white shadow-[0_14px_36px_rgba(90,50,237,.36)] transition-colors hover:bg-[#6842f5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:w-80">Analyze my website <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" /></Link>
            <p className="mt-3 text-center text-xs text-white/50">No credit card required</p>
          </div>
        </div>
        <div className="relative mt-10 grid gap-3 border-t border-white/10 pt-6 text-xs text-white/62 sm:grid-cols-3 sm:gap-6">
          <span className="flex items-center gap-2"><ShieldCheck className="size-4 text-[#a994ff]" /> Your campaign stays reviewable</span>
          <span className="flex items-center gap-2"><Eye className="size-4 text-[#a994ff]" /> Approve before anything launches</span>
          <span className="flex items-center gap-2"><Pause className="size-4 text-[#a994ff]" /> Pause campaign delivery anytime</span>
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-12 px-1 pb-4 pt-14 md:grid-cols-[1.5fr_repeat(3,1fr)] lg:gap-16">
        <div>
          <Logo variant="white" align="left" className="h-8" />
          <p className="mt-5 max-w-sm text-sm leading-6 text-white/62">Multi-channel outreach and personalized video in one clear, reviewable workflow.</p>
          <a href="mailto:support@leadreacher.com" className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-white/78 transition-colors hover:text-white"><Mail className="size-4 text-[#a994ff]" /> support@leadreacher.com</a>
        </div>
        <nav aria-label="Product links"><p className="text-sm font-semibold text-white">Product</p><div className="mt-5 space-y-3 text-sm text-white/58"><a href="#product" className="block transition-colors hover:text-white">Product tour</a><a href="#how-it-works" className="block transition-colors hover:text-white">How it works</a><a href="#pricing" className="block transition-colors hover:text-white">Pricing</a></div></nav>
        <nav aria-label="Resource links"><p className="text-sm font-semibold text-white">Resources</p><div className="mt-5 space-y-3 text-sm text-white/58"><a href="mailto:support@leadreacher.com" className="block transition-colors hover:text-white">Help center</a><Link href="/privacy" className="block transition-colors hover:text-white">Privacy</Link><Link href="/terms" className="block transition-colors hover:text-white">Terms</Link></div></nav>
        <nav aria-label="Account links"><p className="text-sm font-semibold text-white">Account</p><div className="mt-5 space-y-3 text-sm text-white/58"><Link href="/signup" className="block transition-colors hover:text-white">Get started</Link><Link href="/login" className="block transition-colors hover:text-white">Log in</Link></div></nav>
      </div>
      <div className="mx-auto flex max-w-7xl flex-col gap-3 border-t border-white/10 px-1 pt-6 text-xs text-white/40 sm:flex-row sm:items-center sm:justify-between"><p>© 2026 LeadReacher. All rights reserved.</p><p>Built for visible, reviewable outreach.</p></div>
    </footer>
  );
}

export default function LandingRemainder() {
  return <><DifferentiationSection /><CampaignExpansionSection /><ApprovalSection /><PricingAndFaqSection /><FinalCtaAndFooter /></>;
}
