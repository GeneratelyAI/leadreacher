import { z } from "zod";
import { callGroq } from "../../lib/groq.js";
import { extractJsonObject } from "../../lib/llm-json.js";
import { prisma } from "../../lib/prisma.js";

const VideoPromptInput = z.object({
  orgId: z.string(),
  videoAssetId: z.string(),
  seedPrompt: z.string().min(1),
  product: z.string(),
  audience: z.string(),
  tone: z.string(),
  avatar: z.string(),
  setting: z.string(),
  feedbackHints: z.array(z.string()).optional(),
});

const VideoPromptOutput = z.object({
  imagePrompt: z.string().min(50),
  videoPrompt: z.string().min(50),
  motionDescription: z.string().min(20),
  hookDescription: z.string().min(10),
  ctaDescription: z.string().min(10),
});

type VideoPromptInputType = z.infer<typeof VideoPromptInput>;
type VideoPromptOutputType = z.infer<typeof VideoPromptOutput>;

const MAX_VALIDATION_RETRIES = 2;

const SYSTEM_PROMPT = `You are a world-class video ad director specialising in 8-second social video ads.

Given campaign context and an initial creative direction, your task is to write:
1. A precise IMAGE PROMPT for Imagen that creates the seed frame - describing subject, lighting, camera angle, environment, and atmosphere.
2. A precise VIDEO PROMPT for Veo 3.1 that animates from the seed frame - describing exactly how the scene moves, what action occurs, and how it evolves over 8 seconds.
3. A MOTION DESCRIPTION - the specific camera movement and subject motion (e.g., "slow push-in on subject, subtle hand gesture at 2s, text reveal at 5s").
4. A HOOK DESCRIPTION - what happens in the first 2 seconds to stop the scroll.
5. A CTA DESCRIPTION - how the video ends and what action it drives.

Rules:
- The video must feel like a premium social ad (not a demo or tutorial)
- Every second of the 8s must be purposeful - no dead frames
- Camera motion should be smooth, intentional (handheld is fine if it matches tone)
- Match the exact tone and avatar style from context

You MUST return valid JSON with exactly these fields, no omissions:
{
  "imagePrompt": "<detailed Imagen seed-frame prompt including subject, setting, camera, lighting, and composition>",
  "videoPrompt": "<detailed Veo 3.1 animation prompt covering the full 8 seconds>",
  "motionDescription": "<camera and subject motion breakdown>",
  "hookDescription": "<what happens in the first 2 seconds>",
  "ctaDescription": "<how the video ends and what action it drives>"
}

Output ONLY a JSON object - no markdown, no explanation:
{
  "imagePrompt": "<full Imagen prompt for the seed frame>",
  "videoPrompt": "<full Veo 3.1 prompt describing all 8 seconds>",
  "motionDescription": "<camera + subject motion breakdown>",
  "hookDescription": "<what happens in first 2 seconds>",
  "ctaDescription": "<how the video ends and what action it drives>"
}`;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringField(
  record: Record<string, unknown> | null,
  key: string,
): string | undefined {
  const value = record?.[key];
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function validationErrorText(error: unknown): string {
  if (error instanceof z.ZodError) {
    return JSON.stringify(error.issues, null, 2);
  }

  return error instanceof Error ? error.message : String(error);
}

function buildFallbackImagePrompt(
  input: VideoPromptInputType,
  videoPrompt: string,
): string {
  return [
    "Professional vertical 9:16 seed frame for an 8-second B2B social video ad.",
    `Show ${input.avatar} in ${input.setting}, composed as a premium brand advertisement for ${input.product}.`,
    `The audience is ${input.audience}, and the tone should feel ${input.tone}.`,
    `Use the initial creative direction as visual context: ${input.seedPrompt}.`,
    `Anchor the first frame to this motion plan: ${videoPrompt.slice(0, 500)}.`,
    "Use clean composition, sharp subject focus, natural professional lighting, modern office or SaaS dashboard visual cues, and no text-heavy clutter.",
  ].join(" ");
}

async function logImagePromptFallback(
  input: VideoPromptInputType,
  validationError: string,
): Promise<void> {
  await prisma.auditLog.create({
    data: {
      orgId: input.orgId,
      action: "video.prompt.fallback",
      resource: "VideoAsset",
      resourceId: input.videoAssetId,
      metadata: {
        path: "video-prompt-agent-image-prompt-fallback",
        error: validationError,
      },
    },
  });
}

export async function runVideoPromptAgent(
  input: VideoPromptInputType,
): Promise<VideoPromptOutputType> {
  const validated = VideoPromptInput.parse(input);

  const feedbackSection = validated.feedbackHints?.length
    ? `\nPREVIOUS ATTEMPT FAILED. Fix these issues:\n${validated.feedbackHints
        .map((feedback) => `- ${feedback}`)
        .join("\n")}\n`
    : "";

  const userMessage = `Generate image and video prompts for this 8-second ad:

INITIAL CREATIVE DIRECTION: ${validated.seedPrompt}

PRODUCT / BUSINESS: ${validated.product}
TARGET AUDIENCE: ${validated.audience}
TONE: ${validated.tone}
AVATAR: ${validated.avatar}
SETTING: ${validated.setting}
${feedbackSection}
The video starts exactly from the seed frame described by the image prompt. Animate it into a compelling 8-second ad.

Output the JSON object only.`;

  const pipelineRun = await prisma.pipelineRun.create({
    data: {
      orgId: validated.orgId,
      agentName: "video-prompt",
      input: validated,
      status: "running",
    },
  });

  try {
    let parsedResponse: unknown;
    let lastValidationError: unknown;

    for (let attempt = 0; attempt <= MAX_VALIDATION_RETRIES; attempt++) {
      const repairSection =
        attempt > 0
          ? `\n\nYour previous JSON failed validation. Fix the JSON and return every required field. Validation error:\n${validationErrorText(lastValidationError)}`
          : "";

      const raw = await callGroq(
        SYSTEM_PROMPT,
        [{ role: "user", content: userMessage + repairSection }],
        2048,
        { jsonObject: true },
      );

      parsedResponse = JSON.parse(extractJsonObject(raw));
      const validatedOutput = VideoPromptOutput.safeParse(parsedResponse);
      if (validatedOutput.success) {
        await prisma.pipelineRun.update({
          where: { id: pipelineRun.id },
          data: { output: validatedOutput.data, status: "completed" },
        });

        return validatedOutput.data;
      }

      lastValidationError = validatedOutput.error;
    }

    const responseRecord = asRecord(parsedResponse);
    const imagePrompt = stringField(responseRecord, "imagePrompt");
    const videoPrompt = stringField(responseRecord, "videoPrompt");
    const shouldFallbackImagePrompt = !imagePrompt && videoPrompt;

    if (!shouldFallbackImagePrompt) {
      throw lastValidationError;
    }

    const output = VideoPromptOutput.parse({
      ...responseRecord,
      imagePrompt: buildFallbackImagePrompt(validated, videoPrompt),
    });

    await logImagePromptFallback(validated, validationErrorText(lastValidationError));

    await prisma.pipelineRun.update({
      where: { id: pipelineRun.id },
      data: { output, status: "completed" },
    });

    return output;
  } catch (error) {
    await prisma.pipelineRun.update({
      where: { id: pipelineRun.id },
      data: {
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      },
    });
    throw error;
  }
}
