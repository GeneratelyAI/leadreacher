"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

export type InputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "id"
> & {
  label?: string;
  error?: string;
  helperText?: string;
  id?: string;
  fullWidth?: boolean;
};

export default function Input({
  label,
  error,
  helperText,
  id,
  fullWidth = true,
  className,
  disabled,
  ...props
}: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const helperId = helperText ? `${inputId}-helper` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const describedBy =
    [errorId, !error ? helperId : undefined].filter(Boolean).join(" ") ||
    undefined;

  return (
    <div className={cn("flex flex-col gap-1.5", fullWidth && "w-full")}>
      {label ? (
        <label
          htmlFor={inputId}
          className="text-sm font-medium text-neutral-800"
        >
          {label}
        </label>
      ) : null}
      <input
        id={inputId}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          "rounded-lg border bg-white px-4 py-2.5 text-sm text-neutral-900 outline-none transition-colors",
          "placeholder:text-neutral-400",
          "focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20",
          "disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-400",
          error
            ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
            : "border-neutral-200",
          fullWidth && "w-full",
          className,
        )}
        {...props}
      />
      {error ? (
        <p id={errorId} className="text-sm text-red-600">
          {error}
        </p>
      ) : helperText ? (
        <p id={helperId} className="text-sm text-neutral-500">
          {helperText}
        </p>
      ) : null}
    </div>
  );
}
