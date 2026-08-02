import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function DashboardPageFrame({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-[100rem] px-[var(--dashboard-page-px,1rem)] py-[var(--dashboard-page-py,1.25rem)]",
        className,
      )}
    >
      {children}
    </div>
  );
}
