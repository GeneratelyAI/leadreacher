import { describe, expect, it } from "vitest";
import { resolveProviderId } from "../provider-id.js";

describe("resolveProviderId", () => {
  it("prefers the lead's stored provider id", () => {
    expect(resolveProviderId("LEAD_PROV", "PROFILE_PROV")).toBe("LEAD_PROV");
  });

  it("falls back to the profile provider id when the lead has none", () => {
    expect(resolveProviderId(null, "PROFILE_PROV")).toBe("PROFILE_PROV");
    expect(resolveProviderId(undefined, "PROFILE_PROV")).toBe("PROFILE_PROV");
  });

  it("treats an empty/whitespace lead id as missing and falls back", () => {
    expect(resolveProviderId("", "PROFILE_PROV")).toBe("PROFILE_PROV");
    expect(resolveProviderId("   ", "PROFILE_PROV")).toBe("PROFILE_PROV");
  });

  it("returns null when neither id is usable", () => {
    expect(resolveProviderId(null, null)).toBeNull();
    expect(resolveProviderId(undefined, undefined)).toBeNull();
    expect(resolveProviderId("", "")).toBeNull();
  });
});
