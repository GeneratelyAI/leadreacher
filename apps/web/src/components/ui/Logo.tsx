import { cn } from "@/lib/utils";
import { ASSETS } from "@/lib/constants/brand";

type LogoProps = {
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
  align?: "left" | "center" | "right";
};

const sizeClasses = {
  xs: "h-6 max-w-14",
  sm: "h-7 sm:h-8",
  md: "h-8 sm:h-9",
  lg: "h-10 sm:h-11",
} as const;

const alignClasses = {
  left: "object-left",
  center: "object-center",
  right: "object-right",
} as const;

export function Logo({ size = "md", className, align = "center" }: LogoProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={ASSETS.logoColored}
      alt="leadreacher"
      className={cn(
        "w-auto object-contain",
        sizeClasses[size],
        alignClasses[align],
        className,
      )}
    />
  );
}
