"use client";

import { X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { Button, type ButtonProps } from "@/components/ui/Button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const DURATION_MS = 500;

const actionButtonClassName =
  "h-10 gap-1.5 px-3 font-medium text-app-fg-muted hover:bg-app-hover hover:text-app-fg sm:h-8 sm:px-2.5";

/**
 * Shared bottom selection toolbar for multi-select screens (Campaigns, Prospects, …).
 * Chrome + enter/exit motion are fixed; pass screen-specific actions as `children` / `trailing`.
 *
 * @example
 * <SelectionToolbar
 *   count={selected.size}
 *   entityName="Campaign"
 *   ariaLabel="Selected campaign actions"
 *   onClear={() => setSelected(new Set())}
 *   trailing={<Button size="sm" variant="primary">Archive</Button>}
 * >
 *   <SelectionToolbarAction leftIcon={<Pause />} onClick={onPause}>Pause</SelectionToolbarAction>
 * </SelectionToolbar>
 */
export function SelectionToolbar({
  count,
  entityName,
  ariaLabel,
  onClear,
  children,
  trailing,
  className,
}: {
  count: number;
  /** Singular noun used in the clear chip, e.g. "Campaign" → "2 Campaigns selected" */
  entityName: string;
  ariaLabel: string;
  onClear: () => void;
  children?: ReactNode;
  /** Optional primary CTA pinned to the end (e.g. Enroll) */
  trailing?: ReactNode;
  className?: string;
}) {
  const open = count > 0;
  const [mounted, setMounted] = useState(false);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }

    setEntered(false);
    const timeout = window.setTimeout(() => setMounted(false), DURATION_MS);
    return () => window.clearTimeout(timeout);
  }, [open]);

  useEffect(() => {
    if (!mounted || !open) return;

    let innerId = 0;
    const outerId = window.requestAnimationFrame(() => {
      innerId = window.requestAnimationFrame(() => setEntered(true));
    });

    return () => {
      window.cancelAnimationFrame(outerId);
      window.cancelAnimationFrame(innerId);
    };
  }, [mounted, open]);

  if (!mounted) return null;

  const plural = count === 1 ? entityName : `${entityName}s`;

  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-x-0 bottom-[var(--dashboard-bottom-nav-height,0px)] z-40 px-3 pb-[max(0.75rem,var(--safe-area-bottom))] will-change-transform motion-reduce:!transition-none sm:px-4 lg:bottom-0 lg:left-[var(--dashboard-sidebar-width)] lg:pb-6",
        className,
      )}
      style={{
        transform: entered ? "translateY(0)" : "translateY(100%)",
        transition: `transform ${DURATION_MS}ms var(--onboarding-ease-standard, var(--ease-standard))`,
      }}
      aria-hidden={!entered}
    >
      <div className="mx-auto flex w-full max-w-4xl justify-center">
        <div
          role="toolbar"
          aria-label={ariaLabel}
          className={cn(
            "flex w-full items-center gap-1 rounded-xl border border-app-border-strong bg-app-float px-2 py-2 text-app-fg shadow-[var(--app-shadow-float)] ring-1 ring-black/5 dark:border-white/18 dark:ring-white/5 sm:gap-1.5 sm:px-2.5 sm:py-2",
            entered ? "pointer-events-auto" : "pointer-events-none",
          )}
        >
          <button
            type="button"
            onClick={onClear}
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg border border-app-border bg-app-muted-surface px-2.5 text-sm font-medium text-app-fg transition-colors hover:bg-app-hover focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-onboarding-purple-300 dark:border-white/15 dark:bg-white/5 dark:focus-visible:ring-white/20 sm:h-8"
            aria-label={`Clear selected ${plural.toLowerCase()}`}
          >
            <span className="whitespace-nowrap">
              {count} {plural} selected
            </span>
            <X className="size-3.5 text-app-fg-subtle" aria-hidden />
          </button>

          <Separator orientation="vertical" className="mx-1 hidden h-5 bg-app-border sm:block dark:bg-white/15" />

          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-0.5 sm:flex-nowrap sm:justify-start">
            {children}
          </div>

          {trailing ? <div className="ml-auto flex shrink-0 items-center gap-1.5">{trailing}</div> : null}
        </div>
      </div>
    </div>
  );
}

/** Ghost action button styled for use inside SelectionToolbar */
export function SelectionToolbarAction({ className, ...props }: ButtonProps) {
  return (
    <Button size="sm" variant="ghost" className={cn(actionButtonClassName, className)} {...props} />
  );
}
