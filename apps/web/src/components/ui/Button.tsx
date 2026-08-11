import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Canonical Button - use this for all product UI (dashboard, onboarding, auth).
 *
 * @example
 * <Button variant="primary" size="md" leftIcon={<Plus />}>New Campaign</Button>
 * <Button variant="outline" size="sm" leftIcon={<BarChart3 />}>Analytics</Button>
 * <Button variant="danger" size="sm" onClick={onArchive}>Archive</Button>
 * <Button variant="primary" isLoading={isSaving}>Save</Button>
 *
 * Architecture notes:
 * - Variants/sizes are centralized via CVA so pages never invent one-off button styles.
 * - `brand` / `default` remain as aliases of `primary` for backward compatibility.
 * - `glass-*` variants stay for marketing/landing only - prefer `primary` in app chrome.
 */
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all duration-fast ease-brand outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        primary:
          "bg-brand-500 text-white shadow-onboarding-button hover:bg-brand-600 hover:shadow-onboarding-button-strong",
        /** @deprecated Prefer `primary` - kept for existing call sites */
        brand:
          "bg-brand-500 text-white shadow-onboarding-button hover:bg-brand-600 hover:shadow-onboarding-button-strong",
        /** @deprecated Prefer `primary` */
        default:
          "bg-brand-500 text-white shadow-onboarding-button hover:bg-brand-600 hover:shadow-onboarding-button-strong",
        secondary:
          "bg-onboarding-neutral-100 text-onboarding-ink shadow-onboarding-small hover:bg-onboarding-neutral-150 aria-expanded:bg-onboarding-neutral-150 aria-expanded:text-onboarding-ink dark:bg-onboarding-neutral-800 dark:text-onboarding-neutral-0 dark:hover:bg-onboarding-neutral-750",
        outline:
          "border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-app-border-strong dark:bg-transparent dark:text-app-fg-muted dark:hover:border-app-border-strong dark:hover:bg-app-hover dark:hover:text-app-fg",
        ghost:
          "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        danger:
          "bg-onboarding-error-500 text-white shadow-onboarding-button hover:bg-[#dc2626] focus-visible:border-onboarding-error-500 focus-visible:ring-onboarding-error-500/30",
        "glass-accent":
          "rounded-full liquid-glass-button liquid-glass-button--accent font-medium transition-transform hover:scale-[1.02] active:translate-y-0",
        "glass-outline":
          "rounded-full liquid-glass-button liquid-glass-button--outline font-medium transition-transform hover:scale-[1.02] active:translate-y-0",
      },
      size: {
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        md: "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        /** @deprecated Prefer `md` */
        default: "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        lg: "h-10 gap-2 rounded-lg px-4 text-sm has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3 [&_svg:not([class*='size-'])]:size-4",
        icon: "size-8",
        "glass-sm": "h-auto gap-1.5 px-5 py-2 text-sm",
        "glass-md": "h-auto gap-2 px-7 py-3.5 text-sm sm:px-8 sm:text-base",
        "glass-lg": "h-auto gap-2 px-8 py-3.5 text-[0.95rem] sm:px-10 sm:py-4 sm:text-base",
        "glass-nav": "h-auto gap-1.5 px-5 py-2.5 text-sm font-semibold",
        "glass-waitlist":
          "h-auto shrink-0 gap-2 rounded-full px-6 py-3 text-sm font-semibold sm:px-10 sm:py-3.5 sm:text-base",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    /** Shows a spinner and disables interaction while true */
    isLoading?: boolean;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
  };

function Button({
  className,
  variant = "primary",
  size = "md",
  asChild = false,
  isLoading = false,
  leftIcon,
  rightIcon,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  const isDisabled = Boolean(disabled || isLoading);

  // asChild cannot inject loading/icons without breaking the single-child Slot contract
  if (asChild) {
    return (
      <Comp
        data-slot="button"
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      >
        {children}
      </Comp>
    );
  }

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      disabled={isDisabled}
      aria-busy={isLoading || undefined}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="size-4 animate-spin" aria-hidden />
      ) : leftIcon ? (
        <span className="inline-flex shrink-0" data-icon="inline-start" aria-hidden>
          {leftIcon}
        </span>
      ) : null}
      {children}
      {!isLoading && rightIcon ? (
        <span className="inline-flex shrink-0" data-icon="inline-end" aria-hidden>
          {rightIcon}
        </span>
      ) : null}
    </Comp>
  );
}

export { Button, buttonVariants };
export type { ButtonProps };
