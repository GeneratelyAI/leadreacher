import type { ComponentProps } from "react";
import { Card } from "@/components/ui/Card";

type OnboardingCardProps = ComponentProps<"div"> & {
  selected?: boolean;
  muted?: boolean;
};

export function OnboardingCard({
  className,
  selected = false,
  muted = false,
  ...props
}: OnboardingCardProps) {
  const variant = selected ? "selected" : muted ? "muted" : "default";

  return (
    <Card
      variant={variant}
      className={className}
      {...props}
    />
  );
}
