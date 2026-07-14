import { describe, expect, it } from "vitest";
import { classifyExistingStepZeroJobState } from "../campaign-step0-queue.js";

describe("step zero queue reconciliation", () => {
  it.each(["waiting", "active", "delayed", "prioritized", undefined])(
    "keeps %s jobs pending",
    (state) => {
      expect(classifyExistingStepZeroJobState(state)).toBe("pending");
    },
  );

  it("surfaces retained failed and completed jobs instead of blindly re-adding", () => {
    expect(classifyExistingStepZeroJobState("failed")).toBe("failed");
    expect(classifyExistingStepZeroJobState("completed")).toBe("completed");
  });
});
