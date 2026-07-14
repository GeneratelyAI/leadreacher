import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all duration-fast ease-brand outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/80",
        brand:
          "bg-onboarding-purple-500 text-white shadow-onboarding-button hover:bg-onboarding-purple-600 hover:shadow-onboarding-button-strong",
        outline:
          "border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        secondary:
          "bg-onboarding-neutral-100 text-onboarding-ink shadow-onboarding-small hover:bg-onboarding-neutral-150 aria-expanded:bg-onboarding-neutral-150 aria-expanded:text-onboarding-ink dark:bg-onboarding-neutral-800 dark:text-onboarding-neutral-0 dark:hover:bg-onboarding-neutral-750",
        ghost:
          "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        "glass-accent":
          "rounded-full liquid-glass-button liquid-glass-button--accent font-medium transition-transform hover:scale-[1.02] active:translate-y-0",
        "glass-outline":
          "rounded-full liquid-glass-button liquid-glass-button--outline font-medium transition-transform hover:scale-[1.02] active:translate-y-0",
      },
      size: {
        default:
          "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        icon: "size-8",
        "glass-sm": "h-auto gap-1.5 px-5 py-2 text-sm",
        "glass-md":
          "h-auto gap-2 px-7 py-3.5 text-sm sm:px-8 sm:text-base",
        "glass-lg":
          "h-auto gap-2 px-8 py-3.5 text-[0.95rem] sm:px-10 sm:py-4 sm:text-base",
        "glass-nav": "h-auto gap-1.5 px-5 py-2.5 text-sm font-semibold",
        "glass-waitlist":
          "h-auto shrink-0 gap-2 rounded-full px-6 py-3 text-sm font-semibold sm:px-10 sm:py-3.5 sm:text-base",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
