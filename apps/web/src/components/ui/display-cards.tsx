"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { ArrowUpRight, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type DisplayCard = {
  title: string;
  description: string;
  icon: LucideIcon;
  eyebrow?: string;
  status?: string;
  accent?: "violet" | "blue" | "green";
};

const accents = {
  violet: { icon: "bg-[#6f4cff]/20 text-[#b3a3ff]", line: "bg-[#8064ff]", glow: "from-[#6f4cff]/18" },
  blue: { icon: "bg-[#3f7cff]/18 text-[#91b2ff]", line: "bg-[#5f91ff]", glow: "from-[#3f7cff]/16" },
  green: { icon: "bg-[#36b87d]/18 text-[#78ddb0]", line: "bg-[#43c58d]", glow: "from-[#36b87d]/15" },
} as const;

export function DisplayCards({ cards, className }: { cards: readonly DisplayCard[]; className?: string }) {
  const reducedMotion = Boolean(useReducedMotion());
  const [activeIndex, setActiveIndex] = useState(cards.length - 1);
  const center = (cards.length - 1) / 2;

  return (
    <div className={cn("flex min-h-[350px] items-center justify-center overflow-visible py-8 sm:min-h-[390px]", className)}>
      <div className="grid w-full max-w-[460px] [grid-template-areas:'stack'] place-items-center">
        {cards.map(({ title, description, icon: Icon, eyebrow = "Campaign stage", status = "Ready", accent = "violet" }, index) => {
          const palette = accents[accent];
          const isActive = index === activeIndex;
          const offset = index - center;
          return (
            <motion.article
              key={title}
              tabIndex={0}
              aria-label={`${title}: ${description}`}
              onHoverStart={() => setActiveIndex(index)}
              onFocus={() => setActiveIndex(index)}
              initial={reducedMotion ? false : { opacity: 0, y: 26 }}
              whileInView={{ opacity: isActive ? 1 : 0.84, x: offset * 24, y: index * 42, rotate: reducedMotion ? 0 : offset * 1.8, scale: isActive ? 1.025 : 0.985 }}
              whileHover={reducedMotion ? undefined : { y: index * 42 - 16, rotate: 0, scale: 1.035 }}
              whileFocus={reducedMotion ? undefined : { y: index * 42 - 12, rotate: 0, scale: 1.025 }}
              viewport={{ once: true, amount: 0.45 }}
              transition={{ type: "spring", stiffness: 250, damping: 26, delay: reducedMotion ? 0 : index * 0.08 }}
              className="group relative w-[min(21rem,calc(100vw-4rem))] [grid-area:stack] overflow-hidden rounded-xl border border-white/12 bg-[#111426] px-5 py-4 text-white shadow-[0_28px_80px_rgba(12,10,34,0.28)] outline-none focus-visible:ring-2 focus-visible:ring-[#9c87ff] sm:w-[23rem]"
              style={{ zIndex: isActive ? cards.length + 1 : index + 1 }}
            >
              <div aria-hidden className={cn("absolute inset-0 bg-gradient-to-br to-transparent opacity-80", palette.glow)} />
              <div aria-hidden className={cn("absolute inset-y-0 left-0 w-1", palette.line)} />
              <div className="relative flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", palette.icon)}><Icon className="size-5" aria-hidden /></span>
                  <div><p className="text-[10px] font-semibold uppercase text-white/42">{eyebrow}</p><h3 className="mt-0.5 font-semibold">{title}</h3></div>
                </div>
                <ArrowUpRight className="size-4 text-white/28 transition-colors group-hover:text-white/70 group-focus-visible:text-white/70" aria-hidden />
              </div>
              <p className="relative mt-4 min-h-12 text-sm leading-6 text-white/64">{description}</p>
              <div className="relative mt-4 flex items-center justify-between border-t border-white/10 pt-3 text-xs"><span className="flex items-center gap-1.5 text-white/68"><CheckCircle2 className="size-3.5 text-[#72d7a8]" />{status}</span><span className="text-white/32">0{index + 1}</span></div>
            </motion.article>
          );
        })}
      </div>
    </div>
  );
}
