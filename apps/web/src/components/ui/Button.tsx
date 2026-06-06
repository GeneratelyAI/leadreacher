import Spinner from "@/components/ui/Spinner";
import { cn } from "@/lib/utils";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
};

const variantClasses = {
  primary:
    "border-transparent bg-brand-purple text-white shadow-[0_8px_30px_-8px_rgba(83,38,183,0.55)] hover:bg-brand-purple-light active:bg-brand-purple-dark",
  secondary:
    "border-transparent bg-brand-purple-light text-white hover:bg-brand-purple active:bg-brand-purple-dark",
  outline:
    "border-2 border-brand-purple bg-transparent text-brand-purple hover:bg-brand-purple/8 active:bg-brand-purple/12",
  ghost:
    "border-transparent bg-transparent text-brand-purple hover:bg-brand-purple/8 active:bg-brand-purple/12",
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
        "inline-flex items-center justify-center rounded-full font-semibold transition-colors",
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
