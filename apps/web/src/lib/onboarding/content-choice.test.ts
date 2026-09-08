import { describe, expect, it } from "vitest";
import { recoverContentChoice } from "./content-choice";

describe("saved campaign content choice", () => {
  it("distinguishes document uploads from legacy uploaded video", () => {
    expect(recoverContentChoice({ campaignType: "uploaded_video", icpDefinition: { contentChoice: "document" } })).toBe("document");
    expect(recoverContentChoice({ campaignType: "uploaded_video" })).toBe("your-video");
  });
  it("ignores unknown metadata and recovers a legacy campaign", () => {
    expect(recoverContentChoice({ campaignType: "ai_video_ad", icpDefinition: { contentChoice: "unknown" } })).toBe("ai-video");
    expect(recoverContentChoice({})).toBe("personalized-video");
  });
});
