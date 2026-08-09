import { GoogleGenAI, type GenerateVideosOperation } from "@google/genai";
import { env } from "../config/env.js";
import { externalServiceFailure } from "../lib/errors.js";
import { logOperationalInfo } from "../lib/operational-logger.js";

const googleAI = new GoogleGenAI({ apiKey: env.GOOGLE_AI_API_KEY });
const IMAGEN_GENERATION_TIMEOUT_MS = 60_000;
const GEMINI_IMAGE_GENERATION_TIMEOUT_MS = 60_000;
const VEO_SUBMIT_TIMEOUT_MS = 60_000;
const VEO_OPERATION_TIMEOUT_MS = 30_000;
const VIDEO_DOWNLOAD_TIMEOUT_MS = 60_000;
const MOCK_SEED_IMAGE_URL =
  "https://placehold.co/1024x576.png?text=LeadReacher+Mock+Seed";
const MOCK_VIDEO_URL = "https://www.w3schools.com/html/mov_bbb.mp4";
const MOCK_OPERATION_ID = "mock-operation-123";

// Imagen model used to create seed images from prompt-only video briefs.
export const GOOGLE_IMAGEN_MODEL = "imagen-4.0-generate-001";

// Gemini image model used when reference assets should guide seed-image creation.
export const GOOGLE_ASSET_IMAGE_MODEL = "gemini-3.1-flash-image";

// Veo model used for the final video generation job.
export const GOOGLE_VEO_VIDEO_MODEL = "veo-3.1-generate-preview";

type AspectRatio = "1:1" | "9:16" | "16:9" | "4:3" | "3:4";

interface GeneratedImage {
  buffer: Buffer;
  mimeType: string;
}

function googleLog(payload: Record<string, unknown>): void {
  logOperationalInfo("google-ai", payload);
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
    if (timer) {
      clearTimeout(timer);
    }
  }
}

async function fetchWithTimeout(
  url: string,
  label: string,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(timeoutError(label, timeoutMs)), timeoutMs);

  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchMockMedia(
  url: string,
  label: string,
  fallbackMimeType: string,
): Promise<{ buffer: Buffer; mimeType: string }> {
  const response = await fetchWithTimeout(url, label, VIDEO_DOWNLOAD_TIMEOUT_MS);
  if (!response.ok) {
    throw new Error(`${label} failed: ${response.status}`);
  }

  const mimeType = (
    response.headers.get("content-type") ?? fallbackMimeType
  ).split(";")[0];
  const buffer = Buffer.from(await response.arrayBuffer());
  return { buffer, mimeType };
}

export async function generateImageFromPrompt(
  prompt: string,
  aspectRatio: AspectRatio = "9:16",
): Promise<GeneratedImage> {
  try {
    if (env.VIDEO_MOCK_MODE) {
      googleLog({
        path: "mock-imagen-generateImages",
        sourceUrl: MOCK_SEED_IMAGE_URL,
        aspectRatio,
      });

      return fetchMockMedia(
        MOCK_SEED_IMAGE_URL,
        "Fetch mock seed image",
        "image/png",
      );
    }

    googleLog({
      path: "imagen-generateImages-request",
      model: GOOGLE_IMAGEN_MODEL,
      aspectRatio,
      timeoutMs: IMAGEN_GENERATION_TIMEOUT_MS,
    });

    const response = await withTimeout(
      googleAI.models.generateImages({
        model: GOOGLE_IMAGEN_MODEL,
        prompt,
        config: {
          numberOfImages: 1,
          aspectRatio,
          outputMimeType: "image/png",
        },
      }),
      "Imagen generateImages",
      IMAGEN_GENERATION_TIMEOUT_MS,
    );

    googleLog({
      path: "imagen-generateImages-response",
      model: GOOGLE_IMAGEN_MODEL,
      generatedCount: response.generatedImages?.length ?? 0,
    });

    const generated = response.generatedImages?.[0];
    if (!generated?.image?.imageBytes) {
      throw new Error("Imagen 4 returned no image data");
    }

    const buffer = Buffer.from(generated.image.imageBytes, "base64");
    return { buffer, mimeType: "image/png" };
  } catch (error) {
    throw externalServiceFailure(
      "Imagen4",
      new Error(`generateImageFromPrompt failed: ${error instanceof Error ? error.message : String(error)}`),
    );
  }
}

export async function generateImageWithAssets(
  prompt: string,
  assetUrls: string[],
  aspectRatio: AspectRatio = "9:16",
): Promise<GeneratedImage> {
  try {
    if (env.VIDEO_MOCK_MODE) {
      googleLog({
        path: "mock-gemini-image-generateContent",
        sourceUrl: MOCK_SEED_IMAGE_URL,
        assetCount: assetUrls.length,
        aspectRatio,
      });

      return fetchMockMedia(
        MOCK_SEED_IMAGE_URL,
        "Fetch mock seed image",
        "image/png",
      );
    }

    const assetParts = await Promise.all(
      assetUrls.slice(0, 3).map(async (url) => {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to fetch asset: ${url}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const mimeType = (
          response.headers.get("content-type") ?? "image/jpeg"
        ).split(";")[0];

        return {
          inlineData: {
            data: Buffer.from(arrayBuffer).toString("base64"),
            mimeType,
          },
        };
      }),
    );

    const contents = [
      ...assetParts,
      {
        text: `Generate an image for this video ad. ${prompt}. Aspect ratio: ${aspectRatio}.`,
      },
    ];

    googleLog({
      path: "gemini-image-generateContent-request",
      model: GOOGLE_ASSET_IMAGE_MODEL,
      assetCount: assetParts.length,
      aspectRatio,
      timeoutMs: GEMINI_IMAGE_GENERATION_TIMEOUT_MS,
    });

    const response = await withTimeout(
      googleAI.models.generateContent({
        model: GOOGLE_ASSET_IMAGE_MODEL,
        contents: [{ role: "user", parts: contents }],
      }),
      "Gemini image generateContent",
      GEMINI_IMAGE_GENERATION_TIMEOUT_MS,
    );

    googleLog({
      path: "gemini-image-generateContent-response",
      model: GOOGLE_ASSET_IMAGE_MODEL,
      candidateCount: response.candidates?.length ?? 0,
    });

    const parts = response.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find((part) =>
      part.inlineData?.mimeType?.startsWith("image/"),
    );

    if (!imagePart?.inlineData?.data) {
      throw new Error("Gemini Flash Image returned no image data");
    }

    const buffer = Buffer.from(imagePart.inlineData.data, "base64");
    return {
      buffer,
      mimeType: imagePart.inlineData.mimeType ?? "image/png",
    };
  } catch (error) {
    throw externalServiceFailure(
      "GeminiFlashImage",
      new Error(`generateImageWithAssets failed: ${error instanceof Error ? error.message : String(error)}`),
    );
  }
}

interface VideoJobResult {
  videoBuffer: Buffer;
  durationMs: number;
}

export type VideoJobStatus =
  | { status: "pending" | "complete" }
  | { status: "failed"; error?: unknown };

function serializeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return { message: String(error) };
}

export function isTransientVeoPollError(error: unknown): boolean {
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

export async function submitVideoJob(
  seedImageUrl: string,
  videoPrompt: string,
  referenceUrls: string[] = [],
  aspectRatio: AspectRatio = "9:16",
): Promise<{ jobId: string }> {
  try {
    if (env.VIDEO_MOCK_MODE) {
      googleLog({
        path: "mock-veo-generateVideos",
        operationName: MOCK_OPERATION_ID,
        seedImageUrl,
        referenceUrlCount: referenceUrls.length,
        aspectRatio,
      });

      return { jobId: MOCK_OPERATION_ID };
    }

    const seedResponse = await fetchWithTimeout(
      seedImageUrl,
      "Fetch Veo seed image",
      VIDEO_DOWNLOAD_TIMEOUT_MS,
    );
    if (!seedResponse.ok) {
      throw new Error(`Failed to fetch seed image: ${seedImageUrl}`);
    }

    const seedBuffer = Buffer.from(await seedResponse.arrayBuffer());
    const seedMime = (
      seedResponse.headers.get("content-type") ?? "image/png"
    ).split(";")[0];

    const referenceContext =
      referenceUrls.length > 0
        ? ` Reference assets provided at: ${referenceUrls.join(", ")}.`
        : "";

    googleLog({
      path: "veo-generateVideos-request",
      model: GOOGLE_VEO_VIDEO_MODEL,
      aspectRatio,
      durationSeconds: 8,
      timeoutMs: VEO_SUBMIT_TIMEOUT_MS,
    });

    const operation = await withTimeout(
      googleAI.models.generateVideos({
        model: GOOGLE_VEO_VIDEO_MODEL,
        prompt: videoPrompt + referenceContext,
        image: {
          imageBytes: seedBuffer.toString("base64"),
          mimeType: seedMime,
        },
        config: {
          aspectRatio,
          durationSeconds: 8,
        },
      }),
      "Veo generateVideos",
      VEO_SUBMIT_TIMEOUT_MS,
    );

    googleLog({
      path: "veo-generateVideos-response",
      model: GOOGLE_VEO_VIDEO_MODEL,
      operationName: operation.name,
    });

    const jobId = operation.name ?? String(Date.now());
    return { jobId };
  } catch (error) {
    throw externalServiceFailure(
      "Veo3",
      new Error(`submitVideoJob failed: ${error instanceof Error ? error.message : String(error)}`),
    );
  }
}

export async function pollJobStatus(
  jobId: string,
): Promise<VideoJobStatus> {
  try {
    if (env.VIDEO_MOCK_MODE) {
      googleLog({
        path: "mock-veo-getVideosOperation",
        operationName: jobId,
        status: "complete",
      });

      return { status: "complete" };
    }

    const updated = await withTimeout(
      googleAI.operations.getVideosOperation({
        operation: { name: jobId } as GenerateVideosOperation,
      }),
      "Veo getVideosOperation",
      VEO_OPERATION_TIMEOUT_MS,
    );

    if (updated.error) return { status: "failed", error: updated.error };
    if (updated.done) return { status: "complete" };
    return { status: "pending" };
  } catch (error) {
    if (isTransientVeoPollError(error)) {
      return { status: "pending" };
    }
    return { status: "failed", error: serializeError(error) };
  }
}

export async function getJobResult(jobId: string): Promise<VideoJobResult> {
  try {
    if (env.VIDEO_MOCK_MODE) {
      googleLog({
        path: "mock-veo-download-result",
        operationName: jobId,
        sourceUrl: MOCK_VIDEO_URL,
      });

      const { buffer } = await fetchMockMedia(
        MOCK_VIDEO_URL,
        "Fetch mock video result",
        "video/mp4",
      );
      return { videoBuffer: buffer, durationMs: 10_000 };
    }

    const updated = await withTimeout(
      googleAI.operations.getVideosOperation({
        operation: { name: jobId } as GenerateVideosOperation,
      }),
      "Veo getVideosOperation",
      VEO_OPERATION_TIMEOUT_MS,
    );

    if (!updated.done) {
      throw new Error("Job not complete");
    }

    if (updated.error) {
      const message = (updated.error as Record<string, unknown>)["message"];
      throw new Error(typeof message === "string" ? message : "Veo job failed");
    }

    const videoUri = updated.response?.generatedVideos?.[0]?.video?.uri;
    if (!videoUri) {
      throw new Error("No video URI in job result");
    }

    const videoResponse = await fetchWithTimeout(
      videoUri,
      "Download Veo video result",
      VIDEO_DOWNLOAD_TIMEOUT_MS,
    );
    if (!videoResponse.ok) {
      throw new Error(`Failed to download video: ${videoResponse.status}`);
    }

    const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());
    return { videoBuffer, durationMs: 8000 };
  } catch (error) {
    throw externalServiceFailure(
      "Veo3",
      new Error(`getJobResult failed: ${error instanceof Error ? error.message : String(error)}`),
    );
  }
}
