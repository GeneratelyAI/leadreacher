"use client";

import { m } from "framer-motion";
import { Check } from "@/components/ui/icons";
import type { KeyboardEvent } from "react";
import { cn } from "@/lib/utils";

export type WorkflowStepperItem = {
  id: string;
  label: string;
  action?: string;
};

type WorkflowStepperProps = {
  items: readonly WorkflowStepperItem[];
  activeIndex: number;
  onSelect?: (index: number) => void;
  ariaLabel: string;
  className?: string;
  variant?: "dark" | "light";
};

export function WorkflowStepper({
  items,
  activeIndex,
  onSelect,
  ariaLabel,
  className,
  variant = "dark",
}: WorkflowStepperProps) {
  const boundedActiveIndex = Math.min(Math.max(activeIndex, 0), Math.max(items.length - 1, 0));
  const progressWidth = items.length > 1
    ? `${(boundedActiveIndex / (items.length - 1)) * 80}%`
    : "0%";
  const isDark = variant === "dark";

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (!onSelect || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) return;
    event.preventDefault();
    const direction = event.key === "ArrowRight" ? 1 : -1;
    const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    const focusedIndex = tabs.indexOf(document.activeElement as HTMLButtonElement);
    const currentIndex = focusedIndex >= 0 ? focusedIndex : boundedActiveIndex;
    const nextIndex = (currentIndex + direction + items.length) % items.length;
    onSelect(nextIndex);
    tabs[nextIndex]?.focus();
  }

  return (
    <nav
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={handleKeyDown}
      className={cn(
        "relative px-5 pb-5 pt-4 lg:px-8 lg:pb-6 lg:pt-6",
        isDark ? "text-white" : "text-[#111527] dark:text-white",
        className,
      )}
    >
      <div
        aria-hidden
        className={cn(
          "absolute left-[10%] right-[10%] top-[39px] h-px lg:top-[49px]",
          isDark ? "bg-white/12" : "bg-[#e3e5eb] dark:bg-white/12",
        )}
      />
      <m.div
        aria-hidden
        className="absolute left-[10%] top-[38px] h-0.5 rounded-full bg-[#5429df] lg:top-[48px]"
        animate={{ width: progressWidth }}
        transition={{ duration: 0.45, ease: "easeOut" }}
      />
      <div
        className="relative grid gap-2"
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      >
        {items.map((item, index) => {
          const isActive = boundedActiveIndex === index;
          const isComplete = index < boundedActiveIndex;

          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-current={isActive ? "step" : undefined}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onSelect?.(index)}
              className="group relative z-10 flex min-w-0 flex-col items-center text-center focus-visible:outline-none"
            >
              <m.span
                animate={{ scale: isActive ? 1.08 : 1 }}
                className={cn(
                  "flex size-9 items-center justify-center rounded-full border text-xs font-semibold transition-colors duration-300 lg:size-11 lg:text-sm",
                  isActive
                    ? isDark
                      ? "border-[#9f8aff] bg-[#7154f5] text-white shadow-[0_0_0_6px_rgba(113,84,245,.13),0_0_30px_rgba(113,84,245,.48)]"
                      : "border-[#5429df] bg-[#5429df] text-white shadow-[0_0_0_5px_rgba(84,41,223,.08),0_6px_16px_rgba(84,41,223,.2)]"
                    : isComplete
                      ? isDark
                        ? "border-[#7461d8] bg-[#262143] text-[#c7baff]"
                        : "border-[#ede9fe] bg-[#faf7ff] text-[#5429df] shadow-[0_4px_12px_rgba(31,35,56,.08)] dark:border-[#7461d8] dark:bg-[#262143] dark:text-[#c7baff] dark:shadow-none"
                      : isDark
                        ? "border-white/15 bg-[#171a2d] text-white/50 group-hover:border-white/30 group-hover:text-white/80"
                        : "border-[#e5e7eb] bg-white text-[#4b5563] shadow-[0_4px_12px_rgba(31,35,56,.08)] group-hover:border-[#c4b5fd] group-hover:text-[#5429df] dark:border-white/15 dark:bg-[#171a2d] dark:text-white/50 dark:shadow-none dark:group-hover:border-white/30 dark:group-hover:text-white/80",
                )}
              >
                {isComplete ? <Check className="size-4" aria-hidden /> : index + 1}
              </m.span>
              <span
                className={cn(
                  "mt-2.5 truncate text-[10px] font-semibold transition-colors lg:text-xs",
                  isActive || isComplete
                    ? isDark ? "text-white" : "text-[#4221a6] dark:text-white"
                    : isDark ? "text-white/48" : "text-[#687386] dark:text-white/48",
                )}
              >
                {item.label}
              </span>
              {item.action ? (
                <span
                  className={cn(
                    "mt-1 hidden max-w-[150px] text-[9px] leading-4 xl:block",
                    isActive ? (isDark ? "text-white/65" : "text-[#687386] dark:text-white/65") : (isDark ? "text-white/30" : "text-[#9aa2b1] dark:text-white/30"),
                  )}
                >
                  {item.action}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
