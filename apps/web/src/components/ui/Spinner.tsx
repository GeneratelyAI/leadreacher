import { cn } from "@/lib/utils";

export type SpinnerProps = {
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizeClasses = {
  sm: "size-3.5 border-2",
  md: "size-5 border-2",
  lg: "size-7 border-[3px]",
} as const;

export default function Spinner({ size = "md", className }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn(
        "inline-block animate-spin rounded-full border-current border-r-transparent",
        sizeClasses[size],
        className,
      )}
    />
  );
}
