"use client";

import * as React from "react";
import {
  AnimatePresence,
  motion,
  type Variants,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from "framer-motion";
import { cn } from "@/lib/utils";

type DrawState = "rest" | "draw";

const DrawContext = React.createContext<DrawState>("rest");

export interface AnimatedIconProps {
  className?: string;
}

const drawVariants = (delay = 0, duration = 0.55): Variants => ({
  rest: { pathLength: 1, opacity: 1 },
  draw: {
    pathLength: [0, 1],
    opacity: [0, 1],
    transition: {
      pathLength: { duration, ease: "easeInOut", delay },
      opacity: { duration: 0.12, delay },
    },
  },
});

function DrawPath({ d, delay = 0, duration = 0.55 }: { d: string; delay?: number; duration?: number }) {
  const state = React.useContext(DrawContext);
  return <motion.path d={d} variants={drawVariants(delay, duration)} initial="rest" animate={state} />;
}

function IconBase({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn("inline-block size-[1.15em] align-[-0.22em]", className)}
    >
      {children}
    </svg>
  );
}

const HEART_D = "M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.49 4.04 3 5.5l7 7Z";

const fillReveal: Variants = {
  rest: { opacity: 1 },
  draw: { opacity: [0, 0, 1], transition: { duration: 0.75, times: [0, 0.62, 1], ease: "easeOut" } },
};

export function HeartIcon({ className }: AnimatedIconProps) {
  const state = React.useContext(DrawContext);
  return (
    <IconBase className={className}>
      <motion.path d={HEART_D} fill="currentColor" stroke="none" variants={fillReveal} initial="rest" animate={state} />
      <DrawPath d={HEART_D} duration={0.6} />
    </IconBase>
  );
}

export function SparklesIcon({ className }: AnimatedIconProps) {
  return (
    <IconBase className={className}>
      <DrawPath d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0Z" duration={0.6} />
      <DrawPath d="M20 3v4" delay={0.45} duration={0.2} />
      <DrawPath d="M22 5h-4" delay={0.5} duration={0.2} />
      <DrawPath d="M4 17v2" delay={0.6} duration={0.2} />
      <DrawPath d="M5 18H3" delay={0.65} duration={0.2} />
    </IconBase>
  );
}

export function MousePointerClickIcon({ className }: AnimatedIconProps) {
  return (
    <IconBase className={className}>
      <DrawPath d="M9.037 9.69a.498.498 0 0 1 .653-.653l11 4.5a.5.5 0 0 1-.074.949l-4.349 1.041a1 1 0 0 0-.74.739l-1.04 4.35a.5.5 0 0 1-.95.074Z" duration={0.5} />
      <DrawPath d="M14 4.1 12 6" delay={0.42} duration={0.22} />
      <DrawPath d="m5.1 8-2.9-.8" delay={0.48} duration={0.22} />
      <DrawPath d="m6 12-1.9 2" delay={0.54} duration={0.22} />
      <DrawPath d="M7.2 2.2 8 5.1" delay={0.6} duration={0.22} />
    </IconBase>
  );
}

export function RocketIcon({ className }: AnimatedIconProps) {
  return (
    <IconBase className={className}>
      <DrawPath d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" duration={0.55} />
      <DrawPath d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" delay={0.35} duration={0.3} />
      <DrawPath d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" delay={0.45} duration={0.3} />
      <DrawPath d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" delay={0.7} duration={0.3} />
    </IconBase>
  );
}

export interface HighlightProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, "color"> {
  children: React.ReactNode;
  icon: React.ReactNode;
  color?: string;
  iconPosition?: "before" | "after";
  image?: string;
  imageAlt?: string;
  autoPlay?: boolean;
}

export function Highlight({ children, icon, color, iconPosition = "before", image, imageAlt = "", autoPlay = false, className, ...props }: HighlightProps) {
  const reduce = useReducedMotion();
  const [active, setActive] = React.useState(autoPlay);
  const tipId = React.useId();
  const ref = React.useRef<HTMLSpanElement>(null);
  const motionLeft = useMotionValue(0);
  const left = useSpring(motionLeft, { stiffness: 700, damping: 45, mass: 0.5 });

  const pointTo = (clientX: number, snap = false) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const localLeft = clientX - rect.left;
    motionLeft.set(localLeft);
    if (snap) left.jump(localLeft);
  };
  const focusCenter = (snap = false) => {
    const rect = ref.current?.getBoundingClientRect();
    if (rect) pointTo(rect.left + rect.width / 2, snap);
  };
  const state: DrawState = !reduce && (autoPlay || active) ? "draw" : "rest";
  const spacing = iconPosition === "before" ? "mr-[0.22em]" : "ml-[0.22em]";
  const renderedIcon = React.isValidElement(icon)
    ? React.cloneElement(icon as React.ReactElement<{ className?: string }>, {
        className: cn(spacing, (icon.props as { className?: string }).className),
      })
    : icon ? <span className={cn("inline-block align-[-0.1em]", spacing)}>{icon}</span> : null;
  const style: React.CSSProperties = color ? { color, backgroundColor: active ? `${color}22` : "transparent" } : {};

  return (
    <span
      ref={ref}
      className={cn("relative -mx-[0.15em] inline-block cursor-pointer whitespace-nowrap rounded-[0.35em] px-[0.15em] align-baseline font-semibold text-foreground transition-colors", !color && "hover:bg-foreground/10 focus-visible:bg-foreground/10", className)}
      style={style}
      tabIndex={0}
      aria-describedby={image && active ? tipId : undefined}
      onMouseEnter={(event) => { pointTo(event.clientX, true); setActive(true); }}
      onMouseMove={(event) => pointTo(event.clientX)}
      onMouseLeave={() => setActive(false)}
      onFocus={() => { focusCenter(true); setActive(true); }}
      onBlur={() => setActive(false)}
      {...props}
    >
      <DrawContext.Provider value={state}>
        {iconPosition === "before" ? renderedIcon : null}
        {children}
        {iconPosition === "after" ? renderedIcon : null}
      </DrawContext.Provider>
      {image ? (
        <AnimatePresence>
          {active ? (
            <motion.span key="tip" role="tooltip" id={tipId} className="pointer-events-none absolute bottom-full z-50 mb-2 block -translate-x-1/2" style={{ left }}>
              <motion.span className="block origin-bottom" initial={{ opacity: 0, scale: reduce ? 1 : 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: reduce ? 1 : 0.94 }} transition={{ type: "spring", stiffness: 460, damping: 30 }}>
                <span className="block w-44 overflow-hidden rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-xl">
                  {/* Tooltip images may be arbitrary remote URLs, not configured Next image sources. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={image} alt={imageAlt} loading="lazy" className="block h-24 w-full rounded-lg object-cover" />
                </span>
                <span className="absolute left-1/2 top-full -mt-1 block size-2 -translate-x-1/2 rotate-45 border-b border-r border-border bg-popover" />
              </motion.span>
            </motion.span>
          ) : null}
        </AnimatePresence>
      ) : null}
    </span>
  );
}

export interface AnimatedHighlightTextProps extends React.HTMLAttributes<HTMLParagraphElement> {
  children: React.ReactNode;
  as?: React.ElementType;
}

export default function AnimatedHighlightText({ children, as: Tag = "p", className, ...props }: AnimatedHighlightTextProps) {
  return <Tag className={cn("max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground md:text-xl", className)} {...props}>{children}</Tag>;
}
