import { cn } from "@/lib/utils";
import { ASSETS } from "@/lib/constants/brand";

type LogoProps = {
  size?: "xs" | "sm" | "md" | "lg";
  variant?: "colored" | "white";
  className?: string;
  align?: "left" | "center" | "right";
  crossfade?: boolean;
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

const crossfadeTransition = "transition-opacity duration-slow ease-brand";

export function Logo({
  size = "md",
  variant = "colored",
  className,
  align = "center",
  crossfade = false,
}: LogoProps) {
  const imageClassName = cn(
    "w-auto object-contain",
    sizeClasses[size],
    alignClasses[align],
    className,
  );

  if (!crossfade) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={variant === "white" ? ASSETS.logoWhite : ASSETS.logoColored}
        width={538}
        height={45}
        alt="leadreacher"
        className={imageClassName}
      />
    );
  }

  const showColored = variant === "colored";

  return (
    <span className="relative inline-block shrink-0 leading-none">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={ASSETS.logoColored}
        width={538}
        height={45}
        alt={showColored ? "leadreacher" : ""}
        aria-hidden={!showColored}
        className={cn(
          imageClassName,
          crossfadeTransition,
          showColored ? "opacity-100" : "opacity-0",
        )}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={ASSETS.logoWhite}
        width={538}
        height={45}
        alt={showColored ? "" : "leadreacher"}
        aria-hidden={showColored}
        className={cn(
          imageClassName,
          "absolute top-0 left-0",
          crossfadeTransition,
          showColored ? "opacity-0" : "opacity-100",
        )}
      />
    </span>
  );
}
