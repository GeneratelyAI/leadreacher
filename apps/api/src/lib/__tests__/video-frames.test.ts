import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import ffmpegPath from "ffmpeg-static";
import { afterEach, describe, expect, it } from "vitest";
import {
  assertPersonalizedMasterVideo,
  composePersonalizedVideo,
  extractRepresentativeFrames,
  inspectAudioDurationMs,
  inspectVideoMedia,
  normalizeVideoDuration,
  speedUpAudio,
  TARGET_VIDEO_DURATION_MS,
  validatePersonalizedAudioTiming,
} from "../video-frames.js";

const execFileAsync = promisify(execFile);
const tempDirs: string[] = [];

async function maxVolumeForSegment(
  mediaPath: string,
  startSeconds: number,
  durationSeconds: number,
): Promise<number> {
  if (!ffmpegPath) throw new Error("ffmpeg-static did not provide an ffmpeg binary path");
  const { stderr } = await execFileAsync(ffmpegPath, [
    "-hide_banner", "-ss", String(startSeconds), "-t", String(durationSeconds),
    "-i", mediaPath, "-af", "volumedetect", "-f", "null", "-",
  ]);
  const match = /max_volume:\s+(-?[\d.]+|\-inf) dB/.exec(stderr);
  if (!match) throw new Error("Could not read segment volume");
  return match[1] === "-inf" ? Number.NEGATIVE_INFINITY : Number(match[1]);
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("normalizeVideoDuration", () => {
  it("extends an eight-second source to the ten-second product runtime", async () => {
    if (!ffmpegPath) {
      throw new Error("ffmpeg-static did not provide an ffmpeg binary path");
    }

    const tempDir = await mkdtemp(path.join(os.tmpdir(), "leadreacher-video-test-"));
    tempDirs.push(tempDir);
    const sourcePath = path.join(tempDir, "source.mp4");
    const outputPath = path.join(tempDir, "output.mp4");

    await execFileAsync(ffmpegPath, [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-f",
      "lavfi",
      "-i",
      "color=c=black:s=16x16:r=24:d=8",
      "-an",
      "-c:v",
      "libx264",
      sourcePath,
    ]);

    const normalized = await normalizeVideoDuration(await readFile(sourcePath), 8_000);
    await writeFile(outputPath, normalized.videoBuffer);

    const { stderr } = await execFileAsync(ffmpegPath, [
      "-hide_banner",
      "-i",
      outputPath,
      "-f",
      "null",
      "-",
    ]);

    expect(normalized.durationMs).toBe(TARGET_VIDEO_DURATION_MS);
    expect(stderr).toContain("Duration: 00:00:10.00");
  });

  it("strips provider audio from a personalized template master", async () => {
    if (!ffmpegPath) throw new Error("ffmpeg-static did not provide an ffmpeg binary path");

    const tempDir = await mkdtemp(path.join(os.tmpdir(), "leadreacher-video-test-"));
    tempDirs.push(tempDir);
    const sourcePath = path.join(tempDir, "source-with-audio.mp4");
    await execFileAsync(ffmpegPath, [
      "-hide_banner", "-loglevel", "error", "-y",
      "-f", "lavfi", "-i", "color=c=black:s=90x160:r=24:d=8",
      "-f", "lavfi", "-i", "sine=frequency=440:duration=8",
      "-shortest", "-c:v", "libx264", "-c:a", "aac", sourcePath,
    ]);

    const normalized = await normalizeVideoDuration(
      await readFile(sourcePath),
      8_000,
      { stripAudio: true },
    );
    const media = await inspectVideoMedia(normalized.videoBuffer);

    expect(media.audioStreams).toBe(0);
    expect(media.durationMs).toBe(TARGET_VIDEO_DURATION_MS);
    expect(() => assertPersonalizedMasterVideo(media)).not.toThrow();
  });
});

describe("composePersonalizedVideo", () => {
  it("mixes lead greeting and shared narration into a ten-second master", async () => {
    if (!ffmpegPath) {
      throw new Error("ffmpeg-static did not provide an ffmpeg binary path");
    }

    const tempDir = await mkdtemp(path.join(os.tmpdir(), "leadreacher-compose-test-"));
    tempDirs.push(tempDir);
    const masterPath = path.join(tempDir, "master.mp4");
    const greetingPath = path.join(tempDir, "greeting.mp3");
    const narrationPath = path.join(tempDir, "narration.mp3");
    const outputPath = path.join(tempDir, "output.mp4");

    await Promise.all([
      execFileAsync(ffmpegPath, [
        "-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i",
        "color=c=black:s=90x160:r=24:d=10", "-an", "-c:v", "libx264", masterPath,
      ]),
      execFileAsync(ffmpegPath, [
        "-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i",
        "sine=frequency=400:duration=0.3", "-q:a", "9", greetingPath,
      ]),
      execFileAsync(ffmpegPath, [
        "-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i",
        "sine=frequency=800:duration=0.5", "-q:a", "9", narrationPath,
      ]),
    ]);

    const composed = await composePersonalizedVideo(
      await readFile(masterPath),
      await readFile(greetingPath),
      await readFile(narrationPath),
    );
    await writeFile(outputPath, composed.videoBuffer);
    const { stderr } = await execFileAsync(ffmpegPath, [
      "-hide_banner", "-i", outputPath, "-f", "null", "-",
    ]);

    expect(composed.durationMs).toBe(TARGET_VIDEO_DURATION_MS);
    expect(stderr).toContain("Duration: 00:00:10.00");
    await expect(maxVolumeForSegment(outputPath, 0, 0.5)).resolves.toBeGreaterThan(-80);
    await expect(maxVolumeForSegment(outputPath, 0.8, 0.4)).resolves.toBeLessThan(-80);
    await expect(maxVolumeForSegment(outputPath, 1.5, 0.5)).resolves.toBeGreaterThan(-80);
    await expect(maxVolumeForSegment(outputPath, 8.2, 0.5)).resolves.toBeLessThan(-80);
    await expect(inspectVideoMedia(composed.videoBuffer)).resolves.toMatchObject({
      audioStreams: 1,
      width: 90,
      height: 160,
    });
  });

  it("uses the supplied source logo for the final end card", async () => {
    if (!ffmpegPath) throw new Error("ffmpeg-static did not provide an ffmpeg binary path");

    const tempDir = await mkdtemp(path.join(os.tmpdir(), "leadreacher-compose-logo-test-"));
    tempDirs.push(tempDir);
    const masterPath = path.join(tempDir, "master.mp4");
    const greetingPath = path.join(tempDir, "greeting.mp3");
    const narrationPath = path.join(tempDir, "narration.mp3");
    const logoPath = path.join(tempDir, "logo.svg");

    await Promise.all([
      execFileAsync(ffmpegPath, [
        "-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i",
        "color=c=black:s=90x160:r=24:d=10", "-an", "-c:v", "libx264", masterPath,
      ]),
      execFileAsync(ffmpegPath, [
        "-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i",
        "sine=frequency=400:duration=0.3", "-q:a", "9", greetingPath,
      ]),
      execFileAsync(ffmpegPath, [
        "-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i",
        "sine=frequency=800:duration=0.5", "-q:a", "9", narrationPath,
      ]),
      writeFile(
        logoPath,
        '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="60"><rect width="120" height="60" fill="#5326b7"/></svg>',
      ),
    ]);

    const composed = await composePersonalizedVideo(
      await readFile(masterPath),
      await readFile(greetingPath),
      await readFile(narrationPath),
      { buffer: await readFile(logoPath), extension: "svg" },
    );

    await expect(inspectVideoMedia(composed.videoBuffer)).resolves.toMatchObject({
      durationMs: TARGET_VIDEO_DURATION_MS,
      audioStreams: 1,
      width: 90,
      height: 160,
    });
  }, 20_000);
});

describe("personalized audio timing", () => {
  it("measures audio duration and shortens it without truncating", async () => {
    if (!ffmpegPath) throw new Error("ffmpeg-static did not provide an ffmpeg binary path");
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "leadreacher-audio-timing-test-"));
    tempDirs.push(tempDir);
    const sourcePath = path.join(tempDir, "source.mp3");
    await execFileAsync(ffmpegPath, [
      "-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i",
      "sine=frequency=400:duration=1.8", "-q:a", "9", sourcePath,
    ]);

    const source = await readFile(sourcePath);
    const shortened = await speedUpAudio(source, 1.2);
    expect(await inspectAudioDurationMs(shortened)).toBeLessThan(await inspectAudioDurationMs(source));
  });

  it("rejects narration that would otherwise be cut off", async () => {
    if (!ffmpegPath) throw new Error("ffmpeg-static did not provide an ffmpeg binary path");
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "leadreacher-audio-reject-test-"));
    tempDirs.push(tempDir);
    const greetingPath = path.join(tempDir, "greeting.mp3");
    const narrationPath = path.join(tempDir, "narration.mp3");
    await Promise.all([
      execFileAsync(ffmpegPath, [
        "-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i",
        "sine=frequency=400:duration=0.4", "-q:a", "9", greetingPath,
      ]),
      execFileAsync(ffmpegPath, [
        "-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i",
        "sine=frequency=800:duration=7", "-q:a", "9", narrationPath,
      ]),
    ]);

    await expect(validatePersonalizedAudioTiming(
      await readFile(greetingPath),
      await readFile(narrationPath),
    )).rejects.toThrow("Shared narration exceeds 6500ms");
  });

  it("samples greeting and closing transitions for visual review", async () => {
    if (!ffmpegPath) throw new Error("ffmpeg-static did not provide an ffmpeg binary path");
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "leadreacher-frame-sample-test-"));
    tempDirs.push(tempDir);
    const videoPath = path.join(tempDir, "video.mp4");
    await execFileAsync(ffmpegPath, [
      "-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i",
      "color=c=black:s=90x160:r=24:d=10", "-an", "-c:v", "libx264", videoPath,
    ]);

    const frames = await extractRepresentativeFrames(await readFile(videoPath), 10_000);
    expect(frames).toHaveLength(6);
    expect(frames.map((frame) => frame.label)).toEqual(expect.arrayContaining([
      "greeting-to-narration transition at 1.5s",
      "final end-card frame after the logo transition",
    ]));
  });
});
