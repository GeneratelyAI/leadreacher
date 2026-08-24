import type { AppIcon } from "@/components/ui/icons";
import type { ReactNode } from "react";

import { Card, CardContent } from "@/components/ui/Card";
import { cn } from "@/lib/utils";

export type MetricCardTone = "purple" | "green" | "gray" | "yellow" | "red" | "blue";

const toneIconClass: Record<MetricCardTone, string> = {
  purple: "text-onboarding-purple-600 dark:text-onboarding-purple-300",
  green: "text-onboarding-success-500 dark:text-onboarding-success-300",
  gray: "text-onboarding-neutral-500 dark:text-onboarding-neutral-400",
  yellow: "text-onboarding-warning-500 dark:text-onboarding-warning-500",
  red: "text-onboarding-error-500 dark:text-onboarding-error-300",
  blue: "text-blue-600 dark:text-blue-300",
};

const toneIconSurfaceClass: Record<MetricCardTone, string> = {
  purple: "bg-onboarding-purple-50 dark:bg-onboarding-purple-900/40",
  green: "bg-onboarding-success-50 dark:bg-onboarding-success-900/30",
  gray: "bg-onboarding-neutral-100 dark:bg-white/10",
  yellow: "bg-onboarding-warning-50 dark:bg-onboarding-warning-900/30",
  red: "bg-onboarding-error-50 dark:bg-onboarding-error-900/30",
  blue: "bg-blue-50 dark:bg-blue-950/50",
};

/**
 * Domain-agnostic KPI card - icon + value + label (+ optional detail).
 * Lives in `patterns/` so features reuse one layout without copying Card markup.
 *
 * @example
 * <MetricCard icon={Send} value={12} label="Total Campaigns" detail="All time" tone="purple" />
 */
export function MetricCard({
  icon: Icon,
  value,
  label,
  detail,
  tone = "purple",
  className,
  detailClassName,
}: {
  icon: AppIcon;
  value: ReactNode;
  label: string;
  detail?: ReactNode;
  tone?: MetricCardTone;
  className?: string;
  /** Override detail color (e.g. success for upward trends) */
  detailClassName?: string;
}) {
  const displayValue = typeof value === "number" ? value.toLocaleString() : value;

  return (
    <Card className={cn("min-w-0 overflow-hidden", className)}>
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <p className="min-w-0 text-sm font-medium text-app-fg-muted">{label}</p>
          <span className={cn("inline-flex size-8 shrink-0 items-center justify-center rounded-md", toneIconSurfaceClass[tone])}>
            <Icon className={cn("size-4", toneIconClass[tone])} strokeWidth={1.9} aria-hidden />
          </span>
        </div>
        <p className="mt-4 text-3xl font-semibold tracking-tight">{displayValue}</p>
        {detail != null && detail !== "" ? (
          <p className={cn("mt-3 border-t border-app-border pt-3 text-xs font-medium text-app-fg-subtle", detailClassName)}>{detail}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
