"use client";

import { LayoutGroup, m, useReducedMotion } from "framer-motion";

import type { AppIcon } from "@/components/ui/icons";
import { ArrowUpRight, CheckCircle2 } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

export type MorphingCard = {
  title: string;
  description: string;
  icon: AppIcon;
  eyebrow?: string;
  status?: string;
  accent?: "violet" | "blue" | "green";
};

type MorphingCardStackProps = {
  cards: readonly MorphingCard[];
  activeIndex: number;
  onActiveChange: (index: number) => void;
  className?: string;
};

const accents = {
  violet: {
    icon: "bg-[#6f4cff]/20 text-[#b3a3ff]",
    border: "border-[#8064ff]/45",
    glow: "from-[#6f4cff]/20",
  },
  blue: {
    icon: "bg-[#3f7cff]/18 text-[#91b2ff]",
    border: "border-[#5f91ff]/40",
    glow: "from-[#3f7cff]/18",
  },
  green: {
    icon: "bg-[#36b87d]/18 text-[#78ddb0]",
    border: "border-[#43c58d]/40",
    glow: "from-[#36b87d]/16",
  },
} as const;

export function MorphingCardStack({ cards, activeIndex, onActiveChange, className }: MorphingCardStackProps) {
  const reducedMotion = Boolean(useReducedMotion());

  if (cards.length === 0) return null;

  return (
    <div className={cn("space-y-6", className)}>
      <LayoutGroup id="landing-review-stack">
        <div className="grid min-h-[330px] w-full max-w-[31rem] [grid-template-areas:'stack'] place-items-center sm:min-h-[365px]">
          {cards.map(({ title, description, icon: Icon, eyebrow = "Campaign stage", status = "Ready", accent = "violet" }, index) => {
            const palette = accents[accent];
            const position = (index - activeIndex + cards.length) % cards.length;
            const isActive = position === 0;

            return (
              <m.button
                key={title}
                layout
                type="button"
                aria-pressed={isActive}
                aria-label={`${title}: ${description}`}
                onClick={() => onActiveChange(index)}
                initial={false}
                animate={{
                  x: reducedMotion ? position * 10 : position * 18,
                  y: position * 24,
                  rotate: reducedMotion ? 0 : position * 1.6,
                  scale: 1 - position * 0.035,
                  opacity: 1 - position * 0.16,
                }}
                whileHover={reducedMotion ? undefined : { y: position * 24 - 8 }}
                whileFocus={reducedMotion ? undefined : { y: position * 24 - 6 }}
                transition={reducedMotion ? { duration: 0 } : { duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
                className={cn(
                  "group relative w-[min(27rem,calc(100vw-3rem))] [grid-area:stack] overflow-hidden rounded-xl border bg-[#111426] px-6 py-5 text-left text-white shadow-[0_30px_80px_rgba(12,10,34,0.25)] outline-none",
                  "focus-visible:ring-2 focus-visible:ring-[#9c87ff] focus-visible:ring-offset-2 focus-visible:ring-offset-[#f7f7fb]",
                  isActive ? palette.border : "border-white/12",
                )}
                style={{ zIndex: cards.length - position }}
              >
                <span aria-hidden className={cn("absolute inset-0 bg-gradient-to-br to-transparent opacity-90", palette.glow)} />
                <span className="relative flex items-start justify-between gap-5">
                  <span className="flex min-w-0 items-center gap-3.5">
                    <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-lg", palette.icon)}>
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-white/45">{eyebrow}</span>
                      <span className="mt-1 block text-lg font-semibold leading-tight">{title}</span>
                    </span>
                  </span>
                  <ArrowUpRight className={cn("mt-1 size-4 shrink-0 transition-colors", isActive ? "text-white/75" : "text-white/28")} aria-hidden />
                </span>
                <span className="relative mt-5 block min-h-12 max-w-[34ch] text-sm leading-6 text-white/64">{description}</span>
                <span className="relative mt-5 flex items-center justify-between border-t border-white/10 pt-3 text-xs">
                  <span className="flex items-center gap-1.5 text-white/70">
                    <CheckCircle2 className="size-3.5 text-[#72d7a8]" aria-hidden />
                    {status}
                  </span>
                  <span className="font-medium tabular-nums text-white/38">0{index + 1}</span>
                </span>
              </m.button>
            );
          })}
        </div>
      </LayoutGroup>

      <div className="flex items-center" role="group" aria-label="Review stages">
        {cards.map((card, index) => (
          <button
            key={card.title}
            type="button"
            onClick={() => onActiveChange(index)}
            aria-label={`Show ${card.title}`}
            aria-current={index === activeIndex ? "step" : undefined}
            className="group flex size-11 items-center justify-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-[#6f4cff]"
          >
            <span
              aria-hidden
              className={cn(
                "h-1.5 rounded-full transition-[width,background-color] duration-300 motion-reduce:transition-none",
                index === activeIndex ? "w-9 bg-[#5b39d5]" : "w-5 bg-[#d8d5e5] group-hover:bg-[#aaa2ca]",
              )}
            />
          </button>
        ))}
        <span className="ml-1 text-xs font-medium tabular-nums text-[#767b8d]">
          0{activeIndex + 1} / 0{cards.length}
        </span>
      </div>
    </div>
  );
}
