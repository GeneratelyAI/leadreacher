"use client";

import { Bot, Check } from "lucide-react";
import { cn } from "@/lib/utils";

type AiRecommendationBubbleProps = {
  recommendation: string;
  onUse: () => void;
  disabled?: boolean;
  className?: string;
};

export function AiRecommendationBubble({
  recommendation,
  onUse,
  disabled = false,
  className,
}: AiRecommendationBubbleProps) {
  return (
    <aside
      aria-label="AI recommendation"
      className={cn(
        "relative mt-3 rounded-xl border border-[#d9ccff] bg-[linear-gradient(135deg,#ffffff_0%,#fbf9ff_58%,#f5f0ff_100%)] px-5 py-5 text-left shadow-[0_12px_30px_rgba(84,41,223,.08)]",
        "before:absolute before:-top-2 before:left-9 before:size-4 before:rotate-45 before:border-l before:border-t before:border-[#d9ccff] before:bg-[#ffffff]",
        className,
      )}
    >
      <div className="relative flex gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#eee8ff] text-[#5b32df] shadow-[0_5px_14px_rgba(84,41,223,.12)]">
          <Bot className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1 sm:pr-32">
          <p className="text-sm font-semibold text-[#5429df]">AI recommendation</p>
          <p className="mt-3 text-sm font-medium leading-6 text-[#17203a]">You could say something like:</p>
          <p className="mt-1 text-sm font-semibold leading-6 text-[#17203a]">
            &quot;{recommendation}&quot;
          </p>
          <p className="mt-3 text-sm leading-6 text-[#687386]">This helps us tailor the best outreach strategy for you.</p>
        </div>
        <button
          type="button"
          onClick={onUse}
          disabled={disabled}
          className="mt-4 inline-flex items-center gap-2 rounded-lg border border-[#7959ef] bg-white px-3 py-2 text-xs font-semibold text-[#5429df] transition-colors hover:bg-[#f5f1ff] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#8b7fd4]/35 disabled:pointer-events-none disabled:opacity-50 sm:absolute sm:right-0 sm:bottom-0 sm:mt-0 sm:text-sm"
        >
          Use this
          <Check className="size-4" aria-hidden />
        </button>
      </div>
    </aside>
  );
}
