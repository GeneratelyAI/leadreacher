import { Check, Circle } from "lucide-react";
import { passwordRequirements } from "@/lib/auth/password-policy";

export function PasswordRequirements({ password }: { password: string }) {
  if (!password) {
    return (
      <p className="mt-2 text-xs leading-5 text-muted-foreground">
        Use 12+ characters with uppercase, lowercase, a number, and a symbol.
      </p>
    );
  }

  return (
    <ul
      className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs leading-5 text-muted-foreground"
      aria-label="Password requirements"
      aria-live="polite"
    >
      {passwordRequirements(password).map((requirement) => (
        <li
          key={requirement.id}
          className={`flex items-center gap-1 whitespace-nowrap ${
            requirement.met ? "text-emerald-700 dark:text-emerald-300" : ""
          }`}
        >
          {requirement.met ? <Check className="size-3.5 shrink-0" aria-hidden /> : <Circle className="size-3.5 shrink-0" aria-hidden />}
          {requirement.label}
        </li>
      ))}
    </ul>
  );
}
