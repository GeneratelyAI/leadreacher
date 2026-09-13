import { describe, expect, it } from "vitest";
import { contentWorkflowRoute, recoverContentChoice } from "../public/content-choice";

describe("saved campaign content choice", () => {
  it("distinguishes document uploads from legacy uploaded video", () => {
    expect(recoverContentChoice({ campaignType: "uploaded_video", icpDefinition: { contentChoice: "document" } })).toBe("document");
    expect(recoverContentChoice({ campaignType: "uploaded_video" })).toBe("your-video");
  });
  it("ignores unknown metadata and recovers a legacy campaign", () => {
    expect(recoverContentChoice({ campaignType: "ai_video_ad", icpDefinition: { contentChoice: "unknown" } })).toBe("ai-video");
    expect(recoverContentChoice({})).toBe("personalized-video");
  });

  it.each([
    ["personalized_video", "personalized-video", "personalized-video"],
    ["ai_video_ad", "ai-video", "ai-video"],
    ["uploaded_video", "your-video", "your-video"],
    ["uploaded_video", "document", "document"],
  ])("restores %s campaigns to their saved %s workflow", (campaignType, contentChoice, expected) => {
    expect(contentWorkflowRoute({ campaignType, icpDefinition: { contentChoice } })).toBe(expected);
  });

  it("falls back to the nearest valid legacy content workflow", () => {
    expect(contentWorkflowRoute({ campaignType: "uploaded_video", icpDefinition: { contentChoice: "retired-step" } })).toBe("your-video");
    expect(contentWorkflowRoute({ campaignType: "personalized_video", icpDefinition: { contentChoice: "retired-step" } })).toBe("personalized-video");
  });
});
