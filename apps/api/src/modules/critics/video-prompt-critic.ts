import { z } from "zod";
import { callGroq } from "../../lib/groq.js";
import { extractJsonObject } from "../../lib/llm-json.js";
import { prisma } from "../../lib/prisma.js";

const VideoPromptCriticInput = z.object({
  orgId: z.string(),
  videoAssetId: z.string(),
  imagePrompt: z.string(),
  videoPrompt: z.string(),
  tone: z.string(),
  avatar: z.string(),
  setting: z.string(),
});

const VideoPromptCriticOutput = z.object({
  score: z.number().int().min(0).max(10),
  passed: z.boolean(),
  feedback: z.array(z.string()),
});

type VideoPromptCriticInputType = z.infer<
  typeof VideoPromptCriticInput
>;
type VideoPromptCriticOutputType = z.infer<
  typeof VideoPromptCriticOutput
>;

const SYSTEM_PROMPT = `You are a senior video ad creative director. Your job is to quality-gate AI-generated prompts before they are sent to video generation.

Evaluate the IMAGE PROMPT and VIDEO PROMPT together on a 0-10 scale using this exact rubric:

RUBRIC (each criterion is worth up to 2 points):
1. VISUAL SPECIFICITY - Is the image prompt cinematic, detailed, and non-generic? Does it describe subject, lighting, camera angle, and atmosphere?
2. CONCRETE MOTION - Does the video prompt describe second-by-second motion? Is it specific about camera moves, subject action, and timing?
3. HOOK IN 2s - Does the video start with a clear, scroll-stopping hook in the first 2 seconds? Is it explicitly described?
4. CTA IN LAST 2s - Is there a clear call-to-action or payoff in the final 2 seconds?
5. TONE MATCH - Do both prompts faithfully match the requested tone, avatar style, and setting?

SCORING:
- Score 0-6 (< 7): FAIL - prompts need regeneration
- Score 7-10: PASS - approved for video generation

Deduct points for: vague language, generic descriptions, missing timing cues, tone mismatch, missing hook/CTA.

Output ONLY valid JSON:
{
  "score": <integer 0-10>,
  "passed": <true if score >= 7, else false>,
  "feedback": ["<specific issue 1>", "<specific issue 2>"] // empty array if passed
}`;

export async function runVideoPromptCritic(
  input: VideoPromptCriticInputType,
): Promise<VideoPromptCriticOutputType> {
  const validated = VideoPromptCriticInput.parse(input);

  const userMessage = `Evaluate these prompts:

TONE: ${validated.tone}
AVATAR: ${validated.avatar}
SETTING: ${validated.setting}

IMAGE PROMPT:
${validated.imagePrompt}

VIDEO PROMPT:
${validated.videoPrompt}

Apply the rubric and output the JSON.`;

  const pipelineRun = await prisma.pipelineRun.create({
    data: {
      orgId: validated.orgId,
      agentName: "video-prompt-critic",
      input: validated,
      status: "running",
    },
  });

  try {
    const rawResponse = await callGroq(
      SYSTEM_PROMPT,
      [{ role: "user", content: userMessage }],
      512,
      { jsonObject: true },
    );

    const raw = JSON.parse(extractJsonObject(rawResponse)) as {
      score: number;
      passed: boolean;
      feedback: string[];
    };

    const output = VideoPromptCriticOutput.parse({
      ...raw,
      passed: raw.score >= 7,
    });

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
