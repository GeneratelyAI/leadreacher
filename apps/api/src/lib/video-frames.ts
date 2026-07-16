import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import ffmpegPath from "ffmpeg-static";

const execFileAsync = promisify(execFile);
const SECONDS_PER_MILLISECOND = 1000;
export const TARGET_VIDEO_DURATION_SECONDS = 10;
export const TARGET_VIDEO_DURATION_MS = TARGET_VIDEO_DURATION_SECONDS * SECONDS_PER_MILLISECOND;
export const PERSONALIZED_GREETING_DURATION_SECONDS = 1.5;
export const PERSONALIZED_SHARED_NARRATION_DURATION_SECONDS = 6.5;

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

async function assertTargetDuration(outputPath: string): Promise<void> {
  if (!resolvedFfmpegPath) {
    throw new Error("ffmpeg-static did not provide an ffmpeg binary path");
  }

  const { stderr } = await execFileAsync(resolvedFfmpegPath, [
    "-hide_banner",
    "-i",
    outputPath,
    "-f",
    "null",
    "-",
  ]);
  const duration = /Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/.exec(stderr);
  if (!duration) {
    throw new Error("Could not verify target video duration");
  }

  const seconds =
    Number(duration[1]) * 3600 + Number(duration[2]) * 60 + Number(duration[3]);
  if (Math.abs(seconds - TARGET_VIDEO_DURATION_SECONDS) > 0.1) {
    throw new Error(
      `Video duration must be ${TARGET_VIDEO_DURATION_SECONDS}s, got ${seconds}s`,
    );
  }
}

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

/**
 * Veo 3.1 image-to-video generation is limited to eight seconds. The product
 * delivers ten-second assets, so the worker extends the final generated frame
 * into a two-second branded hold before the asset is uploaded to R2.
 */
export async function normalizeVideoDuration(
  videoBuffer: Buffer,
  sourceDurationMs: number,
): Promise<{ videoBuffer: Buffer; durationMs: number }> {
  if (!resolvedFfmpegPath) {
    throw new Error("ffmpeg-static did not provide an ffmpeg binary path");
  }

  if (!ffmpegPathExists) {
    throw new Error(`ffmpeg binary does not exist at ${resolvedFfmpegPath}`);
  }

  if (sourceDurationMs === TARGET_VIDEO_DURATION_MS) {
    return { videoBuffer, durationMs: TARGET_VIDEO_DURATION_MS };
  }

  const tempDir = await mkdtemp(path.join(os.tmpdir(), "leadreacher-video-"));

  try {
    const inputPath = path.join(tempDir, "input.mp4");
    const outputPath = path.join(tempDir, "normalized.mp4");
    await writeFile(inputPath, videoBuffer);

    const sourceDurationSeconds = Math.max(0, sourceDurationMs / SECONDS_PER_MILLISECOND);
    const extensionSeconds = Math.max(
      0,
      TARGET_VIDEO_DURATION_SECONDS - sourceDurationSeconds,
    );
    const videoFilter =
      extensionSeconds > 0
        ? `tpad=stop_mode=clone:stop_duration=${extensionSeconds.toFixed(3)}`
        : "null";

    await execFileAsync(resolvedFfmpegPath, [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-i",
      inputPath,
      "-filter:v",
      videoFilter,
      "-map",
      "0:v:0",
      "-map",
      "0:a?",
      "-t",
      String(TARGET_VIDEO_DURATION_SECONDS),
      "-c:v",
      "libx264",
      "-c:a",
      "aac",
      "-movflags",
      "+faststart",
      outputPath,
    ]);

    await assertTargetDuration(outputPath);

    return {
      videoBuffer: await readFile(outputPath),
      durationMs: TARGET_VIDEO_DURATION_MS,
    };
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

export async function composePersonalizedVideo(
  masterVideoBuffer: Buffer,
  greetingAudioBuffer: Buffer,
  sharedNarrationAudioBuffer: Buffer,
): Promise<{ videoBuffer: Buffer; durationMs: number }> {
  if (!resolvedFfmpegPath) {
    throw new Error("ffmpeg-static did not provide an ffmpeg binary path");
  }
  if (!ffmpegPathExists) {
    throw new Error(`ffmpeg binary does not exist at ${resolvedFfmpegPath}`);
  }

  const tempDir = await mkdtemp(path.join(os.tmpdir(), "leadreacher-video-compose-"));
  try {
    const masterPath = path.join(tempDir, "master.mp4");
    const greetingPath = path.join(tempDir, "greeting.mp3");
    const narrationPath = path.join(tempDir, "narration.mp3");
    const outputPath = path.join(tempDir, "personalized.mp4");
    await Promise.all([
      writeFile(masterPath, masterVideoBuffer),
      writeFile(greetingPath, greetingAudioBuffer),
      writeFile(narrationPath, sharedNarrationAudioBuffer),
    ]);

    const filter = [
      `[0:v]trim=duration=${TARGET_VIDEO_DURATION_SECONDS},setpts=PTS-STARTPTS[v]`,
      `[1:a]apad,atrim=duration=${PERSONALIZED_GREETING_DURATION_SECONDS}[greeting]`,
      `[2:a]apad,atrim=duration=${PERSONALIZED_SHARED_NARRATION_DURATION_SECONDS},adelay=1500:all=1[narration]`,
      `[greeting][narration]amix=inputs=2:duration=longest:dropout_transition=0,apad,atrim=duration=${TARGET_VIDEO_DURATION_SECONDS}[audio]`,
    ].join(";");

    await execFileAsync(resolvedFfmpegPath, [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-i",
      masterPath,
      "-i",
      greetingPath,
      "-i",
      narrationPath,
      "-filter_complex",
      filter,
      "-map",
      "[v]",
      "-map",
      "[audio]",
      "-t",
      String(TARGET_VIDEO_DURATION_SECONDS),
      "-c:v",
      "libx264",
      "-c:a",
      "aac",
      "-movflags",
      "+faststart",
      outputPath,
    ]);

    await assertTargetDuration(outputPath);

    return {
      videoBuffer: await readFile(outputPath),
      durationMs: TARGET_VIDEO_DURATION_MS,
    };
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

/**
 * Used only by VIDEO_MOCK_MODE so pipeline tests still exercise ffmpeg without
 * sending text to Google Cloud Text-to-Speech.
 */
export async function createSilentMp3(
  durationSeconds = PERSONALIZED_SHARED_NARRATION_DURATION_SECONDS,
): Promise<Buffer> {
  if (!resolvedFfmpegPath) {
    throw new Error("ffmpeg-static did not provide an ffmpeg binary path");
  }
  if (!ffmpegPathExists) {
    throw new Error(`ffmpeg binary does not exist at ${resolvedFfmpegPath}`);
  }

  const tempDir = await mkdtemp(path.join(os.tmpdir(), "leadreacher-video-silence-"));
  try {
    const outputPath = path.join(tempDir, "silent.mp3");
    await execFileAsync(resolvedFfmpegPath, [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-f",
      "lavfi",
      "-i",
      "anullsrc=r=44100:cl=mono",
      "-t",
      String(durationSeconds),
      "-c:a",
      "libmp3lame",
      outputPath,
    ]);
    return readFile(outputPath);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

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
