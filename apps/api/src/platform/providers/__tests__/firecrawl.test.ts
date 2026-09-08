import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../config/env.js", () => ({
  env: { FIRECRAWL_API_KEY: "test-firecrawl-key" },
}));
vi.mock("../public-url.js", () => ({
  resolvePublicUrl: vi.fn().mockResolvedValue(new URL("https://mrsub.ca")),
}));
vi.mock("../website-text.js", () => ({
  fetchWebsitePreviewImage: vi.fn().mockResolvedValue(null),
}));

import { scrapeWebsiteContent } from "../firecrawl.js";

describe("scrapeWebsiteContent", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("retries a transient empty scrape before returning website content", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true, data: { markdown: "" } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: {
              markdown: "# Mr.Sub\nQuality sandwiches and franchise opportunities.",
              metadata: { ogImage: "https://mrsub.ca/share.jpg" },
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(scrapeWebsiteContent("https://mrsub-retry.example")).resolves.toEqual({
      markdown: "# Mr.Sub\nQuality sandwiches and franchise opportunities.",
      previewImageUrl: "https://mrsub.ca/share.jpg",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
