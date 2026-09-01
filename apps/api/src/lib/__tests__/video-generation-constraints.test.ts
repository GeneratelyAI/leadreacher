import { describe, expect, it } from "vitest";
import {
  SILENT_VISUAL_VIDEO_CONSTRAINT,
  withSilentVisualConstraint,
} from "../video-generation-constraints.js";

describe("silent visual video constraints", () => {
  it("adds the same provider-independent restrictions to a video prompt", () => {
    const prompt = withSilentVisualConstraint("Show a professional spokesperson.");

    expect(prompt).toContain(SILENT_VISUAL_VIDEO_CONSTRAINT);
    expect(prompt).toContain("Do not add speech");
    expect(prompt).toContain("text, numbers, or metrics");
  });
});
