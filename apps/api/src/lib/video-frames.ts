import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import ffmpegPath from "ffmpeg-static";
import sharp from "sharp";

const execFileAsync = promisify(execFile);
const SECONDS_PER_MILLISECOND = 1000;
export const TARGET_VIDEO_DURATION_SECONDS = 10;
export const TARGET_VIDEO_DURATION_MS = TARGET_VIDEO_DURATION_SECONDS * SECONDS_PER_MILLISECOND;
export const PERSONALIZED_GREETING_DURATION_SECONDS = 1.5;
export const PERSONALIZED_SHARED_NARRATION_DURATION_SECONDS = 6.5;
export const PERSONALIZED_LOGO_END_CARD_START_SECONDS = 8;
export const PERSONALIZED_LOGO_END_CARD_DURATION_SECONDS = 2;

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

export type VideoFrameInput = {
  label: string;
  mimeType: string;
  data: string;
};

export type VideoMediaInspection = {
  durationMs: number;
  width: number;
  height: number;
  videoStreams: number;
  audioStreams: number;
};

function parseDurationMilliseconds(stderr: string): number {
  const duration = /Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/.exec(stderr);
  if (!duration) throw new Error("Could not read video duration");
  const seconds =
    Number(duration[1]) * 3600 + Number(duration[2]) * 60 + Number(duration[3]);
  return Math.round(seconds * SECONDS_PER_MILLISECOND);
}

async function inspectVideoPath(filePath: string): Promise<VideoMediaInspection> {
  if (!resolvedFfmpegPath) {
    throw new Error("ffmpeg-static did not provide an ffmpeg binary path");
  }
  const { stderr } = await execFileAsync(resolvedFfmpegPath, [
    "-hide_banner",
    "-i",
    filePath,
    "-f",
    "null",
    "-",
  ]);
  const dimensions = /Video:.*?(\d{2,5})x(\d{2,5})/.exec(stderr);
  if (!dimensions) throw new Error("Could not read video dimensions");

  const sourceStreamLines = stderr
    .split("Stream mapping:")[0]
    .split("\n")
    .filter((line) => /^\s*Stream #\d+:\d+/.test(line) && !line.includes("->"));

  return {
    durationMs: parseDurationMilliseconds(stderr),
    width: Number(dimensions[1]),
    height: Number(dimensions[2]),
    videoStreams: sourceStreamLines.filter((line) => line.includes("Video:")).length,
    audioStreams: sourceStreamLines.filter((line) => line.includes("Audio:")).length,
  };
}

export async function inspectVideoMedia(videoBuffer: Buffer): Promise<VideoMediaInspection> {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "leadreacher-video-inspect-"));
  try {
    const inputPath = path.join(tempDir, "input.mp4");
    await writeFile(inputPath, videoBuffer);
    return await inspectVideoPath(inputPath);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

function assertTargetRuntime(media: VideoMediaInspection, label: string): void {
  if (Math.abs(media.durationMs - TARGET_VIDEO_DURATION_MS) > 100) {
    throw new Error(`${label} must be ${TARGET_VIDEO_DURATION_SECONDS}s, got ${media.durationMs}ms`);
  }
  if (media.videoStreams !== 1) {
    throw new Error(`${label} must contain exactly one video stream`);
  }
}

export function assertPersonalizedMasterVideo(media: VideoMediaInspection): void {
  assertTargetRuntime(media, "Personalized template master");
  if (media.audioStreams !== 0) {
    throw new Error("Personalized template master must not contain provider audio");
  }
  const aspectRatio = media.width / media.height;
  if (Math.abs(aspectRatio - 9 / 16) > 0.04) {
    throw new Error("Personalized template master must use a 9:16 portrait frame");
  }
}

export function assertPersonalizedDeliveryVideo(media: VideoMediaInspection): void {
  assertTargetRuntime(media, "Personalized delivery video");
  if (media.audioStreams !== 1) {
    throw new Error("Personalized delivery video must contain exactly one composed audio stream");
  }
}

/**
 * Veo 3.1 image-to-video generation is limited to eight seconds. The product
 * delivers ten-second assets, so the worker extends the final generated frame
 * into a two-second branded hold before the asset is uploaded to R2.
 */
export async function normalizeVideoDuration(
  videoBuffer: Buffer,
  sourceDurationMs: number,
  options: { stripAudio?: boolean } = {},
): Promise<{ videoBuffer: Buffer; durationMs: number }> {
  if (!resolvedFfmpegPath) {
    throw new Error("ffmpeg-static did not provide an ffmpeg binary path");
  }

  if (!ffmpegPathExists) {
    throw new Error(`ffmpeg binary does not exist at ${resolvedFfmpegPath}`);
  }

  if (sourceDurationMs === TARGET_VIDEO_DURATION_MS && !options.stripAudio) {
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

    const audioArgs = options.stripAudio
      ? ["-an"]
      : ["-map", "0:a?", "-c:a", "aac"];

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
      "-t",
      String(TARGET_VIDEO_DURATION_SECONDS),
      "-c:v",
      "libx264",
      ...audioArgs,
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
  logo?: { buffer: Buffer; extension: string },
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
    const originalLogoPath = logo ? path.join(tempDir, `logo.${logo.extension}`) : null;
    // ffmpeg-static does not ship an SVG decoder. Rasterize vector brand assets
    // before using them as the source-controlled logo end card.
    const logoPath = logo
      ? path.join(tempDir, logo.extension.toLowerCase() === "svg" ? "logo.png" : `logo.${logo.extension}`)
      : null;
    const outputPath = path.join(tempDir, "personalized.mp4");
    await Promise.all([
      writeFile(masterPath, masterVideoBuffer),
      writeFile(greetingPath, greetingAudioBuffer),
      writeFile(narrationPath, sharedNarrationAudioBuffer),
      ...(originalLogoPath ? [writeFile(originalLogoPath, logo!.buffer)] : []),
    ]);
    if (logo && logoPath && originalLogoPath && logoPath !== originalLogoPath) {
      await writeFile(logoPath, await sharp(logo.buffer, { density: 300 }).png().toBuffer());
    }

    const masterMedia = await inspectVideoPath(masterPath);
    assertPersonalizedMasterVideo(masterMedia);

    const videoFilter = logoPath
      ? [
        `[0:v]trim=duration=${PERSONALIZED_LOGO_END_CARD_START_SECONDS},setpts=PTS-STARTPTS,fps=24,settb=AVTB[story]`,
        `color=c=white:s=${masterMedia.width}x${masterMedia.height}:r=24:d=${PERSONALIZED_LOGO_END_CARD_DURATION_SECONDS},settb=AVTB[card]`,
        `[3:v]trim=duration=${PERSONALIZED_LOGO_END_CARD_DURATION_SECONDS},setpts=PTS-STARTPTS,fps=24,settb=AVTB,scale=${Math.round(masterMedia.width * 0.45)}:-1:force_original_aspect_ratio=decrease,format=rgba[logo]`,
        `[card][logo]overlay=(W-w)/2:(H-h)/2:shortest=1[logo-card]`,
        `[story][logo-card]concat=n=2:v=1:a=0,fps=24,format=yuv420p[v]`,
      ]
      : [`[0:v]trim=duration=${TARGET_VIDEO_DURATION_SECONDS},setpts=PTS-STARTPTS[v]`];

    const audioFilter = [
      `[1:a]apad,atrim=duration=${PERSONALIZED_GREETING_DURATION_SECONDS}[greeting]`,
      `[2:a]apad,atrim=duration=${PERSONALIZED_SHARED_NARRATION_DURATION_SECONDS},adelay=1500:all=1[narration]`,
      `[greeting][narration]amix=inputs=2:duration=longest:dropout_transition=0,apad,atrim=duration=${TARGET_VIDEO_DURATION_SECONDS}[audio]`,
    ];
    const filter = [...videoFilter, ...audioFilter].join(";");

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
      ...(logoPath
        ? ["-loop", "1", "-t", String(PERSONALIZED_LOGO_END_CARD_DURATION_SECONDS), "-i", logoPath]
        : []),
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
    assertPersonalizedDeliveryVideo(await inspectVideoPath(outputPath));

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
