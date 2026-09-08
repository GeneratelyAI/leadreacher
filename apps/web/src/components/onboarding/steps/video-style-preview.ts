export type GeneratedVideoPreview = {
  videoUrl?: string;
  posterUrl?: string;
};

export type ResolvedVideoPreview =
  | { kind: "sample"; src: string }
  | { kind: "generated-video"; src: string; posterUrl?: string }
  | { kind: "generated-poster"; src: string }
  | { kind: "placeholder" };

export function resolveVideoStylePreview({
  sampleImage,
  previewMode,
  generatedPreview,
  unavailable = false,
}: {
  sampleImage: string;
  previewMode: boolean;
  generatedPreview?: GeneratedVideoPreview;
  unavailable?: boolean;
}): ResolvedVideoPreview {
  if (!unavailable && generatedPreview?.videoUrl) {
    return {
      kind: "generated-video",
      src: generatedPreview.videoUrl,
      posterUrl: generatedPreview.posterUrl,
    };
  }
  if (!unavailable && generatedPreview?.posterUrl) {
    return { kind: "generated-poster", src: generatedPreview.posterUrl };
  }
  if (previewMode) return { kind: "sample", src: sampleImage };
  return { kind: "placeholder" };
}
