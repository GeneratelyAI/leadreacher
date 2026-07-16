import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import ffmpegPath from "ffmpeg-static";
import { afterEach, describe, expect, it } from "vitest";
import {
  composePersonalizedVideo,
  normalizeVideoDuration,
  TARGET_VIDEO_DURATION_MS,
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
        "color=c=black:s=16x16:r=24:d=10", "-an", "-c:v", "libx264", masterPath,
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
  });
});
