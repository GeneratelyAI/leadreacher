import { describe, expect, it } from "vitest";
import { isLightCampaignRoute } from "../theme-init-script";

describe("light campaign route detection", () => {
  it.each([
    "/signup",
    "/login",
    "/onboarding",
    "/onboarding/",
    "/onboarding-preview",
    "/demo/onboarding",
  ])("keeps %s on the light campaign surface", (pathname) => {
    expect(isLightCampaignRoute(pathname)).toBe(true);
  });

  it.each(["/", "/pricing", "/dashboard", "/feedback-preview"])(
    "preserves theme selection on %s",
    (pathname) => {
      expect(isLightCampaignRoute(pathname)).toBe(false);
    },
  );
});
