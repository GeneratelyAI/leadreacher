import { describe, expect, it } from "vitest";
import { authenticationAssuranceLevel } from "../auth-assurance.js";

function tokenWithClaims(claims: Record<string, unknown>): string {
  return `header.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.signature`;
}

describe("authenticationAssuranceLevel", () => {
  it("reads an aal2 claim after upstream token verification", () => {
    expect(authenticationAssuranceLevel(tokenWithClaims({ aal: "aal2" }))).toBe("aal2");
  });

  it("fails closed when the claim is missing or malformed", () => {
    expect(authenticationAssuranceLevel(tokenWithClaims({}))).toBe("aal1");
    expect(authenticationAssuranceLevel("invalid")).toBe("aal1");
  });
});
