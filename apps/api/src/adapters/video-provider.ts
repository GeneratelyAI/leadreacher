import { env } from "../config/env.js";
import {
  getOmniVideoJobResult,
  isOmniOperation,
  pollOmniVideoJobStatus,
  submitOmniVideoJob,
} from "./google-omni.js";
import {
  getJobResult,
  pollJobStatus,
  submitVideoJob,
  type VideoJobStatus,
} from "./google-ai.js";

export type VideoProvider = "veo" | "omni";

export function getConfiguredVideoProvider(): VideoProvider {
  return env.VIDEO_GENERATION_PROVIDER;
}

export async function submitVideoJobForProvider(
  provider: VideoProvider,
  seedImageUrl: string,
  videoPrompt: string,
  referenceUrls: string[] = [],
  aspectRatio: "1:1" | "9:16" | "16:9" | "4:3" | "3:4" = "9:16",
): Promise<{ jobId: string }> {
  if (provider === "omni") {
    return submitOmniVideoJob(seedImageUrl, videoPrompt, aspectRatio);
  }

  return submitVideoJob(seedImageUrl, videoPrompt, referenceUrls, aspectRatio);
}

export function pollVideoJobStatus(jobId: string): Promise<VideoJobStatus> {
  return isOmniOperation(jobId) ? pollOmniVideoJobStatus(jobId) : pollJobStatus(jobId);
}

export function getVideoJobResult(jobId: string): Promise<{
  videoBuffer: Buffer;
  durationMs: number;
}> {
  return isOmniOperation(jobId) ? getOmniVideoJobResult(jobId) : getJobResult(jobId);
}
