import { describe, expect, it } from "vitest";
import {
  buildPersonalizedVideoSeedPrompt,
  buildStandardVideoSeedPrompt,
} from "../video-prompt-brief.js";

const input = {
  campaignName: "Generately outreach",
  strategy: {
    positioning: {
      businessModel: "AI-powered social and web solutions for growing businesses",
      valueProposition: "Help teams create and manage more effective digital experiences",
    },
    icpDefinition: {
      idealCustomer: "B2B marketing teams that need consistent content and web growth",
    },
    contentApproach: {
      creativeBrief: "Use a calm office setting and show the shift from fragmented work to a clear workflow.",
      narrationScript: "Every team deserves a clearer way to turn digital work into growth.",
      transitionDirection: "Pan from the spokesperson into a clean workspace, then resolve into the logo.",
    },
    creativeAssets: {
      logoUrl: "https://example.com/logo.svg",
    },
    videoConfig: {
      tone: "professional",
    },
  },
  product: "AI-powered social and web solutions for growing businesses",
  audience: "B2B marketing teams that need consistent content and web growth",
  tone: "professional",
  avatar: "a confident professional spokesperson",
  setting: "a bright modern office",
  hasLogoReference: true,
};

describe("video prompt seed briefs", () => {
  it("gives personalized AI the silent greeting, pitch, transition, and logo structure", () => {
    const prompt = buildPersonalizedVideoSeedPrompt(input);

    expect(prompt).toContain("0-1.5s");
    expect(prompt).toContain('Hey {firstName},');
    expect(prompt).toContain("1.5-8s");
    expect(prompt).toContain("6.5-8.5s");
    expect(prompt).toContain("8.5-10s");
    expect(prompt).toContain(input.strategy.contentApproach.narrationScript);
    expect(prompt).toContain(input.strategy.contentApproach.transitionDirection);
    expect(prompt).toContain(input.strategy.creativeAssets.logoUrl);
    expect(prompt).toContain("Add no generated speech, dialogue, narration, music, captions");
    expect(prompt).toContain("personalized spokesperson advertisement");
    expect(prompt).toContain("Maintain the logo's exact visual integrity");
    expect(prompt).toContain("Generate exactly ten seconds");
  });

  it("gives standard video a non-personalized strategy and timing brief", () => {
    const prompt = buildStandardVideoSeedPrompt(input);

    expect(prompt).toContain("standardized ten-second AI campaign video");
    expect(prompt).toContain("Do not personalize this video");
    expect(prompt).toContain("0-2s");
    expect(prompt).toContain("2-4s");
    expect(prompt).toContain("4-6s");
    expect(prompt).toContain("8-10s");
    expect(prompt).toContain(input.strategy.contentApproach.narrationScript);
    expect(prompt).toContain(input.strategy.contentApproach.transitionDirection);
    expect(prompt).toContain(input.strategy.creativeAssets.logoUrl);
    expect(prompt).not.toContain("lead-specific TTS greeting");
  });

  it("does not invent a logo instruction when the strategy has no logo reference", () => {
    const prompt = buildStandardVideoSeedPrompt({
      ...input,
      strategy: { ...input.strategy, creativeAssets: {} },
      hasLogoReference: false,
    });

    expect(prompt).toContain("No logo reference is available");
    expect(prompt).not.toContain("example.com/logo.svg");
  });
});
