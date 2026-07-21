"use client";

import {
  Briefcase,
  Check,
  Diamond,
  Globe,
  Loader2,
  Sparkles,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  useWebsiteScrapeStatus,
  type WebsiteScrapeStatus,
} from "@/hooks/useWebsiteScrapeStatus";
import { cn } from "@/lib/utils";

type AuthMode = "login" | "signup";

type AuthMarketingPanelProps = {
  mode: AuthMode;
};

type InsightRow = {
  key: keyof Pick<
    WebsiteScrapeStatus,
    "market" | "offer" | "audience" | "value" | "strategyStatus"
  >;
  label: string;
  icon: LucideIcon;
};

const INSIGHT_ROWS: InsightRow[] = [
  { key: "market", label: "Your Market", icon: Globe },
  { key: "offer", label: "What You Offer", icon: Briefcase },
  { key: "audience", label: "Your Audience", icon: Users },
  { key: "value", label: "Your Value", icon: Diamond },
  {
    key: "strategyStatus",
    label: "Building Your Strategy",
    icon: TrendingUp,
  },
];

function TypewriterText({ text }: { text: string }) {
  const [displayedText, setDisplayedText] = useState("");

  useEffect(() => {
    let resetTimer: number | undefined;
    let interval: number | undefined;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      resetTimer = window.setTimeout(() => setDisplayedText(text), 0);

      return () => {
        if (resetTimer !== undefined) {
          window.clearTimeout(resetTimer);
        }
      };
    }

    resetTimer = window.setTimeout(() => {
      let index = 0;
      setDisplayedText("");
      interval = window.setInterval(() => {
        index += 1;
        setDisplayedText(text.slice(0, index));

        if (index >= text.length && interval !== undefined) {
          window.clearInterval(interval);
        }
      }, 18);
    }, 0);

    return () => {
      if (resetTimer !== undefined) {
        window.clearTimeout(resetTimer);
      }
      if (interval !== undefined) {
        window.clearInterval(interval);
      }
    };
  }, [text]);

  return (
    <span aria-label={text} className="auth-typewriter">
      {displayedText}
    </span>
  );
}

function StatusBadge({
  hasValue,
  isActive,
}: {
  hasValue: boolean;
  isActive: boolean;
}) {
  if (hasValue) {
    return (
      <span className="inline-flex min-w-22 items-center justify-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-400/12 dark:text-emerald-200 dark:ring-1 dark:ring-emerald-300/15">
        <Check className="size-3.5" aria-hidden />
        Found
      </span>
    );
  }

  if (isActive) {
    return (
      <span className="inline-flex min-w-24 items-center justify-center gap-1.5 rounded-lg bg-brand-purple/8 px-2.5 py-1.5 text-xs font-semibold text-brand-purple dark:bg-[#c4b5f0]/12 dark:text-[#ddd6fe] dark:ring-1 dark:ring-[#c4b5f0]/15">
        <Loader2 className="size-3.5 animate-spin" aria-hidden />
        In progress
      </span>
    );
  }

  return (
    <span className="inline-flex min-w-24 items-center justify-center rounded-lg bg-neutral-100 px-2.5 py-1.5 text-xs font-semibold text-neutral-500 dark:bg-white/10 dark:text-white/65 dark:ring-1 dark:ring-white/10">
      Analyzing...
    </span>
  );
}

export default function AuthMarketingPanel({ mode }: AuthMarketingPanelProps) {
  const { status, message, websiteUrl } = useWebsiteScrapeStatus();

  const activeIndex = useMemo(() => {
    const index = INSIGHT_ROWS.findIndex((row) => !status[row.key]);
    return index === -1 ? INSIGHT_ROWS.length - 1 : index;
  }, [status]);

  return (
    <section
      className={cn(
        "app-card auth-analysis-card w-full px-6 py-6 text-left lg:flex lg:h-full lg:flex-col",
        "lg:px-8 lg:py-7 xl:px-10 xl:py-9",
      )}
      aria-label={`${mode === "signup" ? "Signup" : "Login"} website insights`}
    >
      <div className="flex items-start gap-3">
        <Sparkles
          className="mt-1 size-6 shrink-0 text-brand-purple dark:text-[#c4b5f0]"
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-neutral-950 dark:text-white xl:text-2xl">
                We&apos;re building your outreach blueprint
              </h1>
              <p className="mt-1 text-sm text-neutral-500 dark:text-white/72">
                Here&apos;s what we learned from your website.
              </p>
            </div>
            <div className="hidden shrink-0 items-center gap-3 pt-1 text-sm text-neutral-700 dark:text-white/70 xl:flex">
              <span>Step 1 of 5</span>
              <span className="flex items-center gap-1.5" aria-hidden>
                {Array.from({ length: 5 }, (_, index) => (
                  <span
                    key={index}
                    className={cn(
                      "size-2 rounded-full",
                      index === 0
                        ? "bg-brand-purple dark:bg-[#c4b5f0]"
                        : "bg-brand-purple/10 dark:bg-white/10",
                    )}
                  />
                ))}
              </span>
            </div>
          </div>
          {websiteUrl ? (
            <p className="mt-2 text-xs font-medium text-brand-purple/80 dark:text-[#c4b5f0]/80">
              {websiteUrl}
            </p>
          ) : null}
        </div>
      </div>

      {message ? (
        <p className="mt-5 rounded-2xl bg-white/55 px-4 py-3 text-sm font-medium text-neutral-600 dark:bg-white/10 dark:text-white/80 dark:ring-1 dark:ring-white/12">
          {message}
        </p>
      ) : null}

      <div className="mt-5 overflow-hidden rounded-2xl bg-white/65 shadow-sm ring-1 ring-black/5 dark:bg-[#151d2a] dark:ring-white/14 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
        <div className="lg:grid lg:flex-1 lg:grid-rows-5">
          {INSIGHT_ROWS.map((row, index) => {
            const Icon = row.icon;
            const value = status[row.key];
            const hasValue = value.trim().length > 0;
            const isActive =
              status.status === "running" && !hasValue && index === activeIndex;

            return (
              <div
                key={row.key}
                className="grid min-h-[3.75rem] grid-cols-[1.25rem_minmax(0,1fr)] gap-x-2.5 gap-y-1.5 border-b border-neutral-200/65 px-4 py-2 transition-[min-height,background-color] duration-slow ease-brand last:border-b-0 dark:border-white/8 xl:grid-cols-[1.25rem_160px_minmax(0,1fr)_auto] xl:items-center xl:gap-x-3 xl:px-5"
              >
                <Icon
                  className="mt-0.5 size-5 text-brand-purple dark:text-[#c4b5f0] xl:mt-0"
                  aria-hidden
                />
                <p className="self-center text-sm font-bold text-neutral-950 dark:text-white/90">
                  {row.label}
                </p>
                <p
                  className={cn(
                    "col-span-2 max-h-[2.85rem] overflow-hidden text-sm leading-relaxed text-neutral-600 transition-[opacity,transform] duration-slow ease-brand dark:text-white/75 xl:col-span-1",
                    hasValue ? "opacity-100" : "opacity-50",
                  )}
                >
                  {hasValue ? (
                    <TypewriterText text={value} />
                  ) : (
                    "Waiting for website analysis"
                  )}
                </p>
                <div className="col-span-2 xl:col-span-1">
                  <StatusBadge hasValue={hasValue} isActive={isActive} />
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-3 border-t border-neutral-200/65 bg-white/55 px-4 py-3 dark:border-white/12 dark:bg-white/9">
          <Sparkles
            className="size-5 shrink-0 text-brand-purple dark:text-[#c4b5f0]"
            aria-hidden
          />
          <div>
            <p className="text-sm font-bold text-neutral-950 dark:text-white/90">
              We&apos;re analyzing your insights to craft the most effective outreach strategy.
            </p>
            <p className="mt-1 text-sm text-neutral-500 dark:text-white/70">
              This usually takes less than a minute.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
