import { describe, expect, it } from "vitest";
import { resolveWebhookUrl } from "./webhook-url.js";

describe("resolveWebhookUrl", () => {
  it("returns the explicit UNIPILE_WEBHOOK_URL when set", () => {
    expect(
      resolveWebhookUrl({ UNIPILE_WEBHOOK_URL: "https://x.ngrok.dev/webhooks/unipile" }),
    ).toBe("https://x.ngrok.dev/webhooks/unipile");
  });

  it("builds from PUBLIC_BASE_URL and trims a trailing slash", () => {
    expect(resolveWebhookUrl({ PUBLIC_BASE_URL: "https://x.ngrok.dev/" })).toBe(
      "https://x.ngrok.dev/webhooks/unipile",
    );
  });

  it("prefers the explicit URL over PUBLIC_BASE_URL", () => {
    expect(
      resolveWebhookUrl({
        UNIPILE_WEBHOOK_URL: "https://explicit.dev/webhooks/unipile",
        PUBLIC_BASE_URL: "https://base.dev",
      }),
    ).toBe("https://explicit.dev/webhooks/unipile");
  });

  it("throws when neither var is set", () => {
    expect(() => resolveWebhookUrl({})).toThrow(/UNIPILE_WEBHOOK_URL|PUBLIC_BASE_URL/);
  });
});
