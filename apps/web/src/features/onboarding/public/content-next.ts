import { navigateOnboarding, onboardingHref } from "./navigation";

export function continueAfterContent() {
  navigateOnboarding(onboardingHref("cta"));
}
