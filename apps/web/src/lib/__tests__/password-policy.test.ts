import { describe, expect, it } from "vitest";
import { passwordRequirements, validateNewPassword } from "@/lib/auth/password-policy";

describe("password policy", () => {
  it("accepts a password meeting every required category", () => {
    expect(validateNewPassword("A-longer-password1!")).toBeNull();
  });

  it("reports every missing requirement", () => {
    const requirements = passwordRequirements("short");
    expect(requirements.find((item) => item.id === "length")?.met).toBe(false);
    expect(requirements.find((item) => item.id === "uppercase")?.met).toBe(false);
    expect(requirements.find((item) => item.id === "number")?.met).toBe(false);
    expect(requirements.find((item) => item.id === "symbol")?.met).toBe(false);
    expect(validateNewPassword("short")).toContain("12 characters");
  });
});
