import { describe, expect, it } from "vitest";
import {
  PRODUCT_STORY_STAGE_IDS,
  progressForStageIndex,
  stageIndexForProgress,
} from "../product-story";

describe("product story progress", () => {
  it("keeps the required workflow order", () => {
    expect(PRODUCT_STORY_STAGE_IDS).toEqual([
      "website",
      "strategy",
      "prospects",
      "outreach",
      "conversations",
    ]);
  });

  it("maps each stage center back to that stage", () => {
    PRODUCT_STORY_STAGE_IDS.forEach((_, index) => {
      expect(stageIndexForProgress(progressForStageIndex(index))).toBe(index);
    });
  });

  it("clamps progress outside the story range", () => {
    expect(stageIndexForProgress(-1)).toBe(0);
    expect(stageIndexForProgress(2)).toBe(4);
  });
});
