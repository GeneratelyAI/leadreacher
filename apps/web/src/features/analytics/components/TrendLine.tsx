import { ArrowUp, ArrowDown } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import type { Trend } from "../state/analytics-model";

export function TrendLine({ trend, ratePoints }: { trend?: Trend; ratePoints?: boolean }) {
  if (!trend) return null;
  const label =
    trend.direction === "new"
      ? "New vs last period"
      : trend.direction === "flat"
        ? "No change vs last period"
        : ratePoints
          ? `${trend.percent ?? 0}pp vs last period`
          : `${trend.percent ?? 0}% vs last period`;

  return (
    <p
      className={cn(
        "mt-2 flex items-center gap-1 text-xs font-medium",
        trend.direction === "up" || trend.direction === "new"
          ? "text-onboarding-success-500"
          : trend.direction === "down"
            ? "text-onboarding-error-500"
            : "text-onboarding-neutral-500 dark:text-onboarding-neutral-400",
      )}
    >
      {trend.direction === "up" ? <ArrowUp className="size-3" aria-hidden /> : null}
      {trend.direction === "down" ? <ArrowDown className="size-3" aria-hidden /> : null}
      {label}
    </p>
  );
}
