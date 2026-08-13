import type { ComponentProps, ReactNode } from "react";
import { OnboardingCard } from "@/components/onboarding/OnboardingCard";
import { cn } from "@/lib/utils";

type ReviewProps = Omit<ComponentProps<"section">, "title"> & {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  muted?: boolean;
};

export function Review({
  className,
  title,
  description,
  icon,
  action,
  muted = false,
  children,
  ...props
}: ReviewProps) {
  return (
    <OnboardingCard muted={muted} className={cn("px-5 py-5 sm:px-6", className)}>
      <section {...props}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            {icon ? <span className="mt-0.5 inline-flex shrink-0 text-onboarding-purple-600 dark:text-onboarding-purple-200">{icon}</span> : null}
            <div>
              <h2 className="text-base font-semibold text-onboarding-ink dark:text-onboarding-neutral-0">{title}</h2>
              {description ? <p className="mt-1 text-sm text-onboarding-neutral-600 dark:text-onboarding-neutral-400">{description}</p> : null}
            </div>
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
        {children ? <div className="mt-5">{children}</div> : null}
      </section>
    </OnboardingCard>
  );
}

export type { ReviewProps };
