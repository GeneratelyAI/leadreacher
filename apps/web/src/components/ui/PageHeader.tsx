import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

type PageHeaderProps = Omit<ComponentProps<"header">, "title"> & {
  eyebrow?: ReactNode;
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  align?: "left" | "center";
};

export function PageHeader({
  className,
  eyebrow,
  icon,
  title,
  description,
  action,
  align = "center",
  ...props
}: PageHeaderProps) {
  const alignment = align === "center" ? "items-center text-center" : "items-start text-left";

  return (
    <header className={cn("onboarding-page-header flex max-w-2xl flex-col", alignment, className)} {...props}>
      {icon ? <span className="inline-flex text-onboarding-purple-500 dark:text-onboarding-purple-200">{icon}</span> : null}
      {eyebrow ? <p className="mt-4 text-xs font-bold tracking-wide text-onboarding-purple-600 uppercase dark:text-onboarding-purple-200">{eyebrow}</p> : null}
      <h1 className={cn(icon || eyebrow ? "mt-4" : "", "text-3xl font-bold tracking-tight text-onboarding-ink sm:text-4xl dark:text-onboarding-neutral-0")}>
        {title}
      </h1>
      {description ? <p className="mt-4 max-w-xl text-base leading-7 text-onboarding-neutral-600 dark:text-onboarding-neutral-400">{description}</p> : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </header>
  );
}

export type { PageHeaderProps };
