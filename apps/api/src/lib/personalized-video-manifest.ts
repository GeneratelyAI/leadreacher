import { createHash } from "node:crypto";
import { z } from "zod";

export const PERSONALIZED_RENDER_MANIFEST_VERSION = 1;

const StoryboardSceneSchema = z.object({
  sceneNumber: z.number().int().min(1).max(4),
  timeRange: z.string().min(1),
  beat: z.enum(["hook", "problem", "solution", "payoff"]),
  imagePrompt: z.string().min(40),
  motionNote: z.string().min(1),
});

export const PersonalizedRenderManifestSchema = z.object({
  version: z.literal(PERSONALIZED_RENDER_MANIFEST_VERSION),
  pipeline: z.literal("personalized"),
  renderingMode: z.literal("single-shared-master"),
  timeline: z.object({
    greeting: z.literal("0.0-1.5s"),
    narration: z.literal("1.5-8.0s"),
    sourceLogoEndCard: z.enum(["8.0-10.0s", "8.5-10.0s"]),
  }),
  creativeBrief: z.object({
    storyboard: z.array(StoryboardSceneSchema).length(4),
    imagePrompt: z.string().min(40),
    videoPrompt: z.string().min(1),
    sharedNarration: z.string().min(1),
  }),
  assets: z.object({
    seedImageUrl: z.string().url().optional(),
    seedImageSha256: z.string().length(64).optional(),
    sharedNarrationUrl: z.string().url().optional(),
    sharedNarrationSha256: z.string().length(64).optional(),
    logoUrl: z.string().url().optional(),
    logoSha256: z.string().length(64).optional(),
    masterVideoUrl: z.string().url().optional(),
    masterVideoSha256: z.string().length(64).optional(),
    deliveryVideoSha256: z.string().length(64).optional(),
  }),
  provider: z.object({
    name: z.enum(["veo", "omni"]),
    operationId: z.string().min(1).optional(),
  }),
  quality: z.object({
    durationMs: z.number().int().positive().optional(),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
    sourceAudioStreams: z.number().int().nonnegative().optional(),
    outputAudioStreams: z.number().int().nonnegative().optional(),
    criticScore: z.number().int().min(0).max(10).optional(),
    criticPassed: z.boolean().optional(),
    greetingDurationMs: z.number().int().nonnegative().optional(),
    narrationDurationMs: z.number().int().nonnegative().optional(),
  }).default({}),
});

export type PersonalizedRenderManifest = z.infer<typeof PersonalizedRenderManifestSchema>;

export function sha256(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

export function createPersonalizedTemplateManifest(input: {
  storyboard: PersonalizedRenderManifest["creativeBrief"]["storyboard"];
  imagePrompt: string;
  videoPrompt: string;
  sharedNarration: string;
  seedImageUrl: string;
  seedImage: Buffer;
  sharedNarrationUrl: string;
  sharedNarrationAudio: Buffer;
  narrationDurationMs?: number;
  logoUrl?: string | null;
  provider: "veo" | "omni";
}): PersonalizedRenderManifest {
  return PersonalizedRenderManifestSchema.parse({
    version: PERSONALIZED_RENDER_MANIFEST_VERSION,
    pipeline: "personalized",
    renderingMode: "single-shared-master",
    timeline: {
      greeting: "0.0-1.5s",
      narration: "1.5-8.0s",
      sourceLogoEndCard: "8.5-10.0s",
    },
    creativeBrief: {
      storyboard: input.storyboard,
      imagePrompt: input.imagePrompt,
      videoPrompt: input.videoPrompt,
      sharedNarration: input.sharedNarration,
    },
    assets: {
      seedImageUrl: input.seedImageUrl,
      seedImageSha256: sha256(input.seedImage),
      sharedNarrationUrl: input.sharedNarrationUrl,
      sharedNarrationSha256: sha256(input.sharedNarrationAudio),
      ...(input.logoUrl ? { logoUrl: input.logoUrl } : {}),
    },
    provider: { name: input.provider },
    quality: {
      ...(input.narrationDurationMs !== undefined
        ? { narrationDurationMs: input.narrationDurationMs }
        : {}),
    },
  });
}

export function updatePersonalizedTemplateManifest(
  manifest: unknown,
  update: {
    assets?: Partial<PersonalizedRenderManifest["assets"]>;
    provider?: Partial<PersonalizedRenderManifest["provider"]>;
    quality?: Partial<PersonalizedRenderManifest["quality"]>;
  },
): PersonalizedRenderManifest {
  const current = PersonalizedRenderManifestSchema.parse(manifest);
  return PersonalizedRenderManifestSchema.parse({
    ...current,
    ...update,
    assets: { ...current.assets, ...update.assets },
    provider: { ...current.provider, ...update.provider },
    quality: { ...current.quality, ...update.quality },
  });
}
