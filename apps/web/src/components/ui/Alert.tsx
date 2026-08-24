import type { ComponentProps, ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info, TriangleAlert } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

type AlertTone = "error" | "success" | "warning" | "info";

const alertStyles: Record<AlertTone, string> = {
  error: "border-onboarding-error-500/20 bg-onboarding-error-50 text-onboarding-error-900 dark:bg-onboarding-error-900 dark:text-onboarding-error-50",
  success: "border-onboarding-success-500/30 bg-onboarding-success-50 text-onboarding-success-900 dark:bg-onboarding-success-900 dark:text-onboarding-success-50",
  warning: "border-onboarding-warning-500/25 bg-onboarding-warning-50 text-onboarding-warning-900 dark:bg-onboarding-warning-900 dark:text-onboarding-warning-150",
  info: "border-onboarding-purple-200 bg-onboarding-purple-50 text-onboarding-purple-700 dark:border-onboarding-purple-800 dark:bg-onboarding-purple-900/30 dark:text-onboarding-purple-100",
};

const alertIcons = {
  error: AlertCircle,
  success: CheckCircle2,
  warning: TriangleAlert,
  info: Info,
} as const;

type AlertProps = Omit<ComponentProps<"div">, "title"> & {
  tone?: AlertTone;
  title?: ReactNode;
  action?: ReactNode;
};

export function Alert({
  className,
  tone = "info",
  title,
  action,
  children,
  role,
  ...props
}: AlertProps) {
  const Icon = alertIcons[tone];

  return (
    <div
      role={role ?? (tone === "error" || tone === "warning" ? "alert" : "status")}
      className={cn(
        "flex flex-wrap items-start gap-3 rounded-[var(--ds-radius-md)] border px-4 py-3 text-sm",
        alertStyles[tone],
        className,
      )}
      {...props}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className={cn(title && "mt-1")}>{children}</div> : null}
      </div>
      {action ? <div className="ml-auto shrink-0">{action}</div> : null}
    </div>
  );
}

export type { AlertProps, AlertTone };
