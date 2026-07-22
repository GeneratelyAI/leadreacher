import { describe, expect, it } from "vitest";
import { postLoginRedirectPath } from "../auth/post-login-redirect";

describe("postLoginRedirectPath", () => {
  it("sends completed organizations to the workspace", () => {
    expect(postLoginRedirectPath("2026-07-20T12:00:00.000Z")).toBe("/dashboard");
  });

  it("keeps incomplete organizations in onboarding", () => {
    expect(postLoginRedirectPath(null)).toBe("/onboarding");
    expect(postLoginRedirectPath(undefined)).toBe("/onboarding");
  });
});
