type Environment = Record<string, string | undefined>;

/** Server-side gate for the public demo journey. */
export function isDemoOnboardingEnabled(
  environment: Environment = process.env,
): boolean {
  return environment.DEMO_ONBOARDING_ENABLED === "true";
}
