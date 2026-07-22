export function postLoginRedirectPath(onboardedAt: string | Date | null | undefined): string {
  return onboardedAt ? "/dashboard" : "/onboarding";
}
