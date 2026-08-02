import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  getVideoJobResult,
  pollVideoJobStatus,
  submitVideoJobForProvider,
  type VideoProvider,
} from "../adapters/video-provider.js";
import {
  assertPersonalizedMasterVideo,
  extractRepresentativeFrames,
  inspectVideoMedia,
  normalizeVideoDuration,
} from "../lib/video-frames.js";
import { runVideoOutputCritic } from "../modules/critics/video-output-critic.js";

type Fixture = {
  seedImageUrl: string;
  videoPrompt: string;
  referenceUrls?: string[];
};

const PROVIDERS: VideoProvider[] = ["veo", "omni"];
const POLL_INTERVAL_MS = 10_000;
const POLL_TIMEOUT_MS = 10 * 60 * 1000;

function requiredFlag(name: string): string {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value || value.startsWith("--")) {
    throw new Error(`Missing ${name}. Example: pnpm video:benchmark -- --fixture ./fixture.json --execute`);
  }
  return value;
}

async function waitForCompletion(operationId: string): Promise<void> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const status = await pollVideoJobStatus(operationId);
    if (status.status === "complete") return;
    if (status.status === "failed") {
      throw new Error(
        typeof status.error === "string" ? status.error : "Provider generation failed",
      );
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  throw new Error(`Timed out waiting for ${operationId}`);
}

async function main(): Promise<void> {
  const fixturePath = requiredFlag("--fixture");
  const execute = process.argv.includes("--execute");
  const score = process.argv.includes("--score");
  const orgIdIndex = process.argv.indexOf("--org-id");
  const orgId = orgIdIndex >= 0 ? process.argv[orgIdIndex + 1] : undefined;
  const fixture = JSON.parse(await readFile(path.resolve(fixturePath), "utf8")) as Fixture;

  if (!fixture.seedImageUrl || !fixture.videoPrompt) {
    throw new Error("Fixture requires seedImageUrl and videoPrompt");
  }
  if (score && !orgId) {
    throw new Error("--score requires --org-id so the visual critic remains organization-scoped");
  }

  if (!execute) {
    console.log(JSON.stringify({
      event: "video-provider-benchmark",
      mode: "dry-run",
      providers: PROVIDERS,
      fixture: path.resolve(fixturePath),
      message: "No provider jobs were submitted. Re-run with --execute to spend provider credits.",
    }));
    return;
  }

  const results = [];
  for (const provider of PROVIDERS) {
    const startedAt = Date.now();
    try {
      const { jobId } = await submitVideoJobForProvider(
        provider,
        fixture.seedImageUrl,
        fixture.videoPrompt,
        fixture.referenceUrls ?? [],
        "9:16",
      );
      await waitForCompletion(jobId);
      const generated = await getVideoJobResult(jobId);
      const normalized = await normalizeVideoDuration(
        generated.videoBuffer,
        generated.durationMs,
        { stripAudio: true },
      );
      const media = await inspectVideoMedia(normalized.videoBuffer);
      assertPersonalizedMasterVideo(media);
      const visualQuality = score && orgId
        ? await runVideoOutputCritic({
          orgId,
          videoAssetId: `benchmark:${provider}:${jobId}`,
          videoUrl: `https://benchmark.local/${provider}/${encodeURIComponent(jobId)}`,
          frames: await extractRepresentativeFrames(normalized.videoBuffer, normalized.durationMs),
          tone: "professional",
          setting: "benchmark fixture",
          attempt: 1,
        })
        : null;
      results.push({
        provider,
        passedMediaContract: true,
        operationId: jobId,
        durationMs: media.durationMs,
        width: media.width,
        height: media.height,
        audioStreams: media.audioStreams,
        ...(visualQuality
          ? { criticScore: visualQuality.score, criticPassed: visualQuality.passed, criticIssues: visualQuality.issues }
          : {}),
        elapsedMs: Date.now() - startedAt,
      });
    } catch (error) {
      results.push({
        provider,
        passedMediaContract: false,
        elapsedMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  console.log(JSON.stringify({ event: "video-provider-benchmark", mode: "execute", results }));
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
