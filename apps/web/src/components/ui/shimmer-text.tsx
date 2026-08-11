import type { CSSProperties, ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";

type ShimmerTextProps = ComponentPropsWithoutRef<"span"> & {
  duration?: number;
};

type ShimmerStyle = CSSProperties & { "--lr-shimmer-duration": string };

export default function ShimmerText({
  children,
  className,
  duration = 2.8,
  style,
  ...props
}: ShimmerTextProps) {
  return (
    <span
      className={cn("lr-shimmer-text inline-grid", className)}
      style={{
        "--lr-shimmer-duration": `${duration}s`,
        ...style,
      } as ShimmerStyle}
      {...props}
    >
      <span className="lr-shimmer-text__base">{children}</span>
      <span aria-hidden className="lr-shimmer-text__shine">{children}</span>
    </span>
  );
}
