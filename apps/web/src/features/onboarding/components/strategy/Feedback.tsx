"use client";

import { useEffect, useState } from "react";
import { Info, Loader2, RefreshCw } from "@/components/ui/icons";
import { Button } from "@/components/ui/Button";
import { Loading } from "@/components/ui/Loading";
import { cn } from "@/lib/utils";
import { OnboardingCard } from "../OnboardingCard";
import { StrategyBriefContent } from "./Brief";
import type { StrategyBrief } from "../../state/strategy-model";

export function LoadingStrategy({ strategyBrief }: { strategyBrief: StrategyBrief | null }) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const progressMessage =
    elapsedSeconds < 8
      ? "Preparing your audience filters"
      : elapsedSeconds < 25
        ? "Finding matching decision makers"
        : elapsedSeconds < 60
          ? "Reviewing profiles and reachability"
          : "The provider is processing your audience. You can leave this page and return safely.";

  return (
    <OnboardingCard className="mx-auto mt-8 w-full max-w-4xl px-6 py-8 sm:px-8" role="status" aria-live="polite">
      {strategyBrief ? <StrategyBriefContent brief={strategyBrief} audiencePending /> : null}
      <div className={cn("flex flex-col items-center text-center", strategyBrief && "mt-7 border-t border-neutral-200 pt-7 dark:border-neutral-700")}>
        <Loading tone="brand" label="Running your audience analysis" className="-mb-2" />
        <h2 className="mt-5 text-xl font-bold text-onboarding-ink dark:text-onboarding-neutral-0">
          Running your audience analysis
        </h2>
        <p className="mt-3 max-w-md text-sm leading-6 text-onboarding-neutral-600 dark:text-onboarding-neutral-400">
          {progressMessage}
        </p>
        <div className="mt-6 h-1.5 w-full max-w-sm overflow-hidden rounded-full bg-onboarding-neutral-100 dark:bg-onboarding-neutral-800">
          <span className="onboarding-analysis-progress block h-full w-2/5 rounded-full bg-gradient-to-r from-brand-purple to-violet-400" />
        </div>
      </div>
    </OnboardingCard>
  );
}

function friendlyAudienceError(message: string): string {
  if (/timed out|timeout/i.test(message)) {
    return "The audience provider did not finish in time. Retry and you can safely leave this page while it runs.";
  }
  return message.replace(/^Apify:\s*/i, "");
}

export function StrategyError({
  message,
  onRetry,
  inProgress = false,
}: {
  message: string;
  onRetry: () => void;
  inProgress?: boolean;
}) {
  return (
    <OnboardingCard className="mx-auto mt-8 w-full max-w-3xl px-6 py-8 text-center sm:px-8" role="alert">
      {inProgress ? (
        <Loader2 className="mx-auto size-9 text-brand-purple" aria-hidden />
      ) : (
        <Info className="mx-auto size-9 text-red-500" aria-hidden />
      )}
      <h2 className="mt-4 text-xl font-bold text-onboarding-ink dark:text-onboarding-neutral-0">
        {inProgress ? "Audience analysis in progress" : "Audience analysis failed"}
      </h2>
      <p className="mt-3 text-sm leading-6 text-onboarding-neutral-600 dark:text-onboarding-neutral-400">
        {friendlyAudienceError(message)}
      </p>
      <Button
        type="button"
        variant="brand"
        onClick={onRetry}
        className="mt-6"
      >
        <RefreshCw className="size-4" aria-hidden />
        {inProgress ? "Check again" : "Retry analysis"}
      </Button>
    </OnboardingCard>
  );
}
