import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

type StatusBadgeTone = "brand" | "success" | "neutral" | "warning" | "danger";

const toneStyles: Record<StatusBadgeTone, string> = {
  brand: "bg-onboarding-purple-50 text-onboarding-purple-700 dark:bg-onboarding-purple-900 dark:text-onboarding-purple-100",
  success: "bg-onboarding-success-50 text-onboarding-success-900 dark:bg-onboarding-success-900 dark:text-onboarding-success-50",
  neutral: "bg-onboarding-neutral-100 text-onboarding-neutral-600 dark:bg-onboarding-neutral-800 dark:text-onboarding-neutral-400",
  warning: "bg-onboarding-warning-50 text-onboarding-warning-900 dark:bg-onboarding-warning-900 dark:text-onboarding-warning-150",
  danger: "bg-onboarding-error-50 text-onboarding-error-900 dark:bg-onboarding-error-900 dark:text-onboarding-error-50",
};

type StatusBadgeProps = ComponentProps<"span"> & { tone?: StatusBadgeTone };

export function StatusBadge({ className, tone = "neutral", ...props }: StatusBadgeProps) {
  return <span className={cn("status-badge", toneStyles[tone], className)} {...props} />;
}

export type { StatusBadgeProps, StatusBadgeTone };
