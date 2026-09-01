import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import ffmpegPath from "ffmpeg-static";
import { afterEach, describe, expect, it, vi } from "vitest";
import { inspectAudioDurationMs } from "../../lib/video-frames.js";
import { createPersonalizedTemplateManifest } from "../../lib/personalized-video-manifest.js";
import {
  createPersonalizedGreetingAudio,
  templateUsesNativeOmniEndCard,
} from "../campaign-video.js";

const execFileAsync = promisify(execFile);
const tempDirs: string[] = [];

async function tone(durationSeconds: number): Promise<Buffer> {
  if (!ffmpegPath) throw new Error("ffmpeg-static did not provide an ffmpeg binary path");
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "leadreacher-greeting-test-"));
  tempDirs.push(tempDir);
  const outputPath = path.join(tempDir, "tone.mp3");
  await execFileAsync(ffmpegPath, [
    "-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i",
    `sine=frequency=400:duration=${durationSeconds}`, "-q:a", "9", outputPath,
  ]);
  return readFile(outputPath);
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("personalized greeting audio", () => {
  it("falls back to the lead name when the full greeting cannot fit naturally", async () => {
    const longGreeting = await tone(2.2);
    const shortGreeting = await tone(0.7);
    const synthesizer = vi.fn()
      .mockResolvedValueOnce(longGreeting)
      .mockResolvedValueOnce(shortGreeting);

    const result = await createPersonalizedGreetingAudio("Alexandria", synthesizer);

    expect(synthesizer).toHaveBeenNthCalledWith(1, "Hey Alexandria,", { mockDurationSeconds: 1 });
    expect(synthesizer).toHaveBeenNthCalledWith(2, "Alexandria", { mockDurationSeconds: 1 });
    expect(await inspectAudioDurationMs(result)).toBeLessThanOrEqual(1_550);
  });
});

describe("personalized Omni end card", () => {
  const storyboard = [
    { sceneNumber: 1, timeRange: "0-1.5s", beat: "hook" as const, imagePrompt: "A silent professional spokesperson faces the camera in a modern workspace with cinematic lighting.", motionNote: "Hold a natural silent acknowledgment." },
    { sceneNumber: 2, timeRange: "1.5-4s", beat: "problem" as const, imagePrompt: "A cluttered collection of web pages and fragmented data fills several developer workstation displays.", motionNote: "Pan across the fragmented information." },
    { sceneNumber: 3, timeRange: "4-6.5s", beat: "solution" as const, imagePrompt: "The fragmented web information transforms into clean structured data inside a polished interface.", motionNote: "Morph the fragments into organized data." },
    { sceneNumber: 4, timeRange: "6.5-8s", beat: "payoff" as const, imagePrompt: "A clean minimal closing background creates negative space for the supplied final logo frame.", motionNote: "Settle into the supplied logo frame." },
  ];

  function manifest(provider: "veo" | "omni") {
    return createPersonalizedTemplateManifest({
      storyboard,
      imagePrompt: storyboard[0].imagePrompt,
      videoPrompt: "Create a coherent ten-second personalized business video that resolves into the supplied logo frame.",
      sharedNarration: "Turn fragmented web information into clean structured context for production AI agents.",
      seedImageUrl: "https://assets.example.com/seed.png",
      seedImage: Buffer.from("seed"),
      sharedNarrationUrl: "https://assets.example.com/narration.mp3",
      sharedNarrationAudio: Buffer.from("audio"),
      logoUrl: "https://assets.example.com/logo.png",
      provider,
    });
  }

  it("preserves Omni's native logo ending and keeps the Veo overlay fallback", () => {
    expect(templateUsesNativeOmniEndCard(manifest("omni"))).toBe(true);
    expect(templateUsesNativeOmniEndCard(manifest("veo"))).toBe(false);
  });
});
