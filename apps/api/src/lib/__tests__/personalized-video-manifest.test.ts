import { describe, expect, it } from "vitest";
import {
  createPersonalizedTemplateManifest,
  updatePersonalizedTemplateManifest,
} from "../personalized-video-manifest.js";

const storyboard = [
  { sceneNumber: 1, timeRange: "0-1.5s", beat: "hook" as const, imagePrompt: "A consistent spokesperson looks directly at camera in a quiet modern office with soft daylight.", motionNote: "Hold silently." },
  { sceneNumber: 2, timeRange: "1.5-4s", beat: "problem" as const, imagePrompt: "A focused business team handles fragmented social and web work across a modern studio desk.", motionNote: "Move through the work." },
  { sceneNumber: 3, timeRange: "4-6.5s", beat: "solution" as const, imagePrompt: "The same team works from a clear unified digital workflow in a bright professional setting.", motionNote: "Transition into space." },
  { sceneNumber: 4, timeRange: "6.5-8s", beat: "payoff" as const, imagePrompt: "A clean minimal professional background with generous negative space prepared for a source logo.", motionNote: "Settle before the end card." },
];

describe("personalized render manifest", () => {
  it("records the shared creative brief and deterministic composition contract", () => {
    const manifest = createPersonalizedTemplateManifest({
      storyboard,
      imagePrompt: storyboard[0].imagePrompt,
      videoPrompt: "Generate a silent visual-only portrait video.",
      sharedNarration: "Bring social and web work together so your team can create consistently and focus on growth.",
      seedImageUrl: "https://cdn.example/seed.png",
      seedImage: Buffer.from("seed"),
      sharedNarrationUrl: "https://cdn.example/narration.mp3",
      sharedNarrationAudio: Buffer.from("narration"),
      logoUrl: "https://cdn.example/logo.png",
      provider: "omni",
    });
    const updated = updatePersonalizedTemplateManifest(manifest, {
      provider: { operationId: "omni:123" },
      quality: { durationMs: 10_000, sourceAudioStreams: 0 },
    });

    expect(updated.renderingMode).toBe("single-shared-master");
    expect(updated.timeline).toEqual({
      greeting: "0.0-1.5s",
      narration: "1.5-8.0s",
      sourceLogoEndCard: "8.0-10.0s",
    });
    expect(updated.creativeBrief.storyboard).toHaveLength(4);
    expect(updated.provider).toEqual({ name: "omni", operationId: "omni:123" });
  });
});
