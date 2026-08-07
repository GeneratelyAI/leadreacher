import { describe, expect, it } from "vitest";
import { isExplicitOutreachOptOut } from "../outreach-suppression.js";

describe("isExplicitOutreachOptOut", () => {
  it.each(["STOP", "unsubscribe.", "Do not contact me", "remove me!"])(
    "recognizes an explicit opt-out: %s",
    (message) => expect(isExplicitOutreachOptOut(message)).toBe(true),
  );

  it("does not suppress an ordinary negative reply", () => {
    expect(isExplicitOutreachOptOut("Not interested right now")).toBe(false);
  });
});
