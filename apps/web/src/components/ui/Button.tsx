import Spinner from "@/components/ui/Spinner";
import { cn } from "@/lib/utils";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
};

const variantClasses = {
  primary: "liquid-glass-button liquid-glass-button--accent",
  secondary: "liquid-glass-button liquid-glass-button--accent",
  outline: "liquid-glass-button liquid-glass-button--outline text-brand-purple",
  ghost:
    "liquid-glass-button border-transparent bg-transparent text-brand-purple shadow-none backdrop-blur-none hover:bg-white/10",
} as const;

const sizeClasses = {
  sm: "gap-1.5 px-4 py-2 text-sm",
  md: "gap-2 px-6 py-2.5 text-sm",
  lg: "gap-2 px-8 py-3 text-base",
} as const;

export default function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  className,
  children,
  type = "button",
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex items-center justify-center rounded-full font-semibold",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple focus-visible:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-60",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    >
      {loading ? <Spinner size={size === "lg" ? "md" : "sm"} /> : null}
      {children}
    </button>
  );
}
