import type { ComponentProps } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

type ChoiceCardProps = Omit<ComponentProps<"button">, "type"> & {
  selected?: boolean;
};

export function ChoiceCard({ className, selected = false, children, ...props }: ChoiceCardProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        "app-card app-card--interactive relative flex overflow-hidden text-left focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-onboarding-purple-300",
        selected && "app-card--selected",
        className,
      )}
      {...props}
    >
      {children}
      {selected ? (
        <span className="onboarding-selection-mark" aria-hidden>
          <Check className="size-3 stroke-[3]" />
        </span>
      ) : null}
    </button>
  );
}

export type { ChoiceCardProps };
