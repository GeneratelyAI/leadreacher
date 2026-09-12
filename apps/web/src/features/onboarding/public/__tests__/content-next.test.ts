import { afterEach, describe, expect, it, vi } from "vitest";
import { continueAfterContent } from "../content-next";
import { navigateOnboarding } from "../navigation";

vi.mock("../navigation", () => ({ navigateOnboarding: vi.fn(), onboardingHref: () => "/onboarding/cta" }));
afterEach(() => vi.clearAllMocks());

describe("creative approval continuation boundary", () => {
  it("always continues to the named CTA route", () => {
    continueAfterContent();
    expect(navigateOnboarding).toHaveBeenCalledExactlyOnceWith("/onboarding/cta");
  });
});
