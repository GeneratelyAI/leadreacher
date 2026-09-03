"use client";

import type { ReactNode } from "react";
import { toast } from "sonner";
import { X } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

export type FeedbackTone = "error" | "success" | "guidance" | "warning" | "loading";

type FeedbackAction = {
  label: string;
  onClick: () => void;
};

export type FeedbackOptions = {
  id?: string;
  title: string;
  description?: string;
  tone: FeedbackTone;
  action?: FeedbackAction;
  secondaryAction?: FeedbackAction;
  duration?: number;
};

const toneStyles: Record<FeedbackTone, {
  surface: string;
  close: string;
  action: string;
}> = {
  error: {
    surface: "border-[#f0aaa3] bg-[#f9d8d5] text-[#161b2e] dark:border-[#763f42] dark:bg-[#4a2025] dark:text-white",
    close: "text-[#6d4448] hover:bg-black/10 hover:text-[#21151a] dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white",
    action: "bg-[#26171c] text-white hover:bg-[#40232b] dark:bg-white dark:text-[#35171e] dark:hover:bg-[#f8e9eb]",
  },
  success: {
    surface: "border-[#2ba77f] bg-[#43c59e] text-[#111a2d] dark:border-[#287c66] dark:bg-[#153e33] dark:text-white",
    close: "text-[#285f56] hover:bg-black/10 hover:text-[#10241f] dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white",
    action: "bg-[#102031] text-white hover:bg-[#1c3148] dark:bg-white dark:text-[#153e33] dark:hover:bg-[#eafaf4]",
  },
  guidance: {
    surface: "border-[#c2b4fb] bg-[#ddd5ff] text-[#17152b] dark:border-[#594797] dark:bg-[#2b214d] dark:text-white",
    close: "text-[#655b88] hover:bg-black/10 hover:text-[#211b3b] dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white",
    action: "bg-[#26175d] text-white hover:bg-[#3c258d] dark:bg-white dark:text-[#2b214d] dark:hover:bg-[#f1edff]",
  },
  warning: {
    surface: "border-[#efc15d] bg-[#ffe3a3] text-[#231b0c] dark:border-[#806526] dark:bg-[#463411] dark:text-white",
    close: "text-[#806832] hover:bg-black/10 hover:text-[#2d230d] dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white",
    action: "bg-[#33250b] text-white hover:bg-[#513b12] dark:bg-white dark:text-[#463411] dark:hover:bg-[#fff6dc]",
  },
  loading: {
    surface: "border-[#b7c9ef] bg-[#dde7ff] text-[#121a2c] dark:border-[#435a89] dark:bg-[#1e2b49] dark:text-white",
    close: "text-[#60749e] hover:bg-black/10 hover:text-[#17223b] dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white",
    action: "bg-[#16294f] text-white hover:bg-[#223e76] dark:bg-white dark:text-[#1e2b49] dark:hover:bg-[#edf2ff]",
  },
};

function defaultDuration(tone: FeedbackTone): number {
  if (tone === "error" || tone === "loading") return Infinity;
  if (tone === "success") return 4_000;
  return 8_000;
}

export function FeedbackCard({
  options,
  toastId,
  preview = false,
}: {
  options: FeedbackOptions;
  toastId?: string | number;
  preview?: boolean;
}) {
  const style = toneStyles[options.tone];
  const liveRole = options.tone === "error" ? "alert" : "status";

  return (
    <section
      role={liveRole}
      aria-live={options.tone === "error" ? "assertive" : "polite"}
      className={cn(
        "relative min-h-40 w-full overflow-hidden rounded-2xl border p-6 pr-20 shadow-[0_18px_48px_rgba(25,18,55,0.16)]",
        style.surface,
      )}
    >
      <div className="flex min-h-28 flex-col">
        <div className="min-w-0 flex-1">
          <h2 className="pr-5 text-lg font-semibold leading-6">{options.title}</h2>
          {options.description ? (
            <p className="mt-2 text-base leading-6 opacity-90">{options.description}</p>
          ) : null}
          {options.action || options.secondaryAction ? (
            <div className="mt-4 flex flex-wrap items-center gap-3 pr-2 text-xs font-semibold">
              {options.action ? (
                <button
                  type="button"
                  onClick={() => {
                    options.action?.onClick();
                    if (!preview && toastId !== undefined) toast.dismiss(toastId);
                  }}
                  className={cn("min-h-9 rounded-lg px-3.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current focus-visible:ring-offset-2 focus-visible:ring-offset-transparent", style.action)}
                >
                  {options.action.label}
                </button>
              ) : null}
              {options.secondaryAction ? (
                <button
                  type="button"
                  onClick={() => {
                    options.secondaryAction?.onClick();
                    if (!preview && toastId !== undefined) toast.dismiss(toastId);
                  }}
                  className="min-h-9 rounded-lg px-1 underline decoration-current/40 underline-offset-4 hover:decoration-current focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
                >
                  {options.secondaryAction.label}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
        {options.tone !== "loading" ? (
          <button
            type="button"
            aria-label="Dismiss notification"
            onClick={() => { if (!preview && toastId !== undefined) toast.dismiss(toastId); }}
            className={cn("absolute right-3 top-3 flex size-10 items-center justify-center rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current", style.close)}
          >
            <X className="size-4" aria-hidden />
          </button>
        ) : null}
      </div>
    </section>
  );
}

export function showFeedback(options: FeedbackOptions): string | number {
  const id = options.id ?? `${options.tone}:${options.title}`;
  toast.custom(
    (toastId) => <FeedbackCard options={options} toastId={toastId} />,
    {
      id,
      duration: options.duration ?? defaultDuration(options.tone),
      unstyled: true,
      className: "w-[min(24rem,calc(100vw-2rem))]",
    },
  );
  return id;
}

export const feedback = {
  error: (title: string, options: Omit<FeedbackOptions, "title" | "tone"> = {}) => showFeedback({ ...options, title, tone: "error" }),
  success: (title: string, options: Omit<FeedbackOptions, "title" | "tone"> = {}) => showFeedback({ ...options, title, tone: "success" }),
  guidance: (title: string, options: Omit<FeedbackOptions, "title" | "tone"> = {}) => showFeedback({ ...options, title, tone: "guidance" }),
  warning: (title: string, options: Omit<FeedbackOptions, "title" | "tone"> = {}) => showFeedback({ ...options, title, tone: "warning" }),
  loading: (title: string, options: Omit<FeedbackOptions, "title" | "tone"> = {}) => showFeedback({ ...options, title, tone: "loading" }),
  dismiss: (id?: string | number) => toast.dismiss(id),
};

export function FeedbackPreviewStack({ children }: { children: ReactNode }) {
  return <div className="grid w-full max-w-sm gap-4">{children}</div>;
}
