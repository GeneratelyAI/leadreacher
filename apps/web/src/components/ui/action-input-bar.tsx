"use client";

import { ArrowRight, LoaderCircle } from "@/components/ui/icons";
import type { FormEvent, ReactNode } from "react";
import { cn } from "@/lib/utils";

type ActionInputBarProps = {
  id: string;
  value: string;
  onValueChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  placeholder: string;
  submitLabel: string;
  disabled?: boolean;
  loading?: boolean;
  errorMessage?: string | null;
  className?: string;
  leadingIcon?: ReactNode;
};

export function ActionInputBar({
  id,
  value,
  onValueChange,
  onSubmit,
  placeholder,
  submitLabel,
  disabled = false,
  loading = false,
  errorMessage,
  className,
  leadingIcon,
}: ActionInputBarProps) {
  return (
    <form onSubmit={onSubmit} className={cn("w-full", className)} noValidate>
      <div
        data-invalid={errorMessage ? "true" : undefined}
        className="action-input-bar flex min-h-20 items-center rounded-[22px] border border-transparent p-2 shadow-[0_18px_45px_rgba(66,42,148,0.10)] transition-[box-shadow] duration-300 focus-within:shadow-[0_18px_45px_rgba(66,42,148,0.16),0_0_0_3px_rgba(124,58,237,0.10)]"
      >
        <label htmlFor={id} className="sr-only">{placeholder}</label>
        {leadingIcon ? <span className="ml-4 flex size-5 shrink-0 items-center justify-center text-[#6c4be6] dark:text-onboarding-purple-200">{leadingIcon}</span> : null}
        <input
          id={id}
          type="text"
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          disabled={disabled}
          placeholder={placeholder}
          aria-invalid={Boolean(errorMessage)}
          className="h-14 min-w-0 flex-1 bg-transparent px-4 text-base font-medium text-[#171729] outline-none placeholder:text-[#8b91a3] disabled:opacity-70 sm:text-lg dark:text-onboarding-neutral-0 dark:placeholder:text-onboarding-neutral-400"
        />
        <button
          type="submit"
          disabled={disabled || !value.trim()}
          aria-label={submitLabel}
          className="mr-0.5 inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-[#6c42e8] text-white shadow-[0_8px_20px_rgba(89,47,214,.25)] transition-[transform,background-color,box-shadow] hover:bg-[#5d35d4] hover:shadow-[0_10px_24px_rgba(89,47,214,.32)] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#8b7fd4]/45 active:translate-y-px disabled:pointer-events-none disabled:opacity-50"
        >
          {loading ? <LoaderCircle className="size-5 animate-spin motion-reduce:animate-none" aria-hidden /> : <ArrowRight className="size-5" aria-hidden />}
        </button>
      </div>
      {errorMessage ? <p role="alert" className="mt-1.5 text-left text-[0.8125rem] text-onboarding-error-700 dark:text-onboarding-error-200">{errorMessage}</p> : null}
    </form>
  );
}
