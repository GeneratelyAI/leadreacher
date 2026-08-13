import { describe, expect, it } from "vitest";
import { createContentSecurityPolicy, SECURITY_RESPONSE_HEADERS } from "@/lib/security/headers";

describe("security headers", () => {
  it("uses a nonce and excludes unsafe inline scripts in production", () => {
    const policy = createContentSecurityPolicy("test-nonce", false);
    expect(policy).toContain("'nonce-test-nonce'");
    expect(policy).not.toContain("script-src 'self' 'unsafe-inline'");
    expect(policy).toContain("frame-ancestors 'none'");
  });

  it("includes baseline browser protections", () => {
    expect(SECURITY_RESPONSE_HEADERS).toEqual(expect.arrayContaining([
      ["X-Content-Type-Options", "nosniff"],
      ["X-Frame-Options", "DENY"],
    ]));
  });
});
