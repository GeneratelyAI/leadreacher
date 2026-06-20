import { describe, expect, it } from "vitest";
import { isConnectedProfile } from "../relation-status.js";

describe("isConnectedProfile", () => {
  it("is true for a first-degree connection", () => {
    expect(
      isConnectedProfile({ network_distance: "FIRST_DEGREE", is_relationship: false }),
    ).toBe(true);
  });

  it("is true when is_relationship is set", () => {
    expect(
      isConnectedProfile({ network_distance: "SECOND_DEGREE", is_relationship: true }),
    ).toBe(true);
  });

  it("is false for a not-yet-connected profile", () => {
    expect(
      isConnectedProfile({ network_distance: "SECOND_DEGREE", is_relationship: false }),
    ).toBe(false);
    expect(isConnectedProfile({})).toBe(false);
  });
});
