import { cn } from "@/lib/utils";

type ArrowIconProps = {
  className?: string;
};

export function ArrowIcon({ className }: ArrowIconProps) {
  return (
    <span className={cn("inline-block translate-y-px text-lg transition-transform duration-200 ease-out group-hover:translate-x-1", className)} aria-hidden>
      →
    </span>
  );
}
