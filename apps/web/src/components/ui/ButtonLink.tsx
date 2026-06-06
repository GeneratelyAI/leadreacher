import Link from "next/link";
import { cn } from "@/lib/utils";
import { ArrowIcon } from "@/components/ui/ArrowIcon";

type ButtonVariant = "primary" | "outline";
type ButtonSize = "sm" | "md" | "lg";

type ButtonLinkProps = {
  href: string;
  children: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  showArrow?: boolean;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "border-transparent bg-brand-purple text-white shadow-[0_8px_30px_-8px_rgba(83,38,183,0.55)] hover:scale-[1.02] active:scale-[0.98] sm:shadow-[0_10px_36px_-10px_rgba(83,38,183,0.55)]",
  outline:
    "border-2 border-brand-purple bg-white text-brand-purple hover:bg-neutral-50",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-5 py-2 text-sm",
  md: "px-7 py-3.5 text-sm sm:px-8 sm:text-base",
  lg: "px-8 py-3.5 text-[0.95rem] sm:px-10 sm:py-4 sm:text-base",
};

export function ButtonLink({
  href,
  children,
  variant = "primary",
  size = "md",
  className,
  showArrow = false,
}: ButtonLinkProps) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-transform",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
    >
      {children}
      {showArrow ? <ArrowIcon /> : null}
    </Link>
  );
}
