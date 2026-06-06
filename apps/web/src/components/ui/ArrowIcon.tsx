import { cn } from "@/lib/utils";

type ArrowIconProps = {
  className?: string;
};

export function ArrowIcon({ className }: ArrowIconProps) {
  return (
    <span className={cn("inline-block translate-y-px text-lg", className)} aria-hidden>
      →
    </span>
  );
}
