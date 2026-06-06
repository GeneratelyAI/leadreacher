import Image from "next/image";
import { cn } from "@/lib/utils";

export type AvatarProps = {
  src?: string | null;
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizeClasses = {
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-14 text-base",
} as const;

const imageSizes = {
  sm: 32,
  md: 40,
  lg: 56,
} as const;

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return "?";
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

export default function Avatar({
  src,
  name,
  size = "md",
  className,
}: AvatarProps) {
  const initials = getInitials(name);
  const dimension = imageSizes[size];

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-purple/10 font-semibold text-brand-purple",
        sizeClasses[size],
        className,
      )}
    >
      {src ? (
        <Image
          src={src}
          alt={name}
          width={dimension}
          height={dimension}
          className="size-full object-cover"
        />
      ) : (
        <span aria-hidden>{initials}</span>
      )}
    </span>
  );
}
