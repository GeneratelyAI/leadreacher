import Link from "next/link";
import { ArrowIcon } from "@/components/ui/ArrowIcon";
import { buttonVariants } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

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

const variantMap = {
  primary: "glass-accent",
  outline: "glass-outline",
} as const;

const sizeMap = {
  sm: "glass-sm",
  md: "glass-md",
  lg: "glass-lg",
} as const;

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
        buttonVariants({
          variant: variantMap[variant],
          size: sizeMap[size],
        }),
        "inline-flex items-center justify-center",
        className,
      )}
    >
      {children}
      {showArrow ? <ArrowIcon /> : null}
    </Link>
  );
}
