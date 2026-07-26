import { afterEach, describe, expect, it, vi } from "vitest";

const { create, GoogleGenAI } = vi.hoisted(() => {
  const create = vi.fn();
  const GoogleGenAI = vi.fn(function MockGoogleGenAI() {
    return { interactions: { create } };
  });
  return { create, GoogleGenAI };
});

vi.mock("@google/genai", () => ({ GoogleGenAI }));

vi.mock("../../config/env.js", () => ({
  env: {
    GOOGLE_AI_API_KEY: "test-key",
    VIDEO_MOCK_MODE: false,
    PERSONALIZED_VIDEO_TTS_VOICE: "en-US-Neural2-J",
  },
}));

import { synthesizeSpeech } from "../google-tts.js";

describe("Gemini TTS adapter", () => {
  afterEach(() => {
    create.mockReset();
  });

  it("requests Gemini speech and returns an MP3 buffer", async () => {
    const pcm = Buffer.alloc(4_800);
    create.mockResolvedValue({
      steps: [{
        type: "model_output",
        content: [{
          type: "audio",
          data: pcm.toString("base64"),
          mime_type: "audio/l16",
          channels: 1,
          sample_rate: 24_000,
        }],
      }],
    });

    const result = await synthesizeSpeech("Hello from LeadReacher");

    expect(create).toHaveBeenCalledWith({
      model: "gemini-3.1-flash-tts-preview",
      input: "Hello from LeadReacher",
      response_format: { type: "audio" },
      generation_config: {
        speech_config: [{ voice: "Kore" }],
      },
    });
    expect(result.length).toBeGreaterThan(0);
    expect(result.subarray(0, 3).toString()).toBe("ID3");
  });
});
