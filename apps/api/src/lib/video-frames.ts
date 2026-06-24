import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import ffmpegPath from "ffmpeg-static";

const execFileAsync = promisify(execFile);
const SECONDS_PER_MILLISECOND = 1000;

export const FRAME_JPEG_QUALITY = 3;

export const REPRESENTATIVE_FRAME_TIMESTAMPS = {
  openingSeconds: 0,
  earlyHookSeconds: 1,
  closingOffsetFromEndSeconds: 2,
} as const;

const resolvedFfmpegPath = ffmpegPath;
const ffmpegPathExists = Boolean(
  resolvedFfmpegPath && existsSync(resolvedFfmpegPath),
);

console.log(
  JSON.stringify({
    event: "video-frames",
    path: "ffmpeg-path-resolved",
    ffmpegPath: resolvedFfmpegPath,
    exists: ffmpegPathExists,
  }),
);

export type VideoFrameInput = {
  label: string;
  mimeType: string;
  data: string;
};

export async function extractRepresentativeFrames(
  videoBuffer: Buffer,
  durationMs: number,
): Promise<VideoFrameInput[]> {
  if (!resolvedFfmpegPath) {
    throw new Error("ffmpeg-static did not provide an ffmpeg binary path");
  }

  if (!ffmpegPathExists) {
    throw new Error(`ffmpeg binary does not exist at ${resolvedFfmpegPath}`);
  }

  const ffmpegBinaryPath = resolvedFfmpegPath;
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "leadreacher-video-"));

  try {
    const inputPath = path.join(tempDir, "input.mp4");
    await writeFile(inputPath, videoBuffer);

    const durationSeconds = Math.max(1, durationMs / SECONDS_PER_MILLISECOND);
    const timestamps = [
      {
        label: "opening frame at 0s",
        seconds: REPRESENTATIVE_FRAME_TIMESTAMPS.openingSeconds,
      },
      {
        label: "early hook frame at about 1s",
        seconds: REPRESENTATIVE_FRAME_TIMESTAMPS.earlyHookSeconds,
      },
      {
        label: "midpoint frame",
        seconds: Math.max(0, durationSeconds / 2),
      },
      {
        label: "closing frame about 2s before end",
        seconds: Math.max(
          0,
          durationSeconds -
            REPRESENTATIVE_FRAME_TIMESTAMPS.closingOffsetFromEndSeconds,
        ),
      },
    ];

    return await Promise.all(
      timestamps.map(async (timestamp, index) => {
        const outputPath = path.join(tempDir, `frame-${index}.jpg`);

        await execFileAsync(ffmpegBinaryPath, [
          "-hide_banner",
          "-loglevel",
          "error",
          "-y",
          "-ss",
          timestamp.seconds.toFixed(3),
          "-i",
          inputPath,
          "-frames:v",
          "1",
          "-q:v",
          String(FRAME_JPEG_QUALITY),
          outputPath,
        ]);

        const data = await readFile(outputPath);
        return {
          label: timestamp.label,
          mimeType: "image/jpeg",
          data: data.toString("base64"),
        };
      }),
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}
