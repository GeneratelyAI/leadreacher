import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { GoogleGenAI } from "@google/genai";
import ffmpegPath from "ffmpeg-static";
import { env } from "../config/env.js";
import { ExternalServiceError } from "../lib/errors.js";
import { createSilentMp3 } from "../lib/video-frames.js";

const execFileAsync = promisify(execFile);
const GOOGLE_TTS_MODEL = "gemini-3.1-flash-tts-preview";
const DEFAULT_VOICE = "Kore";
const DEFAULT_SAMPLE_RATE = 24_000;
const DEFAULT_CHANNELS = 1;

const GEMINI_TTS_VOICES = new Set([
  "Zephyr",
  "Puck",
  "Charon",
  "Kore",
  "Fenrir",
  "Leda",
  "Orus",
  "Aoede",
  "Callirrhoe",
  "Autonoe",
  "Enceladus",
  "Iapetus",
  "Umbriel",
  "Algieba",
  "Despina",
  "Erinome",
  "Algenib",
  "Rasalgethi",
  "Laomedeia",
  "Achernar",
  "Schedar",
  "Gacrux",
  "Pulcherrima",
  "Achird",
  "Zubenelgenubi",
  "Vindemiatrix",
  "Sadachbia",
  "Sadaltager",
  "Sulafr",
]);

type GeminiAudioContent = {
  type: "audio";
  data?: string;
  mime_type?: string;
  channels?: number;
  sample_rate?: number;
};

type GeminiInteraction = {
  steps?: Array<{
    type?: string;
    content?: Array<{ type?: string; data?: string; mime_type?: string; channels?: number; sample_rate?: number }>;
  }>;
};

let googleAI: GoogleGenAI | undefined;

function getGoogleAI(): GoogleGenAI {
  return googleAI ??= new GoogleGenAI({ apiKey: env.GOOGLE_AI_API_KEY });
}

function resolveVoice(configuredVoice: string): string {
  // Keep existing deployments compatible with the old Cloud TTS voice setting.
  return GEMINI_TTS_VOICES.has(configuredVoice) ? configuredVoice : DEFAULT_VOICE;
}

async function convertPcmToMp3(
  pcm: Buffer,
  sampleRate: number,
  channels: number,
): Promise<Buffer> {
  if (!ffmpegPath || !existsSync(ffmpegPath)) {
    throw new Error("ffmpeg-static did not provide an ffmpeg binary path");
  }

  const tempDir = await mkdtemp(path.join(os.tmpdir(), "leadreacher-tts-"));
  try {
    const inputPath = path.join(tempDir, "speech.pcm");
    const outputPath = path.join(tempDir, "speech.mp3");
    await writeFile(inputPath, pcm);

    await execFileAsync(ffmpegPath, [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-f",
      "s16le",
      "-ar",
      String(sampleRate),
      "-ac",
      String(channels),
      "-i",
      inputPath,
      "-c:a",
      "libmp3lame",
      outputPath,
    ]);

    return readFile(outputPath);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

function findAudioContent(interaction: GeminiInteraction): GeminiAudioContent | undefined {
  for (const step of interaction.steps ?? []) {
    for (const content of step.content ?? []) {
      if (content.type === "audio" && content.data) {
        return content as GeminiAudioContent;
      }
    }
  }
  return undefined;
}

export async function synthesizeSpeech(text: string): Promise<Buffer> {
  if (env.VIDEO_MOCK_MODE) {
    return createSilentMp3();
  }

  if (!env.GOOGLE_AI_API_KEY) {
    throw new ExternalServiceError(
      "GeminiTTS",
      "GOOGLE_AI_API_KEY is required for personalized video generation",
    );
  }

  try {
    const interaction = await getGoogleAI().interactions.create({
      model: GOOGLE_TTS_MODEL,
      input: text,
      response_format: { type: "audio" },
      generation_config: {
        speech_config: [{
          voice: resolveVoice(env.PERSONALIZED_VIDEO_TTS_VOICE),
        }],
      },
    });

    const audio = findAudioContent(interaction as GeminiInteraction);
    if (!audio?.data) {
      throw new Error("Gemini TTS returned no audio content");
    }

    return convertPcmToMp3(
      Buffer.from(audio.data, "base64"),
      audio.sample_rate ?? DEFAULT_SAMPLE_RATE,
      audio.channels ?? DEFAULT_CHANNELS,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new ExternalServiceError("GeminiTTS", message);
  }
}
