import { describe, expect, it } from "vitest";
import { analysisStepForElapsedTime, normalizeLandingWebsiteUrl } from "../landing-url-analyzer";

describe("landing URL analyzer", () => {
  it("normalizes a company domain", () => expect(normalizeLandingWebsiteUrl(" generately.ai ")).toBe("generately.ai"));
  it("rejects unsafe or incomplete values", () => {
    expect(normalizeLandingWebsiteUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeLandingWebsiteUrl("localhost")).toBeNull();
  });
  it("advances through all four progress stages", () => {
    expect([0, 700, 1_400, 2_300].map(analysisStepForElapsedTime)).toEqual([0, 1, 2, 3]);
  });
});
