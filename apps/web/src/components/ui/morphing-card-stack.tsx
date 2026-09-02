"use client";

import { useEffect, useRef, useState } from "react";
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
  mobileDetails?: readonly string[];
};

type MorphingCardStackProps = {
  cards: readonly MorphingCard[];
  activeIndex: number;
  onActiveChange: (index: number) => void;
  className?: string;
};

const accents = {
  violet: {
    icon: "bg-[#a992ff]/20 text-[#d9d0ff] ring-1 ring-inset ring-[#b9a9ff]/25",
    border: "border-[#a18aff]/65",
    glow: "from-[#7a52ff]/45 via-[#30225d]/28",
    surface: "from-[#241948] via-[#17172d] to-[#111426]",
    number: "text-[#c5b8ff]",
  },
  blue: {
    icon: "bg-[#77adff]/20 text-[#c7deff] ring-1 ring-inset ring-[#91bcff]/25",
    border: "border-[#6da7ff]/65",
    glow: "from-[#3384ff]/45 via-[#182d54]/30",
    surface: "from-[#102d55] via-[#14213d] to-[#111426]",
    number: "text-[#a9cbff]",
  },
  green: {
    icon: "bg-[#57d6a1]/18 text-[#b7f5d6] ring-1 ring-inset ring-[#83e4ba]/20",
    border: "border-[#54d5a0]/60",
    glow: "from-[#1fb57e]/42 via-[#123c36]/30",
    surface: "from-[#103d38] via-[#142a31] to-[#111426]",
    number: "text-[#a8f0ce]",
  },
} as const;

export function MorphingCardStack({ cards, activeIndex, onActiveChange, className }: MorphingCardStackProps) {
  const reducedMotion = Boolean(useReducedMotion());
  const previousActiveIndexRef = useRef(activeIndex);
  const [cardTransition, setCardTransition] = useState<{ from: number; to: number } | null>(null);

  useEffect(() => {
    const previousIndex = previousActiveIndexRef.current;
    previousActiveIndexRef.current = activeIndex;
    if (previousIndex === activeIndex || reducedMotion) return;

    setCardTransition({ from: previousIndex, to: activeIndex });
    const timeout = window.setTimeout(() => setCardTransition(null), 700);

    return () => window.clearTimeout(timeout);
  }, [activeIndex, reducedMotion]);

  if (cards.length === 0) return null;

  const selectStage = (index: number) => {
    if (index === activeIndex) return;

    onActiveChange(index);
  };

  return (
    <div className={cn("space-y-6", className)}>
      <LayoutGroup id="landing-review-stack">
        <div className="grid min-h-[25rem] w-full max-w-[31rem] [grid-template-areas:'stack'] place-items-center [perspective:1400px] sm:min-h-[26rem] lg:min-h-[365px]">
          {cards.map(({ title, description, icon: Icon, eyebrow = "Campaign stage", status = "Ready", accent = "violet", mobileDetails = [] }, index) => {
            const palette = accents[accent];
            const position = (index - activeIndex + cards.length) % cards.length;
            const isActive = position === 0;
            const isFlippingIn = cardTransition?.to === index;
            const isFlippingOut = cardTransition?.from === index;
            const restingRotateY = -12 - position * 6;

            const selectCard = () => {
              selectStage(index);
            };

            return (
              <m.button
                key={title}
                layout
                type="button"
                aria-pressed={isActive}
                aria-label={`${eyebrow}. ${title}. ${description}. ${status}. ${isActive ? "Selected stage." : "Press to select this stage."}`}
                onClick={selectCard}
                initial={false}
                animate={{
                  x: reducedMotion ? position * 10 : position * 18,
                  y: position * 30,
                  rotate: reducedMotion ? 0 : position * 2.8,
                  rotateY: reducedMotion ? 0 : isFlippingOut ? [0, -42, restingRotateY] : isFlippingIn ? [42, 0] : isActive ? 0 : restingRotateY,
                  z: reducedMotion ? 0 : isActive ? 48 : -position * 16,
                  scale: 1 - position * 0.025,
                  opacity: 1 - position * 0.09,
                }}
                whileHover={reducedMotion ? undefined : isActive ? { y: -8 } : undefined}
                whileFocus={reducedMotion ? undefined : isActive ? { y: -6 } : undefined}
                transition={
                  reducedMotion
                    ? { duration: 0 }
                    : {
                        x: isFlippingOut ? { delay: 0.18, duration: 0.48, ease: [0.22, 1, 0.36, 1] } : { duration: 0.62, ease: [0.22, 1, 0.36, 1] },
                        y: isFlippingOut ? { delay: 0.18, duration: 0.48, ease: [0.22, 1, 0.36, 1] } : { duration: 0.62, ease: [0.22, 1, 0.36, 1] },
                        z: isFlippingOut ? { delay: 0.18, duration: 0.48, ease: [0.22, 1, 0.36, 1] } : { duration: 0.62, ease: [0.22, 1, 0.36, 1] },
                        rotate: isFlippingOut ? { delay: 0.18, duration: 0.48, ease: [0.22, 1, 0.36, 1] } : { duration: 0.62, ease: [0.22, 1, 0.36, 1] },
                        rotateY: isFlippingOut
                          ? { duration: 0.68, times: [0, 0.68, 1], ease: [0.22, 1, 0.36, 1] }
                          : isFlippingIn
                          ? { delay: 0.08, duration: 0.62, ease: [0.16, 1, 0.3, 1] }
                          : { duration: 0.5, ease: [0.4, 0, 1, 1] },
                        scale: isFlippingOut ? { delay: 0.18, duration: 0.48, ease: [0.22, 1, 0.36, 1] } : { duration: 0.62, ease: [0.22, 1, 0.36, 1] },
                        opacity: { duration: 0.36, ease: [0.22, 1, 0.36, 1] },
                      }
                }
                className={cn(
                  "group relative w-[min(27rem,calc(100vw-3rem))] [grid-area:stack] min-h-[20.5rem] text-left outline-none sm:min-h-[21rem] lg:min-h-[15.75rem]",
                  "focus-visible:ring-2 focus-visible:ring-[#9c87ff] focus-visible:ring-offset-2 focus-visible:ring-offset-[#f7f7fb]",
                )}
                style={{
                  zIndex: cards.length - position,
                  transformOrigin: "center center",
                  transformStyle: "preserve-3d",
                  WebkitTransformStyle: "preserve-3d",
                  willChange: "transform",
                }}
              >
                <span
                  className={cn(
                    "absolute inset-0 block overflow-hidden rounded-2xl border bg-gradient-to-br px-5 py-5 text-white shadow-[0_30px_80px_rgba(12,10,34,0.25)] sm:px-6",
                    palette.surface,
                    isActive ? cn(palette.border, "shadow-[0_36px_80px_rgba(12,10,34,0.3)]") : "border-white/12",
                  )}
                  style={{
                    backfaceVisibility: "hidden",
                    transformOrigin: "center center",
                    transformStyle: "preserve-3d",
                    WebkitBackfaceVisibility: "hidden",
                    WebkitTransformStyle: "preserve-3d",
                    willChange: "transform",
                  }}
                >
                  <span aria-hidden className={cn("absolute inset-0 rounded-2xl bg-gradient-to-br to-transparent opacity-95", palette.glow)} />
                  <span aria-hidden className="absolute inset-x-6 top-0 h-px bg-white/35" />
                  <span aria-hidden className="absolute inset-y-4 right-0 w-px bg-white/10" />
                  <span aria-hidden className="relative block [backface-visibility:hidden]">
                        <span className="flex items-start justify-between gap-5">
                          <span className="flex min-w-0 items-center gap-3.5">
                            <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-lg", palette.icon)}>
                              <Icon className="size-5" />
                            </span>
                            <span className="min-w-0">
                              <span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-white/45">{eyebrow}</span>
                              <span className="mt-1 block text-lg font-semibold leading-tight">{title}</span>
                            </span>
                          </span>
                          <ArrowUpRight className={cn("mt-1 size-4 shrink-0 transition-[color,transform] duration-300", isActive ? "text-white/85 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" : "text-white/28")} />
                        </span>
                        <span className="mt-5 block min-h-12 max-w-[34ch] text-sm leading-6 text-white/64">{description}</span>
                        {mobileDetails.length > 0 ? (
                          <span className="mt-4 grid gap-2 border-t border-white/10 pt-4 lg:hidden">
                            {mobileDetails.map((detail) => (
                              <span key={detail} className="flex items-start gap-2 text-[13px] leading-5 text-white/72">
                                <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-[#72d7a8]" />
                                <span>{detail}</span>
                              </span>
                            ))}
                          </span>
                        ) : null}
                        <span className="mt-5 flex items-center justify-between border-t border-white/10 pt-3 text-xs">
                          <span className="flex items-center gap-1.5 text-white/70">
                            <CheckCircle2 className="size-3.5 text-[#72d7a8]" />
                            {status}
                          </span>
                          <span className={cn("font-semibold tabular-nums", palette.number)}>0{index + 1}</span>
                        </span>
                  </span>
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
            onClick={() => selectStage(index)}
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
        <span className="ml-1 text-xs font-medium tabular-nums text-[#62697e]">
          0{activeIndex + 1} / 0{cards.length}
        </span>
      </div>
    </div>
  );
}
