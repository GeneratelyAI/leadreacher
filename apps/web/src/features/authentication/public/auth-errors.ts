type AuthErrorLike = {
  message?: string;
  status?: number;
  code?: string;
};

export function authErrorMessage(error: unknown, flow: "sign-in" | "sign-up" | "recovery" | "password-update"): string {
  const candidate = error as AuthErrorLike | null;
  const message = candidate?.message ?? "";

  if (candidate?.status === 429 || /rate limit|too many requests/i.test(message)) {
    return "Too many attempts. Wait a few minutes before trying again.";
  }

  if (/captcha|security verification|turnstile/i.test(message)) {
    return "Complete the security verification and try again.";
  }

  if (/weak password|password.*(leaked|compromised|breach)/i.test(message)) {
    return "Choose a stronger password that has not appeared in a known breach.";
  }

  if (flow === "sign-in") {
    return "Invalid email or password.";
  }

  if (flow === "sign-up") {
    return "We could not create that account. Review your details and try again.";
  }

  if (flow === "recovery") {
    return "We could not send a recovery link. Wait a few minutes and try again.";
  }

  return "We could not update your password. Try again or request a new recovery link.";
}
