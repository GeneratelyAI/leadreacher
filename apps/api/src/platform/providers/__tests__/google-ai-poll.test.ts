import { describe, expect, it } from "vitest";
import { isTransientVeoPollError } from "../google-ai.js";

describe("Veo poll error classification", () => {
  it.each([
    [{ status: 429, message: "rate limited" }],
    [{ status: 503, message: "service unavailable" }],
    [new Error("Veo operation timed out after 30000ms")],
    [new Error("fetch failed")],
  ])("keeps transient polling errors pending", (error) => {
    expect(isTransientVeoPollError(error)).toBe(true);
  });

  it("treats a terminal client error as failed", () => {
    expect(isTransientVeoPollError({ status: 400, message: "invalid request" })).toBe(
      false,
    );
  });
});
