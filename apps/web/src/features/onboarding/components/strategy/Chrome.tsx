"use client";

import { ArrowLeft, ArrowRight } from "@/components/ui/icons";
import { ActionBar } from "@/components/ui/ActionBar";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

export function ShellActions({
  canContinue,
  continueLabel = "Continue to next step",
  onBack,
  onContinue,
  className,
}: {
  canContinue: boolean;
  continueLabel?: string;
  onBack: () => void;
  onContinue: () => void;
  className?: string;
}) {
  return (
    <ActionBar
      className={className}
      leading={
        <Button type="button" variant="secondary" onClick={onBack} className="h-13 px-7 text-base">
          <ArrowLeft className="size-5" aria-hidden />
          Back
        </Button>
      }
      trailing={
        <Button
          type="button"
          variant="primary"
          disabled={!canContinue}
          onClick={onContinue}
          className="h-13 px-8 text-base sm:px-10"
        >
          {continueLabel}
          <ArrowRight className="size-5" aria-hidden />
        </Button>
      }
    />
  );
}

export function ScreenHeader({
  title,
  subtitle,
  compact = false,
}: {
  title: string;
  subtitle: string;
  compact?: boolean;
}) {
  return (
    <div className="onboarding-screen-header mx-auto flex max-w-2xl flex-col items-center text-center">
      <h1 className={cn(
        "font-bold tracking-tight text-onboarding-ink dark:text-onboarding-neutral-0",
        compact ? "text-3xl" : "text-3xl sm:text-4xl",
      )}>
        {title}
      </h1>
      <p className={cn(
        "max-w-lg text-onboarding-neutral-600 dark:text-onboarding-neutral-400",
        compact ? "mt-3 text-sm leading-6" : "mt-4 text-base leading-7",
      )}>
        {subtitle}
      </p>
    </div>
  );
}
