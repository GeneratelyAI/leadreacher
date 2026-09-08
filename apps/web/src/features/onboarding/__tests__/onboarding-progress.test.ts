import { describe, expect, it } from "vitest";
import {
  resolveAllowedOnboardingStep,
  resolveOnboardingResumeTarget,
} from "../public/progress";

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
        strategy: { ...audienceComplete, audienceAnalysisComplete: false, campaignType: null },
        subscriptionStatus: null,
      }),
    ).toEqual({ step: "strategy", strategySubstep: "how-it-works" });
    expect(
      resolveOnboardingResumeTarget({
        strategy: { ...audienceComplete, campaignType: null },
        subscriptionStatus: null,
      }),
    ).toEqual({ step: "campaign-content" });
    expect(
      resolveOnboardingResumeTarget({
        strategy: { ...audienceComplete, videoConfig: null },
        subscriptionStatus: null,
      }),
    ).toEqual({ step: "personalized-video-style" });
    expect(
      resolveOnboardingResumeTarget({
        strategy: { ...audienceComplete, campaignType: "ai_video_ad", videoConfig: null },
        subscriptionStatus: null,
      }),
    ).toEqual({ step: "ai-video-style" });
    expect(
      resolveOnboardingResumeTarget({
        strategy: { ...audienceComplete, campaignType: "uploaded_video", videoConfig: null },
        subscriptionStatus: null,
      }),
    ).toEqual({ step: "upload-video" });
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
  it("resumes audience review after the introduction and advances only after approval", () => {
    const strategy = { audienceAnalysisComplete: false, campaignType: null, videoConfig: null, introductionSeen: true, prospectsApproved: false };
    expect(resolveOnboardingResumeTarget({ strategy, subscriptionStatus: null })).toEqual({ step: "discovery" });
    expect(resolveOnboardingResumeTarget({ strategy: { ...strategy, prospectsApproved: true }, subscriptionStatus: null })).toEqual({ step: "campaign-content" });
  });
});

describe("resolveAllowedOnboardingStep", () => {
  it("allows revisiting completed steps", () => {
    expect(resolveAllowedOnboardingStep("strategy", "checkout")).toBe("strategy");
  });

  it("prevents direct URL jumps past persisted progress", () => {
    expect(resolveAllowedOnboardingStep("channels", "strategy")).toBe("strategy");
    expect(resolveAllowedOnboardingStep(null, "campaign-content")).toBe("campaign-content");
  });
});
