import type { useAuthForm } from "@/hooks/useAuthForm";

/** The shared form view accepts either real authentication or an isolated preview. */
export type AuthCampaignFormState = Pick<
  ReturnType<typeof useAuthForm>,
  | "email"
  | "setEmail"
  | "password"
  | "setPassword"
  | "showPassword"
  | "setShowPassword"
  | "error"
  | "loading"
  | "setCaptchaToken"
  | "captchaResetKey"
  | "handleEmailSubmit"
  | "handleOAuth"
>;
