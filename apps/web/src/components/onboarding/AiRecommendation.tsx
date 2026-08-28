"use client";

import { Bot, Check } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

type AiRecommendationProps = {
  recommendation: string;
  onUse: () => void;
  disabled?: boolean;
  className?: string;
};

export function AiRecommendation({
  recommendation,
  onUse,
  disabled = false,
  className,
}: AiRecommendationProps) {
  return (
    <aside
      aria-label="AI recommendation"
      className={cn(
        "relative mt-3 rounded-xl border border-[#d9ccff] bg-[linear-gradient(135deg,#ffffff_0%,#fbf9ff_58%,#f5f0ff_100%)] px-5 py-5 text-left shadow-[0_12px_30px_rgba(84,41,223,.08)] dark:border-onboarding-purple-700/70 dark:bg-[linear-gradient(135deg,#1a222d_0%,#181e29_58%,#1d1930_100%)] dark:shadow-[0_18px_42px_rgba(0,0,0,.28)]",
        "before:absolute before:-top-2 before:left-9 before:size-4 before:rotate-45 before:border-l before:border-t before:border-[#d9ccff] before:bg-[#ffffff] dark:before:border-onboarding-purple-700/70 dark:before:bg-[#1a222d]",
        className,
      )}
    >
      <div className="relative flex gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#eee8ff] text-[#5b32df] shadow-[0_5px_14px_rgba(84,41,223,.12)] dark:bg-onboarding-purple-900/80 dark:text-onboarding-purple-200 dark:shadow-[0_5px_18px_rgba(105,76,220,.2)]">
          <Bot className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1 sm:pr-32">
          <p className="text-sm font-semibold text-[#5429df] dark:text-onboarding-purple-200">AI recommendation</p>
          <p className="mt-3 text-sm font-medium leading-6 text-[#17203a] dark:text-onboarding-neutral-100">You could say something like:</p>
          <p className="mt-1 text-sm font-semibold leading-6 text-[#17203a] dark:text-white">
            &quot;{recommendation}&quot;
          </p>
          <p className="mt-3 text-sm leading-6 text-[#687386] dark:text-onboarding-neutral-300">This helps us tailor the best outreach strategy for you.</p>
        </div>
        <button
          type="button"
          onClick={onUse}
          disabled={disabled}
          className="mt-4 inline-flex items-center gap-2 rounded-lg border border-[#7959ef] bg-white px-3 py-2 text-xs font-semibold text-[#5429df] transition-colors hover:bg-[#f5f1ff] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#8b7fd4]/35 disabled:pointer-events-none disabled:opacity-50 sm:absolute sm:right-0 sm:bottom-0 sm:mt-0 sm:text-sm dark:border-onboarding-purple-400 dark:bg-onboarding-purple-950/70 dark:text-onboarding-purple-100 dark:hover:bg-onboarding-purple-900"
        >
          Use this
          <Check className="size-4" aria-hidden />
        </button>
      </div>
    </aside>
  );
}
