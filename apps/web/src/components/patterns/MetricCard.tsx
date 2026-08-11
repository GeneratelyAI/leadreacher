import type { LucideIcon } from "lucide-react";
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
  icon: LucideIcon;
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
    <Card className={cn("min-w-0", className)}>
      <CardContent className="flex items-center gap-3.5 p-5 sm:gap-4">
        <Icon className={cn("size-5 shrink-0 sm:size-6", toneIconClass[tone])} strokeWidth={1.75} aria-hidden />
        <div className="min-w-0">
          <p className="text-3xl font-semibold tracking-tight">{displayValue}</p>
          <p className="mt-1 text-base text-app-fg-muted">{label}</p>
          {detail != null && detail !== "" ? (
            <p className={cn("mt-1 text-sm text-app-fg-subtle", detailClassName)}>{detail}</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
