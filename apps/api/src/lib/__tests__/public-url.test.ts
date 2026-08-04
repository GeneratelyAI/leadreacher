import { describe, expect, it, vi } from "vitest";
import { resolvePublicUrl } from "../public-url.js";

const publicLookup = vi.fn(async () => [{ address: "93.184.216.34", family: 4 as const }]);

describe("resolvePublicUrl", () => {
  it("accepts an HTTP public hostname", async () => {
    const result = await resolvePublicUrl("https://example.com/path", publicLookup);
    expect(result.url.hostname).toBe("example.com");
    expect(result.addresses).toEqual([{ address: "93.184.216.34", family: 4 }]);
  });

  it.each([
    "file:///etc/passwd",
    "http://user:secret@example.com",
    "http://example.com:8080",
    "http://127.0.0.1",
    "http://169.254.169.254/latest/meta-data",
    "http://[::1]",
  ])("rejects unsafe destination %s", async (input) => {
    await expect(resolvePublicUrl(input, publicLookup)).rejects.toThrow();
  });

  it("rejects a hostname resolving to a private address", async () => {
    const privateLookup = vi.fn(async () => [{ address: "10.0.0.5", family: 4 as const }]);
    await expect(resolvePublicUrl("https://example.com", privateLookup)).rejects.toThrow(
      "public internet address",
    );
  });

  it("rejects a hostname when any returned address is private", async () => {
    const mixedLookup = vi.fn(async () => [
      { address: "93.184.216.34", family: 4 as const },
      { address: "192.168.1.2", family: 4 as const },
    ]);
    await expect(resolvePublicUrl("https://example.com", mixedLookup)).rejects.toThrow(
      "public internet address",
    );
  });
});
