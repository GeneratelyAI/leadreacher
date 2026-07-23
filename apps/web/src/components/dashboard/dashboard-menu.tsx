"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/** Shared popup panel look for dashboard Select and DropdownMenu. */
export const DASHBOARD_MENU_CONTENT_CLASS =
  "border border-onboarding-neutral-150 bg-onboarding-neutral-0 p-1 text-onboarding-ink shadow-onboarding-button dark:border-onboarding-neutral-750 dark:bg-onboarding-neutral-900 dark:text-onboarding-neutral-0";

/** Shared row look for dashboard menu / select items. */
export const DASHBOARD_MENU_ITEM_CLASS =
  "rounded-lg px-3 py-2 text-sm text-onboarding-ink focus:bg-onboarding-neutral-50 focus:text-onboarding-ink data-highlighted:bg-onboarding-neutral-50 data-highlighted:text-onboarding-ink dark:text-onboarding-neutral-0 dark:focus:bg-onboarding-neutral-800 dark:focus:text-onboarding-neutral-0 dark:data-highlighted:bg-onboarding-neutral-800 dark:data-highlighted:text-onboarding-neutral-0";

export function TruncatedWithTooltip({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [truncated, setTruncated] = useState(false);

  const measure = useCallback(() => {
    const node = ref.current;
    if (!node) return false;
    const isTruncated = node.scrollWidth > node.clientWidth + 1;
    setTruncated(isTruncated);
    return isTruncated;
  }, []);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [measure, text]);

  return (
    <Tooltip
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen && !measure()) {
          setOpen(false);
          return;
        }
        setOpen(nextOpen);
      }}
    >
      <TooltipTrigger
        render={
          <span
            ref={ref}
            className={cn("min-w-0 flex-1 truncate", className)}
            onMouseEnter={measure}
            onFocus={measure}
          />
        }
      >
        {text}
      </TooltipTrigger>
      {truncated ? (
        <TooltipContent side="top" sideOffset={6} className="z-[70] max-w-xs text-pretty">
          {text}
        </TooltipContent>
      ) : null}
    </Tooltip>
  );
}
