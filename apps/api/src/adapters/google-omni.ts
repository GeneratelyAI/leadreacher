import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GoogleGenAI, FileState } from "@google/genai";
import { env } from "../config/env.js";
import { ExternalServiceError } from "../lib/errors.js";
import type { VideoJobStatus } from "./google-ai.js";

export const GOOGLE_OMNI_VIDEO_MODEL = "gemini-omni-flash-preview";
const OMNI_OPERATION_PREFIX = "omni:";
const OMNI_SUBMIT_TIMEOUT_MS = 60_000;
const OMNI_OPERATION_TIMEOUT_MS = 30_000;
const OMNI_VIDEO_DOWNLOAD_TIMEOUT_MS = 60_000;
const MOCK_VIDEO_URL = "https://www.w3schools.com/html/mov_bbb.mp4";
const MOCK_OPERATION_ID = `${OMNI_OPERATION_PREFIX}mock-operation-123`;

type AspectRatio = "1:1" | "9:16" | "16:9" | "4:3" | "3:4";

interface OmniVideoResult {
  videoBuffer: Buffer;
  durationMs: number;
}

function getGoogleAI(): GoogleGenAI {
  return new GoogleGenAI({ apiKey: env.GOOGLE_AI_API_KEY });
}

function omniLog(payload: Record<string, unknown>): void {
  console.log(JSON.stringify({ event: "google-omni", ...payload }));
}

function timeoutError(label: string, timeoutMs: number): Error {
  return new Error(`${label} timed out after ${timeoutMs}ms`);
}

async function withTimeout<T>(
  operation: Promise<T>,
  label: string,
  timeoutMs: number,
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;

  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(timeoutError(label, timeoutMs)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function fetchWithTimeout(
  url: string,
  label: string,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(timeoutError(label, timeoutMs)),
    timeoutMs,
  );

  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchVideo(url: string): Promise<Buffer> {
  const response = await fetchWithTimeout(
    url,
    "Download Gemini Omni video result",
    OMNI_VIDEO_DOWNLOAD_TIMEOUT_MS,
  );
  if (!response.ok) {
    throw new Error(`Failed to download Gemini Omni video: ${response.status}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

function operationIdForInteraction(interactionId: string): string {
  return `${OMNI_OPERATION_PREFIX}${interactionId}`;
}

function interactionIdFromOperation(operationId: string): string {
  return operationId.startsWith(OMNI_OPERATION_PREFIX)
    ? operationId.slice(OMNI_OPERATION_PREFIX.length)
    : operationId;
}

function isTransientOmniError(error: unknown): boolean {
  const candidate = error as {
    status?: unknown;
    code?: unknown;
    name?: unknown;
    message?: unknown;
  };
  const status =
    typeof candidate.status === "number"
      ? candidate.status
      : typeof candidate.code === "number"
        ? candidate.code
        : null;

  if (status === 408 || status === 429 || (status !== null && status >= 500)) {
    return true;
  }

  const message = String(candidate.message ?? "").toLowerCase();
  return (
    candidate.name === "AbortError" ||
    message.includes("timed out") ||
    message.includes("timeout") ||
    message.includes("network") ||
    message.includes("fetch failed") ||
    message.includes("econn")
  );
}

function serializeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }
  return { message: String(error) };
}

function fileNameFromUri(uri: string): string {
  const match = /(?:^|\/)(files\/[^/?#]+)/.exec(uri);
  return match?.[1] ?? uri;
}

async function getOutputFile(uri: string): Promise<{
  state: FileState | undefined;
  name: string | undefined;
  downloadUri: string | undefined;
}> {
  const file = await withTimeout(
    getGoogleAI().files.get({ name: fileNameFromUri(uri) }),
    "Gemini Omni files.get",
    OMNI_OPERATION_TIMEOUT_MS,
  );
  return {
    state: file.state,
    name: file.name,
    downloadUri: file.downloadUri,
  };
}

export function isOmniOperation(operationId: string): boolean {
  return operationId.startsWith(OMNI_OPERATION_PREFIX);
}

export async function submitOmniVideoJob(
  seedImageUrl: string,
  videoPrompt: string,
  aspectRatio: AspectRatio = "9:16",
): Promise<{ jobId: string }> {
  try {
    if (env.VIDEO_MOCK_MODE) {
      omniLog({
        path: "mock-interactions-create",
        model: GOOGLE_OMNI_VIDEO_MODEL,
        operationName: MOCK_OPERATION_ID,
        aspectRatio,
      });
      return { jobId: MOCK_OPERATION_ID };
    }

    const seedResponse = await fetchWithTimeout(
      seedImageUrl,
      "Fetch Gemini Omni seed image",
      OMNI_VIDEO_DOWNLOAD_TIMEOUT_MS,
    );
    if (!seedResponse.ok) {
      throw new Error(`Failed to fetch seed image: ${seedImageUrl}`);
    }

    const seedBuffer = Buffer.from(await seedResponse.arrayBuffer());
    const seedMime = (
      seedResponse.headers.get("content-type") ?? "image/png"
    ).split(";")[0];
    const input = [
      {
        type: "image" as const,
        data: seedBuffer.toString("base64"),
        mime_type: seedMime,
      },
      {
        type: "text" as const,
        text: `${videoPrompt}

Generate a silent visual-only video. Do not add speech, dialogue, narration, music, sound effects, captions, subtitles, text, numbers, or metrics. The application adds audio separately after video generation.`,
      },
    ];

    omniLog({
      path: "interactions-create-request",
      model: GOOGLE_OMNI_VIDEO_MODEL,
      aspectRatio,
      responseFormat: "video uri",
      timeoutMs: OMNI_SUBMIT_TIMEOUT_MS,
    });

    const interaction = await withTimeout(
      getGoogleAI().interactions.create({
        model: GOOGLE_OMNI_VIDEO_MODEL,
        input,
        response_modalities: ["video"],
        response_format: {
          type: "video",
          delivery: "uri",
          aspect_ratio: aspectRatio,
        },
      }),
      "Gemini Omni interactions.create",
      OMNI_SUBMIT_TIMEOUT_MS,
    );

    if (!interaction.id) {
      throw new Error("Gemini Omni returned no interaction ID");
    }

    omniLog({
      path: "interactions-create-response",
      model: GOOGLE_OMNI_VIDEO_MODEL,
      interactionId: interaction.id,
      status: interaction.status,
    });

    if (interaction.status === "failed" || interaction.status === "cancelled") {
      throw new Error(`Gemini Omni interaction ${interaction.status}`);
    }

    return { jobId: operationIdForInteraction(interaction.id) };
  } catch (error) {
    throw new ExternalServiceError(
      "GeminiOmni",
      `submitOmniVideoJob failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function pollOmniVideoJobStatus(
  operationId: string,
): Promise<VideoJobStatus> {
  try {
    if (env.VIDEO_MOCK_MODE) {
      return { status: "complete" };
    }

    const interaction = await withTimeout(
      getGoogleAI().interactions.get(interactionIdFromOperation(operationId)),
      "Gemini Omni interactions.get",
      OMNI_OPERATION_TIMEOUT_MS,
    );

    if (interaction.status === "failed" || interaction.status === "cancelled") {
      return { status: "failed", error: interaction.status };
    }

    const outputVideo = interaction.output_video;
    if (interaction.status === "completed" && outputVideo?.data) {
      return { status: "complete" };
    }

    if (interaction.status === "completed" && outputVideo?.uri) {
      const file = await getOutputFile(outputVideo.uri);
      if (file.state === FileState.FAILED) {
        return { status: "failed", error: "Gemini Omni output file failed" };
      }
      return file.state === FileState.ACTIVE
        ? { status: "complete" }
        : { status: "pending" };
    }

    return { status: "pending" };
  } catch (error) {
    if (isTransientOmniError(error)) return { status: "pending" };
    return { status: "failed", error: serializeError(error) };
  }
}

export async function getOmniVideoJobResult(
  operationId: string,
): Promise<OmniVideoResult> {
  try {
    if (env.VIDEO_MOCK_MODE) {
      return {
        videoBuffer: await fetchVideo(MOCK_VIDEO_URL),
        durationMs: 10_000,
      };
    }

    const interaction = await withTimeout(
      getGoogleAI().interactions.get(interactionIdFromOperation(operationId)),
      "Gemini Omni interactions.get",
      OMNI_OPERATION_TIMEOUT_MS,
    );
    if (interaction.status !== "completed") {
      throw new Error("Gemini Omni interaction is not complete");
    }

    const outputVideo = interaction.output_video;
    if (outputVideo?.data) {
      return {
        videoBuffer: Buffer.from(outputVideo.data, "base64"),
        durationMs: 8_000,
      };
    }

    if (!outputVideo?.uri) {
      throw new Error("Gemini Omni returned no video output");
    }

    if (/^https?:\/\//.test(outputVideo.uri)) {
      return {
        videoBuffer: await fetchVideo(outputVideo.uri),
        durationMs: 8_000,
      };
    }

    const file = await getOutputFile(outputVideo.uri);
    if (file.state !== FileState.ACTIVE || !file.name) {
      throw new Error("Gemini Omni output file is not ready");
    }

    const temporaryDirectory = await mkdtemp(join(tmpdir(), "leadreacher-omni-"));
    const downloadPath = join(temporaryDirectory, "video.mp4");
    try {
      await withTimeout(
        getGoogleAI().files.download({ file: file.name, downloadPath }),
        "Gemini Omni files.download",
        OMNI_VIDEO_DOWNLOAD_TIMEOUT_MS,
      );
      return {
        videoBuffer: await readFile(downloadPath),
        durationMs: 8_000,
      };
    } finally {
      await rm(temporaryDirectory, { recursive: true, force: true });
    }
  } catch (error) {
    throw new ExternalServiceError(
      "GeminiOmni",
      `getOmniVideoJobResult failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
