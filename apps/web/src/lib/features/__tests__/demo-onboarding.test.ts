import { describe, expect, it } from "vitest";
import { isDemoOnboardingEnabled } from "../demo-onboarding";

describe("demo onboarding feature gate", () => {
  it("enables only for the exact true string", () => {
    expect(isDemoOnboardingEnabled({ DEMO_ONBOARDING_ENABLED: "true" })).toBe(true);
    expect(isDemoOnboardingEnabled({ DEMO_ONBOARDING_ENABLED: "TRUE" })).toBe(false);
    expect(isDemoOnboardingEnabled({ DEMO_ONBOARDING_ENABLED: "1" })).toBe(false);
    expect(isDemoOnboardingEnabled({ DEMO_ONBOARDING_ENABLED: "false" })).toBe(false);
    expect(isDemoOnboardingEnabled({})).toBe(false);
  });
});
