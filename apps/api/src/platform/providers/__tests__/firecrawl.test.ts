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

import { scrapeWebsiteAudienceContext, scrapeWebsiteContent } from "../firecrawl.js";

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

describe("scrapeWebsiteAudienceContext", () => {
  it("collects at most five useful same-origin pages", async () => {
    const fetchMock = vi.fn(async (_input: unknown, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as { url: string };
      if (String(_input).endsWith("/map")) {
        return new Response(JSON.stringify({ links: [
          "https://audience.example/careers",
          "https://other.example/business",
          "https://audience.example/products",
          "https://audience.example/business",
          "https://audience.example/pricing",
          "https://audience.example/about",
          "https://audience.example/customers",
          "https://audience.example/privacy",
        ] }), { status: 200 });
      }
      return new Response(JSON.stringify({ data: { markdown: `Content for ${body.url}` } }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await scrapeWebsiteAudienceContext("https://audience.example");
    expect(result.sourceUrls).toHaveLength(5);
    expect(result.sourceUrls).toContain("https://audience.example");
    expect(result.sourceUrls).toContain("https://audience.example/business");
    expect(result.markdown).not.toContain("other.example");
    expect(result.markdown).not.toContain("/careers");
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });
});
