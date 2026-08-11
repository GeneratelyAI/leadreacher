import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

type EmptyStateProps = Omit<ComponentProps<"div">, "title"> & {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
};

export function EmptyState({
  className,
  icon,
  title,
  description,
  action,
  children,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn("flex min-h-48 flex-col items-center justify-center px-6 py-10 text-center", className)}
      {...props}
    >
      {icon ? <span className="mb-4 inline-flex text-onboarding-purple-500">{icon}</span> : null}
      <h2 className="text-base font-semibold text-app-fg">{title}</h2>
      {description ? <p className="mt-2 max-w-md text-sm leading-6 text-app-fg-muted">{description}</p> : null}
      {children}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export type { EmptyStateProps };
