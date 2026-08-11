import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

type ActionBarProps = ComponentProps<"footer"> & {
  leading?: ReactNode;
  trailing?: ReactNode;
};

export function ActionBar({ className, leading, trailing, ...props }: ActionBarProps) {
  return (
    <footer
      className={cn(
        "onboarding-actions pointer-events-none fixed inset-x-0 z-40 flex items-center",
        leading ? "justify-between" : "justify-end",
        className,
      )}
      {...props}
    >
      {leading ? (
        <div className="onboarding-actions__item pointer-events-auto" data-slot="action-bar-item">
          {leading}
        </div>
      ) : null}
      {trailing ? (
        <div className="onboarding-actions__item pointer-events-auto" data-slot="action-bar-item">
          {trailing}
        </div>
      ) : null}
    </footer>
  );
}

export type { ActionBarProps };
