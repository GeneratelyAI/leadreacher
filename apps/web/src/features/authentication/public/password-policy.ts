export const MIN_PASSWORD_LENGTH = 12;

export type PasswordRequirement = {
  id: "length" | "lowercase" | "uppercase" | "number" | "symbol";
  label: string;
  met: boolean;
};

export function passwordRequirements(password: string): PasswordRequirement[] {
  return [
    {
      id: "length",
      label: `At least ${MIN_PASSWORD_LENGTH} characters`,
      met: password.length >= MIN_PASSWORD_LENGTH,
    },
    { id: "lowercase", label: "One lowercase letter", met: /[a-z]/.test(password) },
    { id: "uppercase", label: "One uppercase letter", met: /[A-Z]/.test(password) },
    { id: "number", label: "One number", met: /\d/.test(password) },
    {
      id: "symbol",
      label: "One symbol",
      met: /[^A-Za-z0-9\s]/.test(password),
    },
  ];
}

export function validateNewPassword(password: string): string | null {
  const missing = passwordRequirements(password).filter((requirement) => !requirement.met);
  return missing.length === 0
    ? null
    : "Use at least 12 characters, including uppercase, lowercase, a number, and a symbol.";
}
