import { writeFile } from "node:fs/promises";
import { afterEach, describe, expect, it, vi } from "vitest";

const { create, get, filesGet, download, GoogleGenAI } = vi.hoisted(() => {
  const create = vi.fn();
  const get = vi.fn();
  const filesGet = vi.fn();
  const download = vi.fn();
  const GoogleGenAI = vi.fn(function MockGoogleGenAI() {
    return {
      interactions: { create, get },
      files: { get: filesGet, download },
    };
  });
  return { create, get, filesGet, download, GoogleGenAI };
});

vi.mock("@google/genai", () => ({
  GoogleGenAI,
  FileState: {
    PROCESSING: "PROCESSING",
    ACTIVE: "ACTIVE",
    FAILED: "FAILED",
  },
}));

vi.mock("../../config/env.js", () => ({
  env: {
    GOOGLE_AI_API_KEY: "test-key",
    VIDEO_MOCK_MODE: false,
  },
}));

import {
  GOOGLE_OMNI_VIDEO_DURATION,
  getOmniVideoJobResult,
  isOmniOperation,
  pollOmniVideoJobStatus,
  submitOmniVideoJob,
} from "../google-omni.js";

describe("Gemini Omni video adapter", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    create.mockReset();
    get.mockReset();
    filesGet.mockReset();
    download.mockReset();
  });

  it("submits an image-to-video interaction with silent output instructions", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async () =>
        new Response("image-bytes", {
          status: 200,
          headers: { "content-type": "image/png" },
        }),
      ),
    );
    create.mockResolvedValue({ id: "interaction-123", status: "in_progress" });

    const result = await submitOmniVideoJob(
      "https://assets.example.com/seed.png",
      "Animate the spokesperson with a smooth camera move.",
      "9:16",
      "https://assets.example.com/logo.png",
    );

    expect(result).toEqual({ jobId: "omni:interaction-123" });
    expect(isOmniOperation(result.jobId)).toBe(true);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gemini-omni-1.1-flash-preview",
        response_modalities: ["video"],
        response_format: {
          type: "video",
          delivery: "uri",
          aspect_ratio: "9:16",
          duration: GOOGLE_OMNI_VIDEO_DURATION,
        },
        generation_config: {
          video_config: { task: "image_to_video" },
        },
        input: [
          expect.objectContaining({
            type: "text",
            text: expect.stringMatching(/Generate exactly 10 seconds[\s\S]*Do not add speech/),
          }),
          expect.objectContaining({ type: "image", mime_type: "image/png" }),
          expect.objectContaining({ type: "image", mime_type: "image/png" }),
        ],
      }),
    );
  });

  it("waits for URI-backed output files before reporting completion", async () => {
    get.mockResolvedValue({
      status: "completed",
      output_video: { type: "video", uri: "files/generated-video" },
    });
    filesGet.mockResolvedValue({
      name: "files/generated-video",
      state: "ACTIVE",
    });

    await expect(pollOmniVideoJobStatus("omni:interaction-123")).resolves.toEqual({
      status: "complete",
    });
    expect(get).toHaveBeenCalledWith("interaction-123");
    expect(filesGet).toHaveBeenCalledWith({ name: "files/generated-video" });
  });

  it("downloads the completed URI-backed video into a buffer", async () => {
    get.mockResolvedValue({
      status: "completed",
      output_video: { type: "video", uri: "files/generated-video" },
    });
    filesGet.mockResolvedValue({
      name: "files/generated-video",
      state: "ACTIVE",
    });
    download.mockImplementation(async ({ downloadPath }: { downloadPath: string }) => {
      await writeFile(downloadPath, Buffer.from("video-bytes"));
    });

    const result = await getOmniVideoJobResult("omni:interaction-123");

    expect(result.videoBuffer.toString()).toBe("video-bytes");
    expect(result.durationMs).toBe(10_000);
    expect(download).toHaveBeenCalledWith({
      file: "files/generated-video",
      downloadPath: expect.stringContaining("video.mp4"),
    });
  });
});
