import { cn } from "@/lib/utils";
import { formatNumber } from "../state/analytics-format";

export function MiniBar({ value, max, tone }: { value: number; max: number; tone: "green" | "purple" }) {
  const width = max > 0 ? Math.max(8, Math.round((value / max) * 100)) : 0;
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="w-8 shrink-0 text-right text-sm font-medium">{formatNumber(value)}</span>
      <span className="h-2 min-w-16 flex-1 overflow-hidden rounded-full bg-onboarding-neutral-100 dark:bg-onboarding-neutral-800">
        <span
          className={cn(
            "block h-full rounded-full",
            tone === "green" ? "bg-onboarding-success-500" : "bg-onboarding-purple-500",
          )}
          style={{ width: `${width}%` }}
        />
      </span>
    </div>
  );
}
