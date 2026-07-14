import { describe, expect, it } from "vitest";
import { resolveOnboardingResumeTarget } from "../onboarding-progress";

const audienceComplete = {
  audienceAnalysisComplete: true,
  campaignType: "personalized_outreach",
  videoConfig: { enabled: false, mode: null, source: null },
};

describe("resolveOnboardingResumeTarget", () => {
  it("returns the first incomplete persisted onboarding step", () => {
    expect(
      resolveOnboardingResumeTarget({ strategy: null, subscriptionStatus: null }),
    ).toEqual({ step: "discovery" });
    expect(
      resolveOnboardingResumeTarget({
        strategy: { ...audienceComplete, audienceAnalysisComplete: false },
        subscriptionStatus: null,
      }),
    ).toEqual({ step: "strategy", strategySubstep: "how-it-works" });
    expect(
      resolveOnboardingResumeTarget({
        strategy: { ...audienceComplete, campaignType: null },
        subscriptionStatus: null,
      }),
    ).toEqual({ step: "campaign-type" });
    expect(
      resolveOnboardingResumeTarget({
        strategy: { ...audienceComplete, videoConfig: null },
        subscriptionStatus: null,
      }),
    ).toEqual({ step: "video-decision" });
    expect(
      resolveOnboardingResumeTarget({
        strategy: audienceComplete,
        subscriptionStatus: "incomplete",
      }),
    ).toEqual({ step: "checkout" });
  });

  it("returns to channels once an active subscription exists", () => {
    expect(
      resolveOnboardingResumeTarget({
        strategy: audienceComplete,
        subscriptionStatus: "active",
      }),
    ).toEqual({ step: "channels" });
  });
});
