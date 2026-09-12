import { describe, expect, it } from "vitest";
import { resolveAllowedOnboardingRoute, resolveOnboardingResumeRoute } from "../public/progress";

const completeStrategy = {
  campaignType: "personalized_outreach",
  videoConfig: { enabled: true, mode: "personalized", source: "generated", tone: "professional" },
  icpDefinition: { onboarding: { introductionSeen: true, prospectsApproved: true }, contentChoice: "personalized-video" },
  messagingAngles: { outreachMessage: "Hello", outreachMessageApprovedAt: "2026-09-11T00:00:00.000Z" },
  channels: { selected: ["linkedin"] },
};

describe("resolveOnboardingResumeRoute", () => {
  it("returns the earliest incomplete persisted route", () => {
    expect(resolveOnboardingResumeRoute({ strategy: null, subscriptionStatus: null })).toBe("how-leadreacher-works");
    expect(resolveOnboardingResumeRoute({ strategy: { ...completeStrategy, icpDefinition: { onboarding: { introductionSeen: false } } }, subscriptionStatus: null })).toBe("how-leadreacher-works");
    expect(resolveOnboardingResumeRoute({ strategy: { ...completeStrategy, icpDefinition: { onboarding: { introductionSeen: true, prospectsApproved: false } } }, subscriptionStatus: null })).toBe("discovery");
    expect(resolveOnboardingResumeRoute({ strategy: { ...completeStrategy, campaignType: null }, subscriptionStatus: null })).toBe("campaign-content");
    expect(resolveOnboardingResumeRoute({ strategy: { ...completeStrategy, videoConfig: null }, subscriptionStatus: null })).toBe("personalized-video");
    expect(resolveOnboardingResumeRoute({ strategy: { ...completeStrategy, messagingAngles: {} }, subscriptionStatus: null })).toBe("cta");
    expect(resolveOnboardingResumeRoute({ strategy: { ...completeStrategy, channels: {} }, subscriptionStatus: null })).toBe("channels");
    expect(resolveOnboardingResumeRoute({ strategy: completeStrategy, subscriptionStatus: "incomplete" })).toBe("checkout");
    expect(resolveOnboardingResumeRoute({ strategy: completeStrategy, subscriptionStatus: "active" })).toBe("connect-channels");
  });

  it("recognizes document approval without requiring a video config", () => {
    const strategy = { ...completeStrategy, campaignType: "uploaded_video", videoConfig: null, icpDefinition: { ...completeStrategy.icpDefinition, contentChoice: "document", approvedContent: { type: "Document" } } };
    expect(resolveOnboardingResumeRoute({ strategy, subscriptionStatus: null })).toBe("checkout");
  });
});

describe("resolveAllowedOnboardingRoute", () => {
  it("allows revisiting completed routes and blocks future routes", () => {
    expect(resolveAllowedOnboardingRoute("discovery", "checkout")).toBe("discovery");
    expect(resolveAllowedOnboardingRoute("connect-channels", "cta")).toBe("cta");
  });
});
