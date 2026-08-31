"use client";

import Image from "next/image";
import { m } from "framer-motion";
import { ChannelLogo } from "@/components/onboarding/ChannelLogo";
import {
  Check,
  CheckCircle2,
  ChevronRight,
  Filter,
  Globe2,
  Link2,
  Lock,
  Mail,
  MessageSquare,
  Pause,
  Play,
  Send,
  Sparkles,
  Target,
  UserRound,
  Video,
} from "@/components/ui/icons";
import { useState, type MouseEvent, type ReactNode } from "react";
import type { ProductStoryStageId } from "@/lib/product-story";
import { cn } from "@/lib/utils";

type DemoProps = {
  stageId: ProductStoryStageId;
  onStageChange: (stageId: ProductStoryStageId) => void;
  reducedMotion: boolean;
};

type ShellProps = Pick<DemoProps, "stageId"> & { children: ReactNode };

function DemoShell({ stageId, children }: ShellProps) {
  const updateSpotlight = (event: MouseEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--spotlight-x", `${event.clientX - bounds.left}px`);
    event.currentTarget.style.setProperty("--spotlight-y", `${event.clientY - bounds.top}px`);
  };

  return (
    <div data-testid="interactive-dashboard-demo" data-demo-stage={stageId} onMouseMove={updateSpotlight} className="group relative isolate size-full min-h-0 overflow-hidden bg-[#f8f8fc] text-[#171b2c]">
      <span aria-hidden className="pointer-events-none absolute inset-0 opacity-55 [background-image:linear-gradient(rgba(93,73,161,.035)_1px,transparent_1px),linear-gradient(90deg,rgba(93,73,161,.035)_1px,transparent_1px)] [background-size:28px_28px]" />
      <span aria-hidden className="pointer-events-none absolute -right-16 -top-20 size-48 rounded-full bg-[#7c58ed]/[0.07] blur-3xl" />
      <span
        data-testid="dashboard-pointer-spotlight"
        aria-hidden
        className="pointer-events-none absolute -inset-20 z-[1] opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100 motion-reduce:transition-none [background:radial-gradient(280px_circle_at_var(--spotlight-x,_50%)_var(--spotlight-y,_50%),rgba(111,76,255,.14),transparent_72%)]"
      />
      <div className="relative z-[2] size-full">{children}</div>
    </div>
  );
}

/* ---------------------------------- Website ---------------------------------- */

const WEBSITE_INSIGHTS = [
  {
    title: "Understands your business",
    items: ["What you sell", "Who buys it", "Why they choose you"],
  },
  {
    title: "Identifies your ideal customer",
    items: ["High-value prospects", "Roles & companies", "Buying signals"],
  },
] as const;

const WEBSITE_STRATEGY_PILLARS = [
  { icon: UserRound, label: "Who", detail: "Ideal prospects" },
  { icon: Target, label: "Where", detail: "Best channels" },
  { icon: MessageSquare, label: "Content", detail: "Sales-focused" },
] as const;

function WebsiteDemo(props: DemoProps) {
  const [website, setWebsite] = useState("yourwebsite.com");
  const [ready, setReady] = useState(true);

  const confirmWebsite = () => {
    if (!website.trim()) return;
    setReady(true);
  };

  return (
    <DemoShell {...props}>
      <div className="flex h-full min-h-0 flex-col gap-2.5 px-[4%] py-[3.5%] text-[#18152a] sm:gap-3">
        <m.form
          initial={props.reducedMotion ? false : { opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: props.reducedMotion ? 0 : 0.3, ease: "easeOut" }}
          onSubmit={(event) => {
            event.preventDefault();
            confirmWebsite();
          }}
          className="mx-auto flex h-11 w-full min-w-0 max-w-[440px] shrink-0 items-center rounded-2xl border border-[#ddd9e7] bg-white px-[3%] shadow-[0_7px_22px_rgba(40,27,85,.09)] sm:h-12 sm:w-[58%] sm:min-w-48"
        >
          <label htmlFor="story-website" className="sr-only">Company website</label>
          <Link2 className="size-[clamp(1rem,2vw,1.75rem)] shrink-0 text-[#6237e8]" aria-hidden />
          <span aria-hidden className="mx-[4%] h-[54%] w-px bg-[#e4e0eb]" />
          <input
            id="story-website"
            value={website}
            onChange={(event) => {
              setWebsite(event.target.value);
              setReady(false);
            }}
            onBlur={confirmWebsite}
            className="min-w-0 flex-1 bg-transparent text-[11px] font-semibold tracking-[-0.02em] text-[#18152a] outline-none placeholder:text-[#9893a5] sm:text-[clamp(.75rem,1.7vw,1.35rem)]"
            placeholder="yourwebsite.com"
            inputMode="url"
          />
          <button
            type="submit"
            aria-label="Analyze website"
            className={cn(
              "ml-2 flex size-[clamp(1.4rem,2.7vw,2.2rem)] shrink-0 items-center justify-center rounded-full text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6b55df] focus-visible:ring-offset-2",
              ready ? "bg-[#45a852]" : "bg-[#6842f5]",
            )}
          >
            <Check className="size-[55%]" weight="bold" aria-hidden />
          </button>
        </m.form>

        <div className="grid min-h-0 flex-[.82] grid-cols-2 gap-2.5">
          {WEBSITE_INSIGHTS.map((insight, index) => (
            <m.section
              key={insight.title}
              initial={props.reducedMotion ? false : { opacity: 0, x: index === 0 ? -8 : 8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: props.reducedMotion ? 0 : 0.3, delay: props.reducedMotion ? 0 : 0.1 + index * 0.08, ease: "easeOut" }}
              className="relative min-w-0 overflow-hidden rounded-2xl border border-[#e7e3ef] bg-white/82 px-[5%] py-[4%] shadow-[0_7px_20px_rgba(50,38,95,.045)]"
            >
              <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-[#7649f4] to-[#b864dd]" />
              <div className="flex items-start gap-2.5">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-[#eee9ff] text-[10px] font-bold text-[#6539dc] sm:size-7 sm:text-xs">0{index + 1}</span>
                <div className="min-w-0">
                  <h3 className="text-[clamp(.62rem,1.05vw,.88rem)] font-bold uppercase leading-[1.12] tracking-[-0.015em]">{insight.title}</h3>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-2 gap-y-1 text-[clamp(.5rem,.72vw,.65rem)] font-medium leading-tight text-[#3e394f] sm:mt-2.5">
                {insight.items.map((item) => (
                  <span key={item} className="flex items-center gap-1.5"><span className="size-1 rounded-full bg-[#7042ed]" aria-hidden />{item}</span>
                ))}
              </div>
            </m.section>
          ))}
        </div>

        <m.section
          initial={props.reducedMotion ? false : { opacity: 0, y: 9 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: props.reducedMotion ? 0 : 0.34, delay: props.reducedMotion ? 0 : 0.24, ease: "easeOut" }}
          className="relative flex min-h-0 flex-[1.18] flex-col overflow-hidden rounded-2xl border border-[#ded7f4] bg-[linear-gradient(135deg,#f5f2ff_0%,#ece7ff_58%,#f3efff_100%)] p-[3.5%] shadow-[0_9px_26px_rgba(80,53,165,.09)]"
        >
          <span aria-hidden className="pointer-events-none absolute -right-10 -top-20 size-48 rounded-full bg-[#7955ef]/10 blur-3xl" />
          <div className="relative flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="size-2 shrink-0 rounded-full bg-[#6738ed] shadow-[0_0_0_4px_rgba(103,56,237,.1)]" aria-hidden />
              <div className="min-w-0">
                <p className="text-[clamp(.52rem,.72vw,.65rem)] font-semibold uppercase tracking-[.12em] text-[#7553cd]">Acquisition plan</p>
                <h3 className="truncate text-[clamp(.7rem,1.35vw,1.12rem)] font-bold uppercase leading-tight tracking-[-0.015em]">Your custom strategy</h3>
              </div>
            </div>
            <m.div key={String(ready)} initial={props.reducedMotion ? false : { opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} role="status" aria-live="polite" aria-label={ready ? "Strategy ready" : "Update URL"} className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/80 bg-white/85 p-1 text-[clamp(.52rem,.8vw,.68rem)] font-semibold uppercase tracking-[.02em] text-[#6842d8] shadow-[0_5px_14px_rgba(50,38,95,.07)] sm:px-2.5">
              <span className="flex size-4 items-center justify-center rounded-full bg-[#45a852] text-white"><Check className="size-2.5" weight="bold" aria-hidden /></span>
              <span className="hidden sm:inline">{ready ? "Strategy ready" : "Update URL"}</span>
            </m.div>
          </div>

          <div className="relative mt-[3%] grid min-h-0 flex-1 grid-cols-3 gap-2">
            {WEBSITE_STRATEGY_PILLARS.map(({ icon: Icon, label, detail }, index) => (
              <m.div
                key={label}
                initial={props.reducedMotion ? false : { opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: props.reducedMotion ? 0 : 0.24, delay: props.reducedMotion ? 0 : 0.34 + index * 0.06 }}
                className="flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl border border-white/85 bg-white/55 px-[5%] py-[5%] text-center shadow-[inset_0_1px_0_rgba(255,255,255,.9)] sm:flex-row sm:justify-start sm:gap-[7%] sm:px-[7%] sm:text-left"
              >
                <span className="flex size-[clamp(1.55rem,3vw,2.4rem)] shrink-0 items-center justify-center rounded-xl bg-white text-[#5124bd] shadow-[0_4px_12px_rgba(80,48,160,.09)]">
                  <Icon className="size-[55%]" weight="regular" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-[clamp(.6rem,1vw,.86rem)] font-bold uppercase leading-none">{label}</span>
                  <span className="mt-1 block text-[clamp(.5rem,.78vw,.68rem)] leading-tight text-[#5d566e]">{detail}</span>
                </span>
              </m.div>
            ))}
          </div>
        </m.section>
      </div>
    </DemoShell>
  );
}

/* ---------------------------------- Strategy ---------------------------------- */

const STRATEGY_PROSPECTS = [
  { name: "Amelia Stone", role: "Revenue Leader", company: "Orbit Works", image: "/landing/portraits/prospect-68.webp" },
  { name: "Henry Martin", role: "VP Sales", company: "Acme Corp", image: "/landing/portraits/prospect-32.webp" },
  { name: "Sarah Chen", role: "Head of Growth", company: "ScalePath", image: "/landing/portraits/prospect-36.webp" },
  { name: "Daniel Lopez", role: "Marketing Director", company: "BluePeak", image: "/landing/portraits/prospect-46.webp" },
  { name: "Jessica Reynolds", role: "Business Development", company: "Elevate Co.", image: "/landing/portraits/prospect-44.webp" },
] as const;

function StrategyDemo(props: DemoProps) {
  const [selected, setSelected] = useState(0);
  const [decisions, setDecisions] = useState<Record<number, "approved" | "passed">>({});
  const active = STRATEGY_PROSPECTS[selected];

  const decide = (decision: "approved" | "passed") => {
    setDecisions((current) => ({ ...current, [selected]: decision }));
  };

  return (
    <DemoShell {...props}>
      <div className="flex h-full min-h-0 flex-col gap-2.5 p-2.5 sm:p-4 lg:p-5">
        <div className="grid h-10 shrink-0 grid-cols-[1fr_auto_1fr_auto_1fr] items-center rounded-2xl border border-[#e7e3ef] bg-white/82 px-2 shadow-[0_5px_18px_rgba(50,38,95,.045)] sm:h-12 sm:px-3">
          {[
            { icon: Globe2, label: "Scraping the web" },
            { icon: Filter, label: "Qualifying" },
            { icon: Sparkles, label: "Matches found" },
          ].map(({ icon: Icon, label }, index) => (
            <div key={label} className="contents">
              <m.div
                className="flex min-w-0 items-center justify-center gap-1.5 sm:gap-2"
                initial={props.reducedMotion ? false : { opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: props.reducedMotion ? 0 : 0.28, delay: props.reducedMotion ? 0 : index * 0.14, ease: "easeOut" }}
              >
                <span className="flex size-6 shrink-0 items-center justify-center text-[#6237e8]">
                  <Icon className="size-5" weight="regular" aria-hidden />
                </span>
                <span className="hidden truncate text-[10px] font-semibold text-[#2b273b] sm:block sm:text-xs">{label}</span>
                <m.span
                  className="flex shrink-0"
                  initial={props.reducedMotion ? false : { opacity: 0, scale: 0.35, rotate: -18 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  transition={{ duration: props.reducedMotion ? 0 : 0.3, delay: props.reducedMotion ? 0 : 0.18 + index * 0.14, type: "spring", bounce: 0.35 }}
                >
                  <CheckCircle2 className="size-3.5 text-[#6038eb]" weight="fill" aria-hidden />
                </m.span>
              </m.div>
              {index < 2 ? (
                <m.span
                  className="flex"
                  initial={props.reducedMotion ? false : { opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: props.reducedMotion ? 0 : 0.22, delay: props.reducedMotion ? 0 : 0.1 + index * 0.14 }}
                >
                  <ChevronRight className="size-3.5 text-[#756f83] sm:size-4" aria-hidden />
                </m.span>
              ) : null}
            </div>
          ))}
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-2.5 sm:grid-cols-[1.18fr_.82fr] sm:gap-3">
          <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-[#dfdbe8] bg-white/80 shadow-[0_8px_24px_rgba(50,38,95,.055)]">
            <div className="grid min-h-0 flex-1 grid-rows-5 divide-y divide-[#ebe8f0]">
              {STRATEGY_PROSPECTS.map((prospect, index) => {
                const decision = decisions[index];
                const isSelected = selected === index;
                return (
                  <m.button
                    key={prospect.name}
                    type="button"
                    onClick={() => setSelected(index)}
                    aria-pressed={isSelected}
                    initial={props.reducedMotion ? false : { opacity: 0, x: -7 }}
                    animate={{ opacity: 1, x: isSelected ? 2 : 0 }}
                    transition={{ opacity: { duration: props.reducedMotion ? 0 : 0.24, delay: props.reducedMotion ? 0 : 0.08 + index * 0.055 }, x: { duration: props.reducedMotion ? 0 : 0.2, ease: "easeOut" } }}
                    className={cn(
                      "relative flex min-h-0 w-full items-center gap-2 px-2 text-left transition-colors focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#7358ed] sm:px-3",
                      isSelected ? "bg-[#f0ecff]" : "hover:bg-[#faf9fd]",
                    )}
                  >
                    {isSelected ? (
                      <m.span
                        layoutId="strategy-prospect-selection"
                        aria-hidden
                        className="absolute inset-y-0 left-0 w-1 bg-[#6134ed]"
                        transition={{ duration: props.reducedMotion ? 0 : 0.24, ease: "easeOut" }}
                      />
                    ) : null}
                    <Image src={prospect.image} width={128} height={128} alt="" className="size-7 shrink-0 rounded-full object-cover ring-2 ring-white sm:size-9" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[10px] font-bold text-[#201c30] sm:text-xs">{prospect.name}</span>
                      <span className="flex min-w-0 items-center gap-1.5 text-[8px] text-[#6f697d] sm:text-[9px]">
                        <span className="min-w-0 truncate">{prospect.role} <span className="text-[#8a55df]">·</span> {prospect.company}</span>
                        <span className="hidden shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[7px] font-semibold text-emerald-700 lg:flex">
                          <span className="size-1 rounded-full bg-emerald-500" aria-hidden />High-value match
                        </span>
                      </span>
                    </span>
                    <span className="flex w-10 shrink-0 flex-col items-center gap-0.5 text-[8px] font-medium sm:w-12 sm:text-[9px]">
                      <m.span
                        animate={decision === "approved" ? { scale: props.reducedMotion ? 1 : [1, 1.18, 1] } : { scale: 1 }}
                        transition={{ duration: props.reducedMotion ? 0 : 0.38, ease: "easeOut" }}
                        className={cn(
                        "flex size-5 items-center justify-center rounded-full border sm:size-6",
                        decision === "approved" || isSelected ? "border-[#6237e8] bg-[#6237e8] text-white" : decision === "passed" ? "border-slate-300 bg-slate-100 text-slate-400" : "border-[#d8d3e0] bg-white text-transparent",
                      )}
                      >
                        <Check className="size-3" weight="bold" aria-hidden />
                      </m.span>
                      <span className={cn(decision === "approved" || isSelected ? "text-[#5935ce]" : "text-[#6f697d]")}>{decision === "approved" ? "Approved" : decision === "passed" ? "Passed" : isSelected ? "Selected" : "Review"}</span>
                    </span>
                    <ChevronRight className="size-3.5 shrink-0 text-[#302747]" aria-hidden />
                  </m.button>
                );
              })}
            </div>
            <button type="button" className="hidden h-7 shrink-0 items-center justify-center gap-1.5 border-t border-[#ebe8f0] text-[9px] font-semibold text-[#592fd8] transition-colors hover:bg-[#f7f4ff] sm:flex">
              <span className="text-base leading-none">+</span> View more prospects
            </button>
          </div>

          <m.aside
            key={active.name}
            initial={props.reducedMotion ? false : { opacity: 0, x: 10, scale: 0.985 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ duration: props.reducedMotion ? 0 : 0.26, ease: "easeOut" }}
            className="hidden min-h-0 flex-col rounded-2xl border border-[#dfdbe8] bg-white/88 p-3 shadow-[0_8px_24px_rgba(50,38,95,.055)] sm:flex lg:px-4"
          >
            <div className="flex items-center gap-2.5 border-b border-[#ebe8f0] pb-2">
              <Image src={active.image} width={128} height={128} alt="" className="size-11 shrink-0 rounded-full object-cover ring-4 ring-[#f4f1fb] lg:size-12" />
              <div className="min-w-0">
                <h3 className="truncate text-sm font-bold text-[#1e1a2d] lg:text-base">{active.name}</h3>
                <p className="mt-0.5 truncate text-[10px] font-medium text-[#554e63] lg:text-xs">{active.role}</p>
                <p className="truncate text-[10px] text-[#756e80] lg:text-xs">{active.company}</p>
              </div>
            </div>

            <div className="min-h-0 flex-1 py-2">
              <p className="text-[11px] font-bold text-[#211d30] lg:text-xs">Why this prospect?</p>
              <div className="mt-2 space-y-2">
                {[
                  ["Buying intent", "Actively researching solutions"],
                  ["Customer fit", "Matches your ideal profile"],
                ].map(([title, detail]) => (
                  <div key={title} className="flex items-start gap-2">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-600"><Check className="size-3.5" weight="bold" aria-hidden /></span>
                    <span className="min-w-0">
                      <span className="block text-[10px] font-bold text-[#272233] lg:text-xs">{title}</span>
                      <span className="block text-[9px] leading-tight text-[#6e677a] lg:text-[10px]">{detail}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid h-9 shrink-0 grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => decide("passed")}
                className="flex items-center justify-center rounded-lg border border-[#d9d4e2] bg-white text-[10px] font-semibold text-[#312b3d] transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7358ed] lg:text-xs"
              >
                Pass
              </button>
              <m.button
                type="button"
                onClick={() => decide("approved")}
                animate={decisions[selected] === "approved" ? { scale: props.reducedMotion ? 1 : [1, 1.045, 1], boxShadow: "0 8px 24px rgba(84,41,223,.34)" } : { scale: 1, boxShadow: "0 6px 16px rgba(84,41,223,.23)" }}
                transition={{ duration: props.reducedMotion ? 0 : 0.38, ease: "easeOut" }}
                className="flex items-center justify-center gap-1.5 rounded-lg bg-[#5a27e8] text-[10px] font-semibold text-white shadow-[0_6px_16px_rgba(84,41,223,.23)] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7358ed] focus-visible:ring-offset-2 lg:text-xs"
              >
                {decisions[selected] === "approved" ? "Approved" : "Approve"} <Check className="size-3" weight="bold" aria-hidden />
              </m.button>
            </div>
          </m.aside>
        </div>
      </div>
    </DemoShell>
  );
}

/* ---------------------------------- Prospects ---------------------------------- */

const CONTENT_CREATIVES = [
  { label: "Professional", image: "/landing/product-story/content-professional.webp", position: "50% 42%" },
  { label: "Casual", image: "/landing/product-story/content-casual.webp", position: "50% 42%" },
  { label: "Aggressive", image: "/landing/product-story/content-aggressive.webp", position: "50% 42%" },
] as const;

function ProspectsDemo(props: DemoProps) {
  const [selectedCreative, setSelectedCreative] = useState(2);
  const [editing, setEditing] = useState(false);
  const [approved, setApproved] = useState(false);
  const creative = CONTENT_CREATIVES[selectedCreative];

  const selectCreative = (index: number) => {
    setSelectedCreative(index);
    setApproved(false);
  };

  return (
    <DemoShell {...props}>
      <div className="flex h-full min-h-0 flex-col gap-2 p-2.5 sm:p-3.5 lg:p-4">
        <m.div
          initial={props.reducedMotion ? false : { opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: props.reducedMotion ? 0 : 0.28, ease: "easeOut" }}
          className="flex min-h-7 shrink-0 items-center justify-between gap-3"
        >
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#e4dcff] bg-[#f4f1ff] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[.04em] text-[#5530d8] sm:text-[10px]">
            <Sparkles className="size-3.5" weight="fill" aria-hidden /> Ads &amp; scripts <span className="hidden font-semibold text-[#7666bb] lg:inline">generated for you</span>
          </span>
          <p className="hidden text-right text-[10px] font-medium text-[#4f485d] sm:block lg:text-xs">
            Target <span className="font-bold text-[#5633df]">every language, culture and market</span> across the globe.
          </p>
        </m.div>

        <div className="grid shrink-0 grid-cols-3 gap-2 sm:gap-3">
          {CONTENT_CREATIVES.map((option, index) => {
            const isSelected = selectedCreative === index;
            return (
              <m.button
                key={option.label}
                type="button"
                onClick={() => selectCreative(index)}
                aria-pressed={isSelected}
                aria-description="Select video option"
                initial={props.reducedMotion ? false : { opacity: 0, y: 7 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: props.reducedMotion ? 0 : 0.28, delay: props.reducedMotion ? 0 : 0.08 + index * 0.07, ease: "easeOut" }}
                className="group flex min-w-0 flex-col gap-1 text-left focus-visible:outline-none"
              >
                <span className="flex items-center justify-center gap-1 text-[8px] font-bold uppercase tracking-wide text-[#5c5668] sm:text-[9px]">
                  <span className={cn("size-1 rounded-full", isSelected ? "bg-[#6036ed]" : "bg-[#cbc6d5]")} />{option.label}
                </span>
                <span className={cn(
                  "relative aspect-video w-full overflow-hidden rounded-lg border bg-[#161222] shadow-[0_5px_12px_rgba(28,20,52,.13)] transition-all duration-200 group-hover:-translate-y-0.5 group-hover:shadow-[0_8px_18px_rgba(63,42,123,.18)]",
                  isSelected ? "border-[#6036ed] ring-2 ring-[#7654f2]/35" : "border-[#d7d2df]",
                )}>
                  <Image
                    src={option.image}
                    fill
                    sizes="(max-width: 640px) 28vw, 210px"
                    alt=""
                    className="object-cover transition-transform duration-300 group-hover:scale-[1.025]"
                    style={{ objectPosition: option.position }}
                  />
                  <span className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/65 to-transparent" />
                  <span className="absolute bottom-1.5 left-1.5 flex size-5 items-center justify-center rounded-full bg-black/65 text-white backdrop-blur-sm sm:size-6">
                    <Play className="ml-px size-2.5 fill-current sm:size-3" aria-hidden />
                  </span>
                  <span className="absolute bottom-1.5 right-1.5 text-[8px] font-medium text-white sm:text-[9px]">0:10</span>
                  {isSelected ? (
                    <m.span
                      initial={props.reducedMotion ? false : { scale: 0.6, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="absolute right-1.5 top-1.5 flex size-5 items-center justify-center rounded-full bg-[#5d32e9] text-white shadow-[0_3px_10px_rgba(72,35,202,.35)]"
                    >
                      <Check className="size-3" weight="bold" aria-hidden />
                    </m.span>
                  ) : null}
                </span>
              </m.button>
            );
          })}
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-[1fr_138px] lg:grid-cols-[1fr_148px]">
          <m.section
            key={`${selectedCreative}-${editing}`}
            initial={props.reducedMotion ? false : { opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: props.reducedMotion ? 0 : 0.22 }}
            className="grid min-h-0 grid-cols-[1fr_42%] gap-2 rounded-xl border border-[#ded9e8] bg-[linear-gradient(135deg,#f5f2ff_0%,#eeebff_100%)] p-2"
          >
            <div className="min-w-0 text-[#2c263a]">
              <p className="text-[9px] font-extrabold uppercase tracking-wide sm:text-[10px]">Your cold DM</p>
              <p className="mt-0.5 text-[8px] text-[#736d7e] sm:text-[9px]">Personalized for every prospect.</p>
              <div className="mt-1 text-[9px] leading-[1.3] sm:text-[10px]">
                <p>Hi [First Name],</p>
                <p className="mt-0.5">{editing ? "I made this short idea for your growth team." : "[Your personalized sales message]"}</p>
                <p className="mt-1 truncate">Ready to walk you through it. <span className="hidden font-semibold text-[#5730df] sm:inline">Book a consult →</span></p>
              </div>
            </div>
            <div className="relative aspect-video h-full min-h-0 max-h-full max-w-full justify-self-end overflow-hidden rounded-lg border border-white/80 bg-[#171324] shadow-[0_6px_16px_rgba(41,27,89,.13)]">
              <Image
                src={creative.image}
                fill
                sizes="220px"
                alt="Selected personalized video preview"
                className="object-cover"
                style={{ objectPosition: creative.position }}
              />
              <span className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/65 to-transparent" />
              <span className="absolute bottom-2 left-2 flex size-6 items-center justify-center rounded-full bg-black/65 text-white backdrop-blur-sm"><Play className="ml-px size-3 fill-current" aria-hidden /></span>
              <span className="absolute bottom-2 right-2 text-[9px] font-medium text-white">0:10</span>
            </div>
          </m.section>

          <m.aside
            initial={props.reducedMotion ? false : { opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: props.reducedMotion ? 0 : 0.28, delay: props.reducedMotion ? 0 : 0.27, ease: "easeOut" }}
            className="hidden min-h-0 flex-col justify-center gap-2 rounded-xl border border-[#e4e0eb] bg-white/82 px-2.5 shadow-[0_5px_16px_rgba(46,33,86,.04)] sm:flex"
          >
            {[
              [Target, "Sales-focused"],
              [UserRound, "Personalized"],
              [Video, "Video included"],
            ].map(([Icon, label]) => {
              const FeatureIcon = Icon as typeof Target;
              return (
                <div key={String(label)} className="flex items-center gap-2 text-[9px] font-semibold text-[#413a4d] lg:text-[10px]">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-[#f2eeff] text-[#5d36e5]">
                    <FeatureIcon className="size-3.5" weight="regular" aria-hidden />
                  </span>
                  {String(label)}
                </div>
              );
            })}
          </m.aside>
        </div>

        <m.div
          initial={props.reducedMotion ? false : { opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: props.reducedMotion ? 0 : 0.25, delay: props.reducedMotion ? 0 : 0.3 }}
          className="flex h-8 shrink-0 items-center justify-between gap-2 sm:h-9"
        >
          <p className="hidden text-[9px] font-medium text-[#70697d] sm:block">Pick a direction. Make it yours.</p>
          <button
            type="button"
            onClick={() => { setEditing((value) => !value); setApproved(false); }}
            aria-pressed={editing}
            className="flex h-full min-w-20 items-center justify-center gap-1.5 rounded-lg border border-[#d7d1e0] bg-white px-3 text-[10px] font-semibold text-[#383141] transition-colors hover:bg-[#f8f6fc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7358ed] sm:min-w-24 sm:text-xs"
          >
            <MessageSquare className="size-3.5" aria-hidden />{editing ? "Done" : "Edit"}
          </button>
          <m.button
            key={String(approved)}
            type="button"
            onClick={() => setApproved(true)}
            initial={props.reducedMotion ? false : { scale: approved ? 0.92 : 1 }}
            animate={{ scale: 1 }}
            transition={{ duration: props.reducedMotion ? 0 : 0.22, type: "spring", bounce: 0.35 }}
            className={cn(
              "flex h-full min-w-24 items-center justify-center gap-1.5 rounded-lg px-3 text-[10px] font-semibold text-white shadow-[0_6px_16px_rgba(84,41,223,.22)] transition-all hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7358ed] focus-visible:ring-offset-2 sm:min-w-28 sm:text-xs",
              approved ? "bg-emerald-600" : "bg-[#5728e8]",
            )}
          >
            <Check className="size-3.5" weight="bold" aria-hidden />{approved ? "Approved" : "Approve"}
          </m.button>
        </m.div>
      </div>
    </DemoShell>
  );
}

/* ---------------------------------- Outreach ---------------------------------- */

const OUTREACH_CHANNELS = [
  { id: "linkedin", label: "LinkedIn", logo: "linkedin" as const },
  { id: "whatsapp", label: "WhatsApp", logo: "whatsapp-mark" as const },
  { id: "instagram", label: "Instagram", logo: "instagram" as const },
  { id: "gmail", label: "Gmail", logo: "gmail" as const },
  { id: "outlook", label: "Outlook", logo: "outlook" as const },
] as const;

const OUTREACH_RECIPIENTS = [
  { name: "Michael T.", channel: "LinkedIn", logo: "linkedin" as const, image: "/landing/portraits/prospect-32.webp" },
  { name: "Sarah K.", channel: "WhatsApp", logo: "whatsapp-mark" as const, image: "/landing/portraits/prospect-36.webp" },
  { name: "David R.", channel: "LinkedIn", logo: "linkedin" as const, image: "/landing/portraits/prospect-46.webp" },
  { name: "Emily L.", channel: "WhatsApp", logo: "whatsapp-mark" as const, image: "/landing/portraits/prospect-44.webp" },
] as const;

function OutreachDemo(props: DemoProps) {
  const [selectedChannels, setSelectedChannels] = useState(["linkedin", "whatsapp"]);
  const [sent, setSent] = useState(false);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const toggleChannel = (id: string) => {
    setSent(false);
    setSelectedChannels((current) => current.includes(id) ? current.filter((channel) => channel !== id) : [...current, id]);
  };

  return (
    <DemoShell {...props}>
      <div className="flex h-full min-h-0 flex-col gap-2 p-2.5 sm:p-3.5 lg:p-4">
        <m.h3 initial={props.reducedMotion ? false : { opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="shrink-0 text-center text-xs font-extrabold uppercase text-[#1f1b2d] sm:text-sm lg:text-base">
          Messages your prospects <span className="text-[#5c30e8]">automatically.</span>
        </m.h3>

        <div className="grid h-11 shrink-0 grid-cols-6 gap-1.5 sm:h-14 sm:gap-2">
          {OUTREACH_CHANNELS.map((channel, index) => {
            const selected = selectedChannels.includes(channel.id);
            return (
              <m.button key={channel.id} type="button" onClick={() => toggleChannel(channel.id)} aria-pressed={selected} aria-label={`${selected ? "Disable" : "Enable"} ${channel.label}`} initial={props.reducedMotion ? false : { opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: props.reducedMotion ? 0 : 0.22, delay: props.reducedMotion ? 0 : index * 0.045 }} className="relative flex min-w-0 items-center justify-center rounded-xl bg-transparent transition-all hover:-translate-y-0.5 hover:bg-white/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7358ed]">
                <ChannelLogo name={channel.logo} className="size-8 sm:size-10" />
                {selected ? <m.span initial={props.reducedMotion ? false : { scale: 0.5 }} animate={{ scale: 1 }} className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-[#5b30e8] text-white shadow-sm sm:size-5"><Check className="size-2.5 sm:size-3" weight="bold" aria-hidden /></m.span> : null}
              </m.button>
            );
          })}
          <button type="button" aria-label="Personalized video included" className="flex items-center justify-center rounded-xl bg-transparent text-[#5a32ed] transition-all hover:-translate-y-0.5 hover:bg-white/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7358ed]"><Video className="size-8 sm:size-10" strokeWidth={1.8} aria-hidden /></button>
        </div>

        <div className="flex h-6 shrink-0 items-center justify-center gap-3 border-b border-[#e9e5ee] pb-2 text-[8px] font-medium text-[#514a5e] sm:gap-5 sm:text-[10px]">
          <span className="flex items-center gap-1"><CheckCircle2 className="size-3 text-[#5b30e8]" aria-hidden />Best channels identified</span><span className="h-3 w-px bg-[#ddd7e5]" aria-hidden /><span className="flex items-center gap-1 text-[#5931db]"><Lock className="size-3" aria-hidden />Connected via API</span>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-[.96fr_1.04fr] gap-2 sm:gap-3">
          <section className="flex min-h-0 flex-col">
            <p className="mb-1 text-[8px] font-extrabold uppercase tracking-wide text-[#2a2536] sm:text-[9px]">Your approved message</p>
            <div className="grid min-h-0 flex-1 grid-cols-[1fr_48%] items-center gap-2 rounded-xl border border-[#e2ddec] bg-[linear-gradient(135deg,#f7f4ff_0%,#eeebff_100%)] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,.8)] sm:gap-2.5">
              <div className="flex min-h-0 min-w-0 flex-col justify-center border-l-2 border-[#7045ed] pl-2 text-[8px] leading-[1.35] text-[#342e42] sm:rounded-lg sm:border-l-0 sm:bg-white/55 sm:px-2.5 sm:py-2 sm:text-[9px] sm:shadow-[0_4px_14px_rgba(65,43,122,.045)] lg:text-[10px]">
                <span className="mb-1 hidden items-center gap-1 text-[7px] font-bold uppercase tracking-[.08em] text-[#756b83] sm:flex"><Sparkles className="size-2.5 text-[#6437e8]" weight="fill" aria-hidden />Personalized DM</span>
                <p className="font-medium">Hi &#123;&#123;First Name&#125;&#125;,</p>
                <p className="mt-1 hidden text-[#5d5669] sm:block">&#123;&#123;Your personalized sales message&#125;&#125;</p>
                <p className="mt-1 text-[#5d5669] sm:hidden">Message ready.</p>
                <p className="mt-2 hidden sm:block">Ready to walk you through it.</p>
                <p className="font-bold text-[#5730df]">Book a call →</p>
              </div>
              <button type="button" onClick={() => setVideoPlaying((value) => !value)} className="group relative aspect-video w-full overflow-hidden rounded-lg border border-white bg-[#171324] shadow-[0_8px_20px_rgba(42,28,88,.18)] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7358ed]" aria-label={`${videoPlaying ? "Pause" : "Play"} approved video preview, 0:10`}>
                <Image src="/landing/product-story/content-aggressive.webp" fill sizes="180px" alt="" className="object-cover transition-transform duration-300 group-hover:scale-[1.025]" /><span className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/65 to-transparent" /><span className="absolute bottom-1 left-1 flex size-5 items-center justify-center rounded-full bg-black/65 text-white backdrop-blur-sm">{videoPlaying ? <Pause className="size-2.5 fill-current" aria-hidden /> : <Play className="ml-px size-2.5 fill-current" aria-hidden />}</span><span className="absolute bottom-1 right-1 rounded-full bg-black/35 px-1.5 py-0.5 text-[7px] font-medium text-white backdrop-blur-sm">0:10</span>
              </button>
            </div>
          </section>

          <section className="flex min-h-0 flex-col">
            <p className="mb-1 text-[8px] font-extrabold uppercase tracking-wide text-[#2a2536] sm:text-[9px]">Sent to your prospects</p>
            <div className="grid min-h-0 flex-1 grid-rows-4 gap-1">
              {OUTREACH_RECIPIENTS.map((recipient, index) => (
                <m.div key={recipient.name} initial={props.reducedMotion ? false : { opacity: 0, x: 7 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: props.reducedMotion ? 0 : 0.24, delay: props.reducedMotion ? 0 : 0.12 + index * 0.055 }} className="flex min-h-0 items-center gap-1.5 rounded-lg border border-[#e4e0e9] bg-white/88 px-1.5 sm:gap-2 sm:px-2">
                  <Image src={recipient.image} width={128} height={128} alt="" className="size-6 shrink-0 rounded-full object-cover sm:size-7" /><span className="min-w-0 flex-1 truncate text-[8px] font-bold text-[#292334] sm:text-[10px]">{recipient.name}</span><span className="flex shrink-0 items-center gap-1 text-[7px] text-[#615a6c] sm:text-[9px]"><ChannelLogo name={recipient.logo} className="size-3.5 sm:size-4" /><span className="hidden lg:inline">{recipient.channel}</span></span>
                  <m.span key={`${recipient.name}-${sent}`} initial={props.reducedMotion || !sent ? false : { scale: 0.35, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: props.reducedMotion ? 0 : 0.26, delay: props.reducedMotion ? 0 : index * 0.08, type: "spring", bounce: 0.35 }} className={cn("flex size-4 shrink-0 items-center justify-center rounded-full sm:size-5", sent ? "bg-[#5b30e8] text-white" : "border border-[#d9d4e1] text-[#aaa3b4]")}><Check className="size-2.5 sm:size-3" weight="bold" aria-hidden /></m.span>
                </m.div>
              ))}
            </div>
          </section>
        </div>

        <m.button type="button" onClick={() => setSent(true)} disabled={sent} animate={sent ? { scale: props.reducedMotion ? 1 : [1, 1.025, 1] } : { scale: 1 }} transition={{ duration: props.reducedMotion ? 0 : 0.38 }} className={cn("mx-auto flex h-7 shrink-0 items-center justify-center gap-1.5 rounded-full px-3 text-[9px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7358ed] sm:text-[10px]", sent ? "bg-emerald-50 text-emerald-700" : "bg-[#5a2de7] text-white shadow-[0_5px_14px_rgba(85,43,222,.22)] hover:bg-[#4f25d5]")}>
          {sent ? <CheckCircle2 className="size-3.5" weight="fill" aria-hidden /> : <Send className="size-3.5" aria-hidden />}{sent ? "Sent automatically" : "Send automatically"}
        </m.button>
      </div>
    </DemoShell>
  );
}

/* ---------------------------------- Conversations ---------------------------------- */

type InboxChannel = "linkedin" | "whatsapp" | "instagram" | "other";

const INBOX_CONVERSATIONS = [
  { name: "Michael T.", channel: "linkedin", image: "/landing/portraits/prospect-32.webp", time: "2m", message: "This looks exactly like what we need. Can we talk?" },
  { name: "Sarah K.", channel: "whatsapp", image: "/landing/portraits/prospect-68.webp", time: "15m", message: "Very interesting. Let's schedule a call." },
  { name: "David R.", channel: "linkedin", image: "/landing/portraits/prospect-46.webp", time: "1h", message: "Can you send more info about this?" },
  { name: "Emily L.", channel: "whatsapp", image: "/landing/portraits/prospect-36.webp", time: "2h", message: "We're definitely interested. What's next?" },
] as const;

const INBOX_FILTERS = [
  { id: "all", label: "All" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "instagram", label: "Instagram" },
  { id: "other", label: "Other" },
] as const;

function ConversationChannelMark({ channel, className = "size-4" }: { channel: InboxChannel; className?: string }) {
  if (channel === "linkedin") return <ChannelLogo name="linkedin" className={className} />;
  if (channel === "whatsapp") return <ChannelLogo name="whatsapp-mark" className={className} />;
  if (channel === "instagram") return <ChannelLogo name="instagram" className={className} />;
  return <Mail className={cn(className, "text-[#7951c9]")} weight="fill" aria-hidden />;
}

function ConversationsDemo(props: DemoProps) {
  const [selected, setSelected] = useState(0);
  const [filter, setFilter] = useState<(typeof INBOX_FILTERS)[number]["id"]>("all");
  const [draft, setDraft] = useState("");
  const [sentMessage, setSentMessage] = useState("");
  const conversation = INBOX_CONVERSATIONS[selected];
  const visibleConversations = filter === "all" ? INBOX_CONVERSATIONS : INBOX_CONVERSATIONS.filter((item) => item.channel === filter);

  const changeFilter = (nextFilter: (typeof INBOX_FILTERS)[number]["id"]) => {
    setFilter(nextFilter);
    const firstMatch = INBOX_CONVERSATIONS.findIndex((item) => item.channel === nextFilter);
    if (firstMatch >= 0) setSelected(firstMatch);
    setSentMessage("");
  };

  const sendMessage = () => {
    const message = draft.trim();
    if (!message) return;
    setSentMessage(message);
    setDraft("");
  };

  return (
    <DemoShell {...props}>
      <div className="flex h-full min-h-0 flex-col gap-2 p-2.5 sm:p-4 lg:p-5">
        <m.div initial={props.reducedMotion ? false : { opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: props.reducedMotion ? 0 : 0.28 }} className="flex h-10 shrink-0 items-center gap-2.5 sm:h-11">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#5d2de8] text-white shadow-[0_5px_14px_rgba(84,41,223,.22)] sm:size-9">
            <MessageSquare className="size-4 sm:size-[18px]" aria-hidden />
          </span>
          <h3 className="text-[13px] font-extrabold leading-[1.05] tracking-[-.02em] text-[#171426] sm:text-base">New conversations.<br />Ready for <span className="text-[#5930df]">you.</span></h3>
          <div className="ml-auto flex items-center gap-1 sm:hidden">
            {INBOX_CONVERSATIONS.map((item, index) => (
              <button key={item.name} type="button" onClick={() => { setSelected(index); setSentMessage(""); }} aria-label={`Open conversation with ${item.name}`} className={cn("relative size-7 overflow-hidden rounded-full border-2 transition-opacity", selected === index ? "border-[#6b43eb] opacity-100" : "border-white opacity-55")}>
                <Image src={item.image} fill sizes="28px" alt="" className="object-cover" />
              </button>
            ))}
          </div>
        </m.div>

        <div className="grid h-8 shrink-0 grid-cols-5 gap-1.5 sm:h-9 sm:gap-2">
          {INBOX_FILTERS.map((item, index) => {
            const count = item.id === "all" ? INBOX_CONVERSATIONS.length : INBOX_CONVERSATIONS.filter((conversation) => conversation.channel === item.id).length;
            return (
              <m.button
              key={item.id}
              type="button"
              onClick={() => changeFilter(item.id)}
              aria-pressed={filter === item.id}
              initial={props.reducedMotion ? false : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: props.reducedMotion ? 0 : 0.22, delay: props.reducedMotion ? 0 : 0.06 + index * 0.04 }}
              className={cn("relative flex min-w-0 items-center justify-center gap-1 rounded-lg border text-[8px] font-semibold transition-colors sm:text-[9px]", filter === item.id ? "border-[#d7cdf9] bg-[#f0ecff] text-[#5833cd]" : "border-[#e3dfe9] bg-white/80 text-[#514b5d] hover:bg-white")}
            >
              {item.id === "all" ? null : <ConversationChannelMark channel={item.id} className="size-4 sm:size-5" />}
              <span className={cn("truncate", item.id !== "all" && "hidden lg:inline")}>{item.label}</span>
                <span className="absolute -right-0.5 -top-1 flex size-3.5 items-center justify-center rounded-full bg-[#582bdd] text-[7px] font-bold text-white sm:size-4 sm:text-[8px]">{count}</span>
              </m.button>
            );
          })}
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-[.78fr_1.22fr] sm:gap-3">
          <div className="hidden min-h-0 flex-col overflow-hidden rounded-xl border border-[#e1dce8] bg-white/76 sm:flex">
            {visibleConversations.length ? visibleConversations.map((item, visibleIndex) => {
              const index = INBOX_CONVERSATIONS.indexOf(item);
              const isSelected = selected === index;
              return (
                <m.button
                  key={item.name}
                  type="button"
                  onClick={() => { setSelected(index); setSentMessage(""); }}
                  initial={props.reducedMotion ? false : { opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: props.reducedMotion ? 0 : 0.22, delay: props.reducedMotion ? 0 : 0.13 + visibleIndex * 0.045 }}
                  className={cn("relative flex min-h-0 flex-1 items-center gap-2 border-b border-[#ece9f0] px-2.5 text-left last:border-b-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#7358ed]", isSelected ? "bg-[#f0ecff]" : "hover:bg-[#faf9fc]")}
                >
                  {isSelected ? <span className="absolute inset-y-0 left-0 w-1 bg-[#6233e9]" aria-hidden /> : null}
                  <span className="relative size-8 shrink-0 overflow-hidden rounded-full ring-2 ring-white lg:size-9"><Image src={item.image} fill sizes="36px" alt="" className="object-cover" /><span className="absolute bottom-0 right-0 size-2 rounded-full border border-white bg-emerald-500" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2"><span className="truncate text-[10px] font-bold text-[#211d2d] lg:text-[11px]">{item.name}</span><span className="text-[8px] text-[#756e7f]">{item.time}</span></span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-[8px] text-[#6f6878]"><ConversationChannelMark channel={item.channel} className="size-3.5 lg:size-4" />{item.channel === "linkedin" ? "LinkedIn" : "WhatsApp"}</span>
                    <span className="mt-0.5 block truncate text-[8px] text-[#3e3948] lg:text-[9px]">{item.message}</span>
                  </span>
                </m.button>
              );
            }) : <div className="flex flex-1 items-center justify-center px-4 text-center text-[10px] text-[#817a8b]">No new replies on this channel yet.</div>}
          </div>

          <m.section key={conversation.name} initial={props.reducedMotion ? false : { opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: props.reducedMotion ? 0 : 0.25 }} className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-[#ded9e6] bg-white/82 shadow-[0_7px_22px_rgba(49,35,92,.05)]">
            <div className="flex h-11 shrink-0 items-center gap-2 border-b border-[#ece9f0] px-2.5 sm:h-12 sm:px-3">
              <span className="relative size-8 shrink-0 overflow-hidden rounded-full"><Image src={conversation.image} fill sizes="32px" alt="" className="object-cover" /><span className="absolute bottom-0 right-0 size-2 rounded-full border border-white bg-emerald-500" /></span>
              <span className="min-w-0"><span className="flex items-center gap-1.5 truncate text-[10px] font-bold text-[#211d2d] sm:text-[11px]">{conversation.name}<ConversationChannelMark channel={conversation.channel} className="size-4" /></span><span className="block text-[8px] font-medium text-emerald-600 sm:text-[9px]">Active now</span></span>
              <span className="ml-auto text-lg tracking-[.14em] text-[#77717f]">•••</span>
            </div>

            <div className="flex min-h-0 flex-1 flex-col justify-end gap-2 overflow-hidden px-2.5 py-2 sm:px-3 sm:py-2.5">
              <m.div initial={props.reducedMotion ? false : { opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} className="max-w-[86%] self-end rounded-xl rounded-br-sm bg-[#eee9ff] px-2.5 py-2 text-[9px] leading-[1.4] text-[#342a59] sm:text-[10px]">
                <span className="block font-bold text-[#4b31aa]">You</span>Hi {conversation.name.split(" ")[0]}, just wanted to follow up and see if you had a chance to check out the video.
              </m.div>
              <m.div initial={props.reducedMotion ? false : { opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: props.reducedMotion ? 0 : 0.08 }} className="max-w-[75%] rounded-xl rounded-bl-sm bg-[#f1f0f3] px-2.5 py-2 text-[9px] leading-[1.4] text-[#342f3b] sm:text-[10px]">
                {conversation.message}
              </m.div>
              {sentMessage ? <m.div initial={props.reducedMotion ? false : { opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} className="max-w-[82%] self-end rounded-xl rounded-br-sm bg-[#5b30e3] px-2.5 py-2 text-[9px] text-white sm:text-[10px]">{sentMessage}</m.div> : null}
            </div>

            <div className="shrink-0 border-t border-[#ece9f0] px-2.5 py-2 sm:px-3">
              <div className="flex h-9 items-center gap-1.5">
                <input value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") sendMessage(); }} placeholder="Type your message..." aria-label="Write a demo reply" className="h-full min-w-0 flex-1 rounded-lg border border-[#ddd8e5] bg-white px-2.5 text-base text-[#2d2837] outline-none transition-shadow placeholder:text-[#a09aa8] focus:border-[#7b60e6] focus:shadow-[0_0_0_3px_rgba(123,96,230,.12)] sm:text-[10px]" />
                <m.button type="button" onClick={sendMessage} whileTap={props.reducedMotion ? undefined : { scale: 0.88 }} disabled={!draft.trim()} aria-label="Send demo reply" className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#5728e8] text-white shadow-[0_5px_13px_rgba(84,41,223,.24)] disabled:opacity-40"><Send className="size-4" weight="fill" aria-hidden /></m.button>
              </div>
              <p className="mt-1.5 flex items-center justify-center gap-1 text-[7px] text-[#807987] sm:text-[8px]"><Lock className="size-2.5" weight="fill" aria-hidden />All conversations sync to your connected channels.</p>
            </div>
          </m.section>
        </div>
      </div>
    </DemoShell>
  );
}

export function DashboardDemo(props: DemoProps) {
  if (props.stageId === "website") return <WebsiteDemo {...props} />;
  if (props.stageId === "strategy") return <StrategyDemo {...props} />;
  if (props.stageId === "prospects") return <ProspectsDemo {...props} />;
  if (props.stageId === "outreach") return <OutreachDemo {...props} />;
  return <ConversationsDemo {...props} />;
}
