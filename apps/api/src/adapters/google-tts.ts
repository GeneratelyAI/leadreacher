import { env } from "../config/env.js";
import { ExternalServiceError } from "../lib/errors.js";
import { createSilentMp3 } from "../lib/video-frames.js";

const GOOGLE_TTS_URL = "https://texttospeech.googleapis.com/v1/text:synthesize";

type GoogleTtsResponse = {
  audioContent?: string;
  error?: { message?: string };
};

function languageCodeForVoice(voice: string): string {
  const match = /^([a-z]{2}-[A-Z]{2})-/.exec(voice);
  return match?.[1] ?? "en-US";
}

export async function synthesizeSpeech(text: string): Promise<Buffer> {
  if (env.VIDEO_MOCK_MODE) {
    return createSilentMp3();
  }

  if (!env.GOOGLE_TTS_API_KEY) {
    throw new ExternalServiceError(
      "GoogleCloudTextToSpeech",
      "GOOGLE_TTS_API_KEY is required for personalized video generation",
    );
  }

  const response = await fetch(`${GOOGLE_TTS_URL}?key=${encodeURIComponent(env.GOOGLE_TTS_API_KEY)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      input: { text },
      voice: {
        languageCode: languageCodeForVoice(env.PERSONALIZED_VIDEO_TTS_VOICE),
        name: env.PERSONALIZED_VIDEO_TTS_VOICE,
      },
      audioConfig: {
        audioEncoding: "MP3",
        speakingRate: 1.05,
      },
    }),
  });

  const payload = await response.json() as GoogleTtsResponse;
  if (!response.ok || !payload.audioContent) {
    throw new ExternalServiceError(
      "GoogleCloudTextToSpeech",
      payload.error?.message ?? `text.synthesize failed: ${response.status}`,
    );
  }

  return Buffer.from(payload.audioContent, "base64");
}
