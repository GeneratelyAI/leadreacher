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

const STORYBOARD_BEATS = ["hook", "problem", "solution", "payoff"] as const;

export const StoryboardSceneSchema = z.object({
  sceneNumber: z.number().int().min(1).max(4),
  timeRange: z.string(),
  beat: z.enum(STORYBOARD_BEATS),
  imagePrompt: z.string().min(40),
  motionNote: z.string().min(10),
});

export const VideoPromptOutputSchema = z.object({
  storyboard: z
    .array(StoryboardSceneSchema)
    .length(4)
    .superRefine((scenes, ctx) => {
      scenes.forEach((scene, index) => {
        const expectedSceneNumber = index + 1;
        const expectedBeat = STORYBOARD_BEATS[index];

        if (scene.sceneNumber !== expectedSceneNumber) {
          ctx.addIssue({
            code: "custom",
            path: [index, "sceneNumber"],
            message: `Scene ${expectedSceneNumber} must appear in position ${expectedSceneNumber}`,
          });
        }
        if (scene.beat !== expectedBeat) {
          ctx.addIssue({
            code: "custom",
            path: [index, "beat"],
            message: `Scene ${expectedSceneNumber} must use the ${expectedBeat} beat`,
          });
        }
      });
    }),
  videoPrompt: z.string().min(80),
  hookDescription: z.string().min(10),
  ctaDescription: z.string().min(10),
});

export type StoryboardScene = z.infer<typeof StoryboardSceneSchema>;
export type VideoPromptOutput = z.infer<typeof VideoPromptOutputSchema>;

type VideoPromptInputType = z.infer<typeof VideoPromptInput>;

/**
 * `imagePrompt` is a temporary worker compatibility bridge. The canonical LLM
 * output remains the storyboard; the existing one-image Veo path receives only
 * scene 1 until multi-image orchestration is implemented separately.
 */
export type VideoPromptAgentResult = VideoPromptOutput & {
  imagePrompt: string;
};

const MAX_VALIDATION_RETRIES = 2;

const SYSTEM_PROMPT = `You are a world-class outbound campaign video director specialising in premium 10-second social videos sent directly to prospects.

Create a four-scene storyboard for the first 8 seconds of the final 10-second sequence. The worker preserves the final frame as a 2-second branded hold (8-10s):
1. hook (0-2s): a scroll-stopping opening visual or moment that grabs attention before selling.
2. problem (2-4s): establish a pain point or context the audience immediately recognises.
3. solution (4-6s): show the product or service resolving that pain point; this is the demo beat.
4. payoff (6-8s): show the result and a clear call-to-action, ending on the brand.

For every storyboard scene:
- imagePrompt is a cinematic still-frame prompt with a subject, action or moment, setting, lighting, camera angle, composition, and premium social-video visual detail.
- Each imagePrompt must be visibly distinct from every other scene: use different framing, action, or moment. Do not restate one image with small wording changes.
- motionNote explains how that scene animates and transitions into the next scene through a camera move, cut, morph, or purposeful motion. For the payoff, describe the final branded hold or exit.
- Keep the requested tone, avatar, and setting faithful across all scenes unless a deliberate transition explains a change.

videoPrompt is the connective narrative across all four scenes for a text-to-video tool. It must describe the generated 8-second sequence, which resolves into the final 2-second branded hold, not a disconnected standalone paragraph.

Rules:
- The video must feel premium and social-first, never like a tutorial or a loose concept paragraph.
- Every second must be purposeful; no dead frames.
- Camera motion must be smooth and intentional.
- Keep the requested tone, avatar style, and setting faithful.

You MUST return valid JSON with exactly these fields and no omissions:
{
  "storyboard": [
    {
      "sceneNumber": 1,
      "timeRange": "0-2s",
      "beat": "hook",
      "imagePrompt": "<visually distinct cinematic still-frame prompt>",
      "motionNote": "<motion and transition to scene 2>"
    },
    {
      "sceneNumber": 2,
      "timeRange": "2-4s",
      "beat": "problem",
      "imagePrompt": "<visually distinct cinematic still-frame prompt>",
      "motionNote": "<motion and transition to scene 3>"
    },
    {
      "sceneNumber": 3,
      "timeRange": "4-6s",
      "beat": "solution",
      "imagePrompt": "<visually distinct cinematic still-frame prompt>",
      "motionNote": "<motion and transition to scene 4>"
    },
    {
      "sceneNumber": 4,
      "timeRange": "6-8s",
      "beat": "payoff",
      "imagePrompt": "<visually distinct cinematic still-frame prompt>",
      "motionNote": "<final branded hold or exit>"
    }
  ],
  "videoPrompt": "<connective generated 8-second narrative that resolves into a final 2-second brand hold>",
  "hookDescription": "<scroll-stopping first two seconds>",
  "ctaDescription": "<clear final action and brand ending>"
}

Output ONLY a JSON object with no markdown or explanation.`;

function validationErrorText(error: unknown): string {
  if (error instanceof z.ZodError) {
    return JSON.stringify(error.issues, null, 2);
  }

  return error instanceof Error ? error.message : String(error);
}

export async function runVideoPromptAgent(
  input: VideoPromptInputType,
): Promise<VideoPromptAgentResult> {
  const validated = VideoPromptInput.parse(input);

  const feedbackSection = validated.feedbackHints?.length
    ? `\nPREVIOUS ATTEMPT FAILED. Fix these issues:\n${validated.feedbackHints
        .map((feedback) => `- ${feedback}`)
        .join("\n")}\n`
    : "";

  const userMessage = `Generate a four-scene storyboard for the generated 8 seconds of this final 10-second ad. The final frame will hold on screen for seconds 8-10:

INITIAL CREATIVE DIRECTION: ${validated.seedPrompt}

Treat the initial creative direction as a production brief. Carry its creative brief, narration direction, transition direction, logo instruction, audience, and timing into the storyboard and videoPrompt. Do not replace those instructions with generic ad copy.

PRODUCT / BUSINESS: ${validated.product}
TARGET AUDIENCE: ${validated.audience}
TONE: ${validated.tone}
AVATAR: ${validated.avatar}
SETTING: ${validated.setting}
${feedbackSection}
Make the four scene stills a coherent visual sequence and use the exact commercial beat order from the system prompt.

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
    let lastValidationError: unknown = new Error("No response generated");

    for (let attempt = 0; attempt <= MAX_VALIDATION_RETRIES; attempt++) {
      const repairSection =
        attempt > 0
          ? `\n\nYour previous JSON failed validation. Fix the JSON and return every required field. Validation error:\n${validationErrorText(lastValidationError)}`
          : "";

      try {
        const raw = await callGroq(
          SYSTEM_PROMPT,
          [{ role: "user", content: userMessage + repairSection }],
          2048,
          { jsonObject: true },
        );
        const parsedResponse = JSON.parse(extractJsonObject(raw));
        const validatedOutput = VideoPromptOutputSchema.safeParse(parsedResponse);
        if (!validatedOutput.success) {
          lastValidationError = validatedOutput.error;
          continue;
        }

        const output = validatedOutput.data;
        await prisma.pipelineRun.update({
          where: { id: pipelineRun.id },
          data: { output, status: "completed" },
        });

        return {
          ...output,
          imagePrompt: output.storyboard[0].imagePrompt,
        };
      } catch (error) {
        lastValidationError = error;
      }
    }

    throw lastValidationError;
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
