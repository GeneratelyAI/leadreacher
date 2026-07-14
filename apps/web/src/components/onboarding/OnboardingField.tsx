import { useId, useState, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type OnboardingFieldProps = Omit<ComponentProps<"input">, "size"> & {
  label: string;
  error?: string | null;
  success?: string | null;
  leading?: ReactNode;
  trailing?: ReactNode;
  wrapperClassName?: string;
};

export function OnboardingField({
  className,
  defaultValue,
  error,
  id,
  label,
  leading,
  onBlur,
  onFocus,
  success,
  trailing,
  value,
  wrapperClassName,
  ...props
}: OnboardingFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const [isFocused, setIsFocused] = useState(false);
  const hasValue = String(value ?? defaultValue ?? "").length > 0;
  const helper = error ?? success;

  return (
    <div className={cn("onboarding-field", wrapperClassName)}>
      <div
        className={cn(
          "onboarding-field__control",
          isFocused && "onboarding-field__control--focused",
          error && "onboarding-field__control--error",
          success && "onboarding-field__control--success",
        )}
      >
        {leading ? <span className="onboarding-field__leading">{leading}</span> : null}
        <input
          {...props}
          id={fieldId}
          value={value}
          defaultValue={defaultValue}
          aria-invalid={Boolean(error)}
          aria-describedby={helper ? `${fieldId}-message` : undefined}
          className={cn("onboarding-field__input", className)}
          onFocus={(event) => {
            setIsFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setIsFocused(false);
            onBlur?.(event);
          }}
        />
        <label
          htmlFor={fieldId}
          className={cn(
            "onboarding-field__label",
            (isFocused || hasValue) && "onboarding-field__label--floating",
          )}
        >
          {label}
        </label>
        {trailing ? <span className="onboarding-field__trailing">{trailing}</span> : null}
      </div>
      {helper ? (
        <p
          id={`${fieldId}-message`}
          className={cn(
            "onboarding-field__message",
            error ? "onboarding-field__message--error" : "onboarding-field__message--success",
          )}
        >
          {helper}
        </p>
      ) : null}
    </div>
  );
}
