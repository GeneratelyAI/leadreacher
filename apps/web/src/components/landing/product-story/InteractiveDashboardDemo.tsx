"use client";

import Image from "next/image";
import { m } from "framer-motion";
import {
  Activity,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  CheckCircle2,
  Globe2,
  MessageSquare,
  Pause,
  Play,
  RefreshCw,
  Rocket,
  Send,
  Sparkles,
  Target,
  TrendingUp,
  UserRoundCheck,
  Video,
  X,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { siWhatsapp } from "simple-icons";
import type { ProductStoryStageId } from "@/lib/product-story";
import { cn } from "@/lib/utils";

type DemoProps = {
  stageId: ProductStoryStageId;
  onStageChange: (stageId: ProductStoryStageId) => void;
  reducedMotion: boolean;
};

type ShellProps = Pick<DemoProps, "stageId"> & { children: ReactNode };

const CHANNEL_IMAGES = {
  linkedin: "/landing/linkedin-logo.webp",
  instagram: "/landing/instagram-logo.webp",
  gmail: "/landing/gmail-logo.webp",
  outlook: "/landing/outlook-logo.webp",
} as const;

function ChannelLogo({ channel, className = "size-4" }: { channel: keyof typeof CHANNEL_IMAGES | "whatsapp"; className?: string }) {
  if (channel === "whatsapp") {
    return (
      <span className={cn("inline-flex items-center justify-center rounded bg-[#25D366] p-0.5 text-white", className)} aria-hidden>
        <svg viewBox="0 0 24 24" className="size-full fill-current"><path d={siWhatsapp.path} /></svg>
      </span>
    );
  }
  return <Image src={CHANNEL_IMAGES[channel]} width={20} height={20} alt="" className={cn("object-contain", className)} />;
}

function StatusPulse({ active = true }: { active?: boolean }) {
  return (
    <span className="relative flex size-2" aria-hidden>
      {active ? <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-45 motion-reduce:animate-none" /> : null}
      <span className={cn("relative inline-flex size-2 rounded-full", active ? "bg-emerald-500" : "bg-amber-400")} />
    </span>
  );
}

function MiniAreaChart({ reducedMotion, color = "#6d4df0" }: { reducedMotion: boolean; color?: string }) {
  return (
    <svg viewBox="0 0 180 54" className="h-9 w-full overflow-visible" preserveAspectRatio="none" aria-label="Rising campaign activity">
      <path d="M0 45 H180" stroke="#e9e6f1" strokeWidth="1" />
      <path d="M0 28 H180" stroke="#f0eef5" strokeWidth="1" strokeDasharray="3 4" />
      <m.path
        d="M0 43 C15 42 18 34 30 36 S48 45 59 31 S79 28 89 34 S104 14 117 20 S137 25 147 11 S167 16 180 5"
        fill="none"
        stroke={color}
        strokeWidth="2.6"
        strokeLinecap="round"
        initial={reducedMotion ? false : { pathLength: 0, opacity: 0.3 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: reducedMotion ? 0 : 0.65, ease: "easeOut" }}
      />
      {[30, 89, 147, 180].map((x, index) => <circle key={x} cx={x} cy={[36, 34, 11, 5][index]} r="2.5" fill={color} />)}
    </svg>
  );
}

/** The one dominant visual per screen. Deliberately large — this is the hero, not a stat chip. */
function HeroRing({
  value,
  reducedMotion,
  size = "lg",
}: {
  value: number;
  reducedMotion: boolean;
  size?: "lg" | "md";
}) {
  const r = 30;
  const circumference = 2 * Math.PI * r;
  return (
    <div
      className={cn("relative shrink-0", size === "lg" ? "size-14 sm:size-24 lg:size-40" : "size-11 sm:size-16")}
      aria-label={`${value}% confidence`}
    >
      <svg viewBox="0 0 72 72" className="size-full -rotate-90">
        <circle cx="36" cy="36" r={r} fill="none" stroke="rgba(255,255,255,.14)" strokeWidth="6" />
        <m.circle
          cx="36"
          cy="36"
          r={r}
          fill="none"
          stroke="#65dfb2"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={reducedMotion ? false : { strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference * (1 - value / 100) }}
          transition={{ duration: reducedMotion ? 0 : 0.75, ease: "easeOut" }}
        />
      </svg>
      <span className={cn("absolute inset-0 flex items-center justify-center font-bold tabular-nums text-white", size === "lg" ? "text-[11px] sm:text-xl lg:text-4xl" : "text-[10px] sm:text-base")}>
        {value}%
      </span>
    </div>
  );
}

function DemoShell({ stageId, children }: ShellProps) {
  return (
    <div data-testid="interactive-dashboard-demo" data-demo-stage={stageId} className="relative size-full min-h-0 overflow-hidden bg-[#f8f8fc] text-[#171b2c]">
      <span aria-hidden className="pointer-events-none absolute inset-0 opacity-55 [background-image:linear-gradient(rgba(93,73,161,.035)_1px,transparent_1px),linear-gradient(90deg,rgba(93,73,161,.035)_1px,transparent_1px)] [background-size:28px_28px]" />
      <span aria-hidden className="pointer-events-none absolute -right-16 -top-20 size-48 rounded-full bg-[#7c58ed]/[0.07] blur-3xl" />
      <div className="relative size-full">{children}</div>
    </div>
  );
}

/**
 * The dark hero panel shared by every stage — one big idea, glowing, dominant.
 * `className` sizes the panel itself (grid/flex item concerns: min-w-0, min-h-0, flex-1, hidden/sm:flex).
 * `contentClassName` lays out the actual children (flex-row/flex-col, gap, padding) — it must live on
 * the same element as the children, since the decorative glow spans sit between them and the root.
 */
function HeroPanel({ children, className, contentClassName }: { children: ReactNode; className?: string; contentClassName?: string }) {
  return (
    <div className={cn("relative overflow-hidden rounded-2xl bg-[#14101f] text-white shadow-[0_16px_40px_rgba(20,10,40,.28)]", className)}>
      <span aria-hidden className="pointer-events-none absolute -right-10 -top-16 size-56 rounded-full bg-[#7c58ed]/40 blur-3xl" />
      <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
      <div className={cn("relative size-full", contentClassName)}>{children}</div>
    </div>
  );
}

function Eyebrow({ icon: Icon, children }: { icon: typeof Sparkles; children: ReactNode }) {
  return (
    <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#6b46f0] sm:text-xs">
      <Icon className="size-3.5" aria-hidden />
      {children}
    </span>
  );
}

/** A compact, legible list item used by the "pick one, see it big" pattern shared across stages. */
function PickerRow({
  active,
  onClick,
  avatar,
  avatarTone,
  title,
  subtitle,
  trailing,
}: {
  active: boolean;
  onClick: () => void;
  avatar: ReactNode;
  avatarTone: string;
  title: string;
  subtitle: string;
  trailing?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex min-h-11 w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left transition-colors sm:gap-3 sm:rounded-xl sm:px-3.5 sm:py-3",
        active ? "border-[#8b73ed] bg-[#f2eeff] shadow-[0_6px_16px_rgba(75,45,165,.1)]" : "border-[#e4e1ef] bg-white hover:border-[#c9c1e1]",
      )}
    >
      <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold sm:size-10 sm:text-xs", avatarTone)}>{avatar}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12px] font-semibold text-[#171b2c] sm:text-sm">{title}</span>
        <span className="block truncate text-[10px] text-[#8b869c] sm:text-xs">{subtitle}</span>
      </span>
      {trailing}
    </button>
  );
}

/* ---------------------------------- Website ---------------------------------- */

function WebsiteDemo(props: DemoProps) {
  const [refreshes, setRefreshes] = useState(0);
  return (
    <DemoShell {...props}>
      <div className="grid h-full grid-cols-[0.85fr_1.15fr] gap-2 p-2.5 sm:gap-5 sm:p-6 lg:gap-7 lg:p-8">
        <div className="flex min-w-0 flex-col justify-center">
          <Eyebrow icon={Sparkles}>AI discovery</Eyebrow>
          <h3 className="mt-1 text-balance text-[13px] font-bold leading-tight sm:mt-2 sm:text-2xl lg:text-3xl">Your business, understood.</h3>
          <p className="mt-1.5 hidden max-w-[32ch] text-[13px] leading-6 text-[#6f6b80] sm:block sm:text-sm">
            One scan of your website becomes a usable acquisition brief, ready to act on.
          </p>
          <button
            type="button"
            onClick={() => setRefreshes((value) => value + 1)}
            className="mt-2 flex min-h-11 w-fit items-center justify-center gap-1.5 rounded-md bg-[#5429df] px-2 text-[10px] font-semibold text-white shadow-[0_8px_20px_rgba(84,41,223,.22)] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b7fd4] sm:mt-4 sm:px-3.5 sm:text-sm"
          >
            <RefreshCw key={refreshes} className="size-3 sm:size-3.5" aria-hidden /> <span className="hidden sm:inline">Run analysis again</span><span className="sm:hidden">Re-run</span>
          </button>
          <div className="mt-5 hidden items-center gap-2 rounded-lg border border-[#e2dfeb] bg-white px-3 py-2.5 shadow-[0_4px_16px_rgba(51,40,93,0.04)] min-[640px]:flex">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[#374151]"><StatusPulse />4 live signals tracked</span>
            <span className="ml-auto w-24"><MiniAreaChart reducedMotion={props.reducedMotion} /></span>
          </div>
        </div>

        <HeroPanel className="min-w-0" contentClassName="flex flex-row items-center gap-2.5 p-2.5 sm:gap-6 sm:p-7">
          <m.div key={`ring-${refreshes}`} initial={props.reducedMotion ? false : { opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.35 }}>
            <HeroRing value={96} reducedMotion={props.reducedMotion} />
          </m.div>
          <div className="min-w-0">
            <p className="hidden text-[11px] font-semibold uppercase tracking-wide text-white/45 sm:block">Business DNA mapped</p>
            <p className="text-[11px] font-bold leading-snug sm:mt-1.5 sm:text-base sm:leading-snug lg:text-lg">B2B growth teams, scaling operations</p>
            <p className="mt-2 hidden max-w-[28ch] text-[13px] leading-6 text-white/60 sm:block sm:text-sm">
              Offer, audience, and positioning are ready. Strategy starts from here.
            </p>
            <div className="mt-1.5 hidden items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white/85 w-fit sm:mt-3 sm:flex">
              <Globe2 className="size-3" aria-hidden />generately.ai
              <CheckCircle2 className="size-3.5 text-emerald-400" aria-hidden />
            </div>
          </div>
        </HeroPanel>
      </div>
    </DemoShell>
  );
}

/* ---------------------------------- Strategy ---------------------------------- */

const STRATEGY_CHANNELS = [
  { channel: "LinkedIn" as const, score: 94, headline: "Founders and growth leads are active here daily.", detail: "Strong purchase intent and team maturity." },
  { channel: "WhatsApp" as const, score: 89, headline: "Decision-makers closest to revenue growth.", detail: "Fast replies once a conversation starts." },
  { channel: "Instagram" as const, score: 76, headline: "Positioning matches active operating priorities.", detail: "Best for brand-forward follow-up, not first touch." },
] as const;

function StrategyDemo(props: DemoProps) {
  const [selected, setSelected] = useState(0);
  const [approved, setApproved] = useState(false);
  const active = STRATEGY_CHANNELS[selected];
  return (
    <DemoShell {...props}>
      <div className="flex h-full flex-col gap-2 p-2.5 sm:gap-3 sm:p-6 lg:p-8">
        <div className="flex items-start justify-between gap-2">
          <div>
            <Eyebrow icon={Target}>Audience strategy</Eyebrow>
            <h3 className="hidden text-lg font-bold sm:mt-1.5 sm:block sm:text-xl">Where we&apos;ll reach them</h3>
          </div>
          <span className={cn("hidden h-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold sm:flex", approved ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700")}>
            <StatusPulse active={approved} />{approved ? "Approved" : "Ready to review"}
          </span>
          <button
            type="button"
            onClick={() => setApproved((value) => !value)}
            className={cn("flex min-h-11 shrink-0 items-center gap-1 rounded-md px-2 text-[10px] font-semibold text-white sm:hidden", approved ? "bg-emerald-600" : "bg-[#5429df]")}
          >
            <Check className="size-3" aria-hidden />{approved ? "Approved" : "Approve"}
          </button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-[auto_1fr] gap-2 sm:grid-cols-[0.85fr_1.15fr] sm:gap-4">
          <div className="flex flex-col justify-center gap-1.5 sm:gap-2">
            {STRATEGY_CHANNELS.map((option, index) => (
              <button
                key={option.channel}
                type="button"
                onClick={() => setSelected(index)}
                aria-label={`${option.channel}, ${option.score}% fit`}
                className={cn(
                  "flex size-11 items-center justify-center rounded-lg border transition-colors sm:hidden",
                  selected === index ? "border-[#8b73ed] bg-[#f2eeff]" : "border-[#e4e1ef] bg-white",
                )}
              >
                <ChannelLogo channel={option.channel === "LinkedIn" ? "linkedin" : option.channel === "WhatsApp" ? "whatsapp" : "instagram"} className="size-4" />
              </button>
            ))}
            {STRATEGY_CHANNELS.map((option, index) => (
              <div key={option.channel} className="hidden sm:block">
                <PickerRow
                  active={selected === index}
                  onClick={() => setSelected(index)}
                  avatar={<ChannelLogo channel={option.channel === "LinkedIn" ? "linkedin" : option.channel === "WhatsApp" ? "whatsapp" : "instagram"} className="size-5" />}
                  avatarTone="bg-[#f0ebff]"
                  title={option.channel}
                  subtitle={`${option.score}% fit`}
                />
              </div>
            ))}
          </div>

          <HeroPanel className="min-w-0" contentClassName="flex flex-row items-center gap-2.5 p-2.5 sm:gap-6 sm:p-7">
            <m.div key={active.channel}>
              <HeroRing value={active.score} reducedMotion={props.reducedMotion} />
            </m.div>
            <m.div key={`${active.channel}-copy`} initial={props.reducedMotion ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="min-w-0">
              <p className="hidden text-[11px] font-semibold uppercase tracking-wide text-white/45 sm:block">Primary channel</p>
              <p className="text-[13px] font-bold sm:mt-1.5 sm:text-base lg:text-lg">{active.channel}</p>
              <p className="mt-1 hidden max-w-[30ch] text-[13px] leading-6 text-white/60 sm:block sm:text-sm">{active.headline}</p>
              <p className="hidden max-w-[30ch] text-[12px] leading-5 text-white/40 lg:block">{active.detail}</p>
            </m.div>
          </HeroPanel>
        </div>
      </div>
    </DemoShell>
  );
}

/* ---------------------------------- Prospects ---------------------------------- */

type ProspectStatus = "Pending" | "Approved" | "Excluded";
type DemoProspect = { name: string; role: string; status: ProspectStatus; score: number; tone: string };

const INITIAL_PROSPECTS: DemoProspect[] = [
  { name: "Hannah Lewis", role: "VP Commercial · Common Thread", status: "Approved", score: 96, tone: "bg-[#eee9ff] text-[#4e28df]" },
  { name: "Caleb Young", role: "COO · Atlas Vertex", status: "Approved", score: 91, tone: "bg-emerald-50 text-emerald-700" },
  { name: "Zara Patel", role: "Marketing Director · Meridian", status: "Pending", score: 88, tone: "bg-blue-50 text-blue-700" },
  { name: "Noah Wilson", role: "Founder · Ridgeway AI", status: "Pending", score: 84, tone: "bg-[#eee9ff] text-[#4e28df]" },
];

function ProspectsDemo(props: DemoProps) {
  const [prospects, setProspects] = useState(INITIAL_PROSPECTS);
  const [selected, setSelected] = useState(0);
  const selectedProspect = prospects[selected];
  const updateSelected = (status: ProspectStatus) => setProspects((current) => current.map((prospect, index) => (index === selected ? { ...prospect, status } : prospect)));
  return (
    <DemoShell {...props}>
      <div className="flex h-full flex-col p-2.5 sm:p-6 lg:p-8">
        <div className="flex items-center justify-between">
          <div>
            <Eyebrow icon={UserRoundCheck}>Prospect review</Eyebrow>
            <h3 className="hidden text-lg font-bold sm:mt-1.5 sm:block sm:text-xl">You approve who we reach</h3>
          </div>
          <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700 sm:px-2.5 sm:text-[11px]">
            <UserRoundCheck className="size-3 sm:size-3.5" aria-hidden />{prospects.filter((prospect) => prospect.status === "Approved").length} approved
          </span>
        </div>

        <div className="mt-2 grid min-h-0 flex-1 gap-3 sm:mt-5 lg:grid-cols-[1.1fr_0.9fr] lg:gap-4">
          <div className="flex flex-col gap-1.5 sm:gap-2">
            {prospects.map((prospect, index) => (
              <div key={prospect.name} className={cn(index >= 2 && "hidden sm:block")}>
                <PickerRow
                  active={selected === index}
                  onClick={() => setSelected(index)}
                  avatar={prospect.name.split(" ").map((part) => part[0]).join("")}
                  avatarTone={prospect.tone}
                  title={prospect.name}
                  subtitle={prospect.role}
                  trailing={
                    <span className="ml-1.5 flex shrink-0 items-center gap-2 sm:ml-2 sm:gap-2.5">
                      <span className="text-[13px] font-bold tabular-nums text-[#4b28d6] sm:text-base">{prospect.score}</span>
                      <span className={cn("hidden rounded-full px-2 py-0.5 text-[10px] font-semibold sm:inline", prospect.status === "Approved" ? "bg-emerald-50 text-emerald-700" : prospect.status === "Excluded" ? "bg-slate-100 text-slate-600" : "bg-amber-50 text-amber-700")}>
                        {prospect.status}
                      </span>
                    </span>
                  }
                />
              </div>
            ))}
          </div>

          <HeroPanel className="hidden min-h-0 lg:block" contentClassName="flex flex-col p-4 sm:p-5">
            <div className="flex items-center gap-2.5">
              <span className="flex size-9 items-center justify-center rounded-full bg-[#eee9ff] text-xs font-bold text-[#4e28df]">{selectedProspect.name.split(" ").map((part) => part[0]).join("")}</span>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">{selectedProspect.name}</p>
                <p className="truncate text-[11px] text-white/50">{selectedProspect.role}</p>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-4 sm:mt-4">
              <HeroRing value={selectedProspect.score} reducedMotion={props.reducedMotion} size="md" />
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-white/40">Lead intelligence</p>
                <p className="mt-1 text-sm font-bold">Strong buying fit</p>
              </div>
            </div>
            <div className="mt-3 space-y-1.5 border-t border-white/10 pt-3 sm:mt-4 sm:space-y-2 sm:pt-4">
              {[[BriefcaseBusiness, "Company is scaling"], [Target, "Role owns growth"], [Activity, "Recent buying signal"]].map(([Icon, label]) => {
                const RowIcon = Icon as typeof BriefcaseBusiness;
                return (
                  <div key={String(label)} className="flex items-center gap-2 text-[12.5px] text-white/75">
                    <Check className="size-3.5 text-emerald-400" aria-hidden />
                    <RowIcon className="size-3.5 text-white/40" aria-hidden />
                    {String(label)}
                  </div>
                );
              })}
            </div>
            <div className="mt-auto flex items-center gap-2 pt-3 sm:pt-4">
              <button type="button" onClick={() => updateSelected("Excluded")} className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/15 text-xs font-semibold text-white/70">
                <X className="size-3.5" aria-hidden />Exclude
              </button>
              <button type="button" onClick={() => updateSelected("Approved")} className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#5429df] text-xs font-semibold text-white shadow-[0_6px_16px_rgba(84,41,223,.25)]">
                <Check className="size-3.5" aria-hidden />Approve
              </button>
            </div>
          </HeroPanel>
        </div>
      </div>
    </DemoShell>
  );
}

/* ---------------------------------- Outreach ---------------------------------- */

function OutreachDemo(props: DemoProps) {
  const [selectedStep, setSelectedStep] = useState(0);
  const [running, setRunning] = useState(false);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const steps = [
    { title: "Connection note", channel: "LinkedIn", message: "Hi Hannah, I noticed Common Thread is scaling its growth operation." },
    { title: "Value follow-up", channel: "Video + LinkedIn", message: "We prepared a short idea for keeping outreach coordinated." },
    { title: "Helpful reminder", channel: "WhatsApp fallback", message: "Worth sharing the two-minute overview with your team?" },
  ] as const;
  const active = steps[selectedStep];
  return (
    <DemoShell {...props}>
      <div className="flex h-full flex-col gap-2 p-2.5 sm:gap-5 sm:p-6 lg:p-8">
        <div className="flex items-center justify-between">
          <div>
            <Eyebrow icon={Activity}>Approved sequence</Eyebrow>
            <h3 className="hidden text-lg font-bold sm:mt-1.5 sm:block sm:text-xl">Every step, already approved</h3>
          </div>
          <button
            type="button"
            onClick={() => setRunning((value) => !value)}
            className={cn("flex min-h-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-2 text-[10px] font-semibold text-white shadow-[0_8px_20px_rgba(84,41,223,.22)] sm:gap-2 sm:rounded-lg sm:px-3.5 sm:text-sm", running ? "bg-emerald-600" : "bg-[#5429df]")}
          >
            <Rocket className="size-3 sm:size-3.5" aria-hidden />{running ? "Campaign running" : "Launch demo"}
          </button>
        </div>

        <HeroPanel className="min-h-0 flex-1" contentClassName="flex flex-row">
          <div className="relative flex w-[38%] shrink-0 flex-col items-center justify-center gap-1.5 border-r border-white/10 p-2 text-center sm:w-[42%] sm:gap-2.5 sm:p-6">
            <button type="button" onClick={() => setVideoPlaying((value) => !value)} className="tap-target relative flex size-8 shrink-0 items-center justify-center rounded-full border border-white/25 bg-white/10 shadow-[0_0_20px_rgba(120,87,244,.4)] sm:size-16 sm:shadow-[0_0_30px_rgba(120,87,244,.4)]" aria-label={videoPlaying ? "Pause personalized video preview" : "Play personalized video preview"}>
              {videoPlaying ? <Pause className="size-3.5 fill-current sm:size-6" aria-hidden /> : <Play className="size-3.5 fill-current sm:size-6" aria-hidden />}
            </button>
            <div className="min-w-0">
              <p className="flex items-center justify-center gap-1 text-[10px] font-semibold leading-4 text-white/85 sm:gap-1.5 sm:text-sm"><Video className="hidden size-3.5 sm:block" aria-hidden />Video ready</p>
              <p className="mt-2 hidden w-fit rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-medium text-white/70 sm:block">0:38</p>
            </div>
          </div>

          <div className="flex min-w-0 flex-1 flex-col p-2 sm:p-6">
            <div className="flex flex-wrap gap-1 sm:gap-1.5">
              {steps.map((step, index) => (
                <button
                  key={step.title}
                  type="button"
                  onClick={() => setSelectedStep(index)}
                  className={cn("tap-target relative rounded-full px-2 py-0.5 text-[10px] font-semibold transition-colors sm:px-2.5 sm:py-1 sm:text-[11px]", selectedStep === index ? "bg-white text-[#171527]" : "bg-white/10 text-white/60 hover:bg-white/15")}
                >
                  {step.title}
                </button>
              ))}
            </div>
            <m.div key={selectedStep} initial={props.reducedMotion ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-1.5 flex-1 rounded-lg bg-white/[0.06] p-2 text-[11px] leading-5 text-white/85 sm:mt-4 sm:rounded-xl sm:p-4 sm:text-sm sm:leading-6">
              {active.message}
            </m.div>
            <div className="mt-1.5 flex items-center justify-between text-[10px] text-white/45 sm:mt-3 sm:text-[11px]">
              <span className="flex items-center gap-1 sm:gap-1.5"><CheckCircle2 className="size-3 text-emerald-400 sm:size-3.5" aria-hidden />{active.channel}</span>
              <span className="hidden sm:inline">Day {selectedStep * 2 + 1}</span>
            </div>
          </div>
        </HeroPanel>
      </div>
    </DemoShell>
  );
}

/* ---------------------------------- Conversations ---------------------------------- */

const CONVERSATIONS = [
  { name: "Hannah Lewis", initials: "HL", company: "Common Thread", message: "Next Tuesday afternoon works.", tone: "bg-[#e9e2ff] text-[#4e28df]" },
  { name: "Maya Chen", initials: "MC", company: "Northstar", message: "Can you share the short overview?", tone: "bg-blue-50 text-blue-700" },
  { name: "Daniel Ortiz", initials: "DO", company: "Acme Labs", message: "Thanks for following up.", tone: "bg-emerald-50 text-emerald-700" },
] as const;

function ConversationsDemo(props: DemoProps) {
  const [selected, setSelected] = useState(0);
  const [draft, setDraft] = useState("");
  const [sent, setSent] = useState(false);
  const conversation = CONVERSATIONS[selected];
  const sendMessage = () => {
    if (!draft.trim()) return;
    setSent(true);
    setDraft("");
  };
  return (
    <DemoShell {...props}>
      <div className="flex h-full flex-col gap-2 p-2.5 sm:gap-3 sm:p-6 lg:p-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eyebrow icon={MessageSquare}>Interested replies</Eyebrow>
            <div className="flex items-center gap-1 sm:hidden">
              {CONVERSATIONS.map((item, index) => (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => { setSelected(index); setSent(false); }}
                  aria-label={item.name}
                  className={cn("tap-target relative flex size-7 items-center justify-center rounded-full text-[9px] font-bold transition-opacity", item.tone, selected === index ? "opacity-100 ring-2 ring-[#8b73ed]" : "opacity-50")}
                >
                  {item.initials}
                </button>
              ))}
            </div>
            <h3 className="hidden text-lg font-bold sm:block sm:text-xl">You step in when it matters</h3>
          </div>
          <span className="flex items-center gap-1.5 rounded-full bg-[#5429df] px-2 py-1 text-[10px] font-semibold text-white sm:px-2.5 sm:text-[11px]"><StatusPulse />3 new</span>
        </div>

        <div className="grid min-h-0 flex-1 gap-3 sm:mt-2 sm:grid-cols-[0.8fr_1.2fr] sm:gap-4">
          <div className="hidden flex-col gap-2 sm:flex">
            {CONVERSATIONS.map((item, index) => (
              <PickerRow
                key={item.name}
                active={selected === index}
                onClick={() => { setSelected(index); setSent(false); }}
                avatar={item.initials}
                avatarTone={item.tone}
                title={item.name}
                subtitle={item.message}
                trailing={index === 0 ? <span className="ml-2 shrink-0 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">HOT</span> : null}
              />
            ))}
            <div className="mt-1 hidden rounded-xl bg-[#14101f] p-3.5 text-white min-[520px]:block">
              <div className="flex items-end justify-between">
                <span>
                  <span className="block text-[10px] font-semibold uppercase tracking-wide text-white/45">Reply momentum</span>
                  <span className="text-xl font-bold">+31%</span>
                </span>
                <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-300"><TrendingUp className="size-3.5" aria-hidden />this week</span>
              </div>
              <MiniAreaChart reducedMotion={props.reducedMotion} color="#79e4bc" />
            </div>
          </div>

          <HeroPanel className="min-h-0" contentClassName="flex flex-col overflow-hidden">
            <div className="flex items-center gap-2 border-b border-white/10 px-2.5 py-2 sm:gap-2.5 sm:px-5 sm:py-3">
              <span className="flex size-7 items-center justify-center rounded-full bg-[#eee9ff] text-[10px] font-bold text-[#4e28df] sm:size-9 sm:text-xs">{conversation.initials}</span>
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 truncate text-[12px] font-bold sm:text-sm">{conversation.name}<CheckCircle2 className="size-3 shrink-0 text-[#8b7dff] sm:size-3.5" aria-hidden /></p>
                <p className="hidden truncate text-[11px] text-white/45 sm:block">{conversation.company}</p>
              </div>
              <span className="ml-auto hidden shrink-0 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[10px] font-bold text-emerald-300 sm:block">MEETING INTENT</span>
            </div>

            <div className="flex min-h-0 flex-1 flex-col justify-end gap-1.5 overflow-hidden px-2.5 py-2 sm:gap-2.5 sm:px-5 sm:py-4">
              <m.div initial={props.reducedMotion ? false : { opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} className="hidden max-w-[80%] self-end rounded-2xl rounded-br-md bg-[#5429df] px-3.5 py-2 text-[13px] leading-5 text-white shadow-[0_6px_16px_rgba(84,41,223,.2)] sm:block">
                Would a short overview be useful?
              </m.div>
              <m.div key={conversation.name} initial={props.reducedMotion ? false : { opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} className="max-w-[80%] rounded-xl rounded-bl-md bg-white/[0.08] px-2.5 py-1.5 text-[12px] leading-5 sm:rounded-2xl sm:px-3.5 sm:py-2 sm:text-[13px]">
                {conversation.message}
              </m.div>
              {selected === 0 ? (
                <div className="flex w-fit items-center gap-1.5 rounded-lg bg-emerald-500/15 px-2 py-1.5 text-[11px] font-semibold text-emerald-200 sm:gap-2 sm:rounded-xl sm:px-3 sm:py-2 sm:text-[12.5px]">
                  <CalendarDays className="size-3.5 sm:size-4" aria-hidden />Suggested: Tue, 2:00 PM
                </div>
              ) : null}
              {sent ? (
                <m.div initial={props.reducedMotion ? false : { opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="max-w-[80%] self-end rounded-xl rounded-br-md bg-[#5429df] px-2.5 py-1.5 text-[12px] leading-5 text-white sm:rounded-2xl sm:px-3.5 sm:py-2 sm:text-[13px]">
                  Sounds good, sending an invite now.
                </m.div>
              ) : null}
            </div>

            <div className="flex items-center gap-1.5 border-t border-white/10 px-2.5 py-2 sm:gap-2 sm:px-5 sm:py-3">
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => { if (event.key === "Enter") sendMessage(); }}
                placeholder="Write a reply..."
                aria-label="Write a demo reply"
                className="h-11 min-w-0 flex-1 rounded-md border border-white/15 bg-white/5 px-2.5 text-base text-white placeholder:text-white/35 outline-none transition-shadow focus:border-[#8b7dff] focus:shadow-[0_0_0_3px_rgba(139,125,255,.18)] sm:h-11 sm:rounded-lg sm:px-3 sm:text-[13px]"
              />
              <button type="button" onClick={sendMessage} className="flex size-11 shrink-0 items-center justify-center rounded-md bg-[#5429df] text-white shadow-[0_6px_16px_rgba(84,41,223,.25)] disabled:opacity-40 sm:rounded-lg" disabled={!draft.trim()} aria-label="Send demo reply">
                <Send className="size-3.5 sm:size-4" aria-hidden />
              </button>
            </div>
          </HeroPanel>
        </div>
      </div>
    </DemoShell>
  );
}

export function InteractiveDashboardDemo(props: DemoProps) {
  if (props.stageId === "website") return <WebsiteDemo {...props} />;
  if (props.stageId === "strategy") return <StrategyDemo {...props} />;
  if (props.stageId === "prospects") return <ProspectsDemo {...props} />;
  if (props.stageId === "outreach") return <OutreachDemo {...props} />;
  return <ConversationsDemo {...props} />;
}
