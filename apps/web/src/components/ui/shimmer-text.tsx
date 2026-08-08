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
      className={cn("lr-shimmer-text inline-block bg-clip-text text-transparent", className)}
      style={{
        backgroundImage:
          "linear-gradient(110deg, #4e28df 8%, #4e28df 34%, #a68cff 45%, #ffffff 50%, #8c6cff 56%, #4e28df 68%, #4e28df 92%)",
        backgroundSize: "250% 100%",
        "--lr-shimmer-duration": `${duration}s`,
        ...style,
      } as ShimmerStyle}
      {...props}
    >
      {children}
    </span>
  );
}
