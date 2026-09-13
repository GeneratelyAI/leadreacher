import { describe, expect, it } from "vitest";
import { normalizeWebsiteUrl, persistedWebsiteUrl, resolveCampaignMedia, withDefaultWebsiteCta } from "../message-review-data";

describe("message review campaign data", () => {
  it("normalizes the persisted discovery website and preserves its path", () => {
    const strategy = { icpDefinition: { discovery: { websiteUrl: "acme.example/products/demo" } } };
    expect(persistedWebsiteUrl(strategy)).toBe("https://acme.example/products/demo");
  });

  it("rejects unsafe and invalid website destinations", () => {
    expect(normalizeWebsiteUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeWebsiteUrl("not a website")).toBeNull();
  });

  it("adds the website CTA only when no CTA was explicitly saved", () => {
    const empty = { message: "Hello", ctaLabel: null, ctaUrl: null };
    expect(withDefaultWebsiteCta(empty, "https://acme.example/")).toMatchObject({ ctaLabel: "Visit website", ctaUrl: "https://acme.example/" });
    expect(withDefaultWebsiteCta({ ...empty, ctaExplicitlySaved: true }, "https://acme.example/")).toMatchObject({ ctaLabel: null, ctaUrl: null });
    expect(withDefaultWebsiteCta({ ...empty, ctaLabel: "Book time", ctaUrl: "https://calendar.example" }, "https://acme.example/")).toMatchObject({ ctaLabel: "Book time" });
  });

  it("resolves an uploaded video from the persisted video configuration", () => {
    expect(resolveCampaignMedia({ videoConfig: { source: "uploaded", uploadedVideoUrl: "https://cdn.example/video.mp4" } })).toEqual({
      kind: "video",
      status: "ready",
      url: "https://cdn.example/video.mp4",
      previewUrl: undefined,
    });
  });

  it("resolves a persisted generated video and its thumbnail", () => {
    expect(resolveCampaignMedia({
      videoConfig: { source: "generated" },
      campaignMedia: { status: "ready", videoUrl: "https://cdn.example/generated.mp4", thumbnailUrl: "https://cdn.example/generated.webp" },
    })).toEqual({ kind: "video", status: "ready", url: "https://cdn.example/generated.mp4", previewUrl: "https://cdn.example/generated.webp" });
  });

  it("reports generated media as processing without fabricating an asset", () => {
    expect(resolveCampaignMedia({ videoConfig: { source: "generated" } })).toEqual({ kind: "video", status: "processing", url: undefined, previewUrl: undefined });
  });

  it("resolves a persisted document and reports a local-only document as unavailable", () => {
    expect(resolveCampaignMedia({ icpDefinition: { approvedContent: { type: "Document", documentName: "brief.pdf", documentUrl: "https://cdn.example/brief.pdf" } } })).toEqual({
      kind: "document", status: "ready", url: "https://cdn.example/brief.pdf", previewUrl: undefined, name: "brief.pdf",
    });
    expect(resolveCampaignMedia({ icpDefinition: { approvedContent: { type: "Document", documentName: "brief.pdf" } } })).toEqual({
      kind: "document", status: "unavailable", url: undefined, previewUrl: undefined, name: "brief.pdf",
    });
  });
});
