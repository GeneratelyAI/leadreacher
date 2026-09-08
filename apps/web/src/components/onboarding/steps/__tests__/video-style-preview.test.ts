import { describe, expect, it } from "vitest";
import { resolveVideoStylePreview } from "../video-style-preview";

describe("video style preview state", () => {
  const sampleImage = "/landing/product-story/content-professional.webp";

  it("uses polished sample media only in preview mode", () => {
    expect(resolveVideoStylePreview({ sampleImage, previewMode: true })).toEqual({
      kind: "sample",
      src: sampleImage,
    });
  });

  it("uses an intentional placeholder in real onboarding until an asset exists", () => {
    expect(resolveVideoStylePreview({ sampleImage, previewMode: false })).toEqual({ kind: "placeholder" });
  });

  it("supports the safe placeholder comparison fixture without changing default preview samples", () => {
    expect(resolveVideoStylePreview({ sampleImage, previewMode: true, placeholderFixture: true })).toEqual({ kind: "placeholder" });
    expect(resolveVideoStylePreview({ sampleImage, previewMode: false, placeholderFixture: true, generatedPreview: { posterUrl: "/generated/real.webp" } })).toEqual({ kind: "generated-poster", src: "/generated/real.webp" });
  });

  it("does not retry a broken sample indefinitely", () => {
    expect(resolveVideoStylePreview({ sampleImage, previewMode: true, unavailable: true })).toEqual({ kind: "placeholder" });
  });

  it("promotes a future generated video or poster without changing the card model", () => {
    expect(resolveVideoStylePreview({
      sampleImage,
      previewMode: false,
      generatedPreview: { videoUrl: "https://media.example/video.mp4", posterUrl: "https://media.example/poster.webp" },
    })).toEqual({
      kind: "generated-video",
      src: "https://media.example/video.mp4",
      posterUrl: "https://media.example/poster.webp",
    });
    expect(resolveVideoStylePreview({
      sampleImage,
      previewMode: false,
      generatedPreview: { posterUrl: "https://media.example/poster.webp" },
    })).toEqual({
      kind: "generated-poster",
      src: "https://media.example/poster.webp",
    });
  });

  it("falls back to the neutral panel when a generated asset is unusable", () => {
    expect(resolveVideoStylePreview({
      sampleImage,
      previewMode: false,
      generatedPreview: { videoUrl: "https://media.example/video.mp4" },
      unavailable: true,
    })).toEqual({ kind: "placeholder" });
  });
});
