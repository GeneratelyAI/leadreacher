import { z } from "zod";
import {
  StoryboardSceneSchema,
  type StoryboardScene,
} from "../agents/video-prompt-agent.js";
import { callGroq } from "../../lib/groq.js";
import { extractJsonObject } from "../../lib/llm-json.js";
import { prisma } from "../../lib/prisma.js";

const StoryboardVideoPromptCriticInput = z.object({
  orgId: z.string(),
  videoAssetId: z.string(),
  storyboard: z.array(StoryboardSceneSchema).length(4),
  videoPrompt: z.string(),
  hookDescription: z.string(),
  ctaDescription: z.string(),
  tone: z.string(),
  avatar: z.string(),
  setting: z.string(),
});

// The worker still forwards a single seed prompt until its multi-scene Veo
// orchestration is designed. Keep this input only as a temporary bridge.
const LegacyVideoPromptCriticInput = z.object({
  orgId: z.string(),
  videoAssetId: z.string(),
  imagePrompt: z.string(),
  videoPrompt: z.string(),
  tone: z.string(),
  avatar: z.string(),
  setting: z.string(),
});

const VideoPromptCriticInput = z.union([
  StoryboardVideoPromptCriticInput,
  LegacyVideoPromptCriticInput,
]);

const VideoPromptCriticRawOutput = z.object({
  score: z.number().int().min(0).max(10),
  feedback: z.array(z.string()),
});

const VideoPromptCriticOutput = VideoPromptCriticRawOutput.extend({
  passed: z.boolean(),
});

type StoryboardVideoPromptCriticInputType = z.infer<
  typeof StoryboardVideoPromptCriticInput
>;
type LegacyVideoPromptCriticInputType = z.infer<
  typeof LegacyVideoPromptCriticInput
>;
type VideoPromptCriticInputType = z.infer<typeof VideoPromptCriticInput>;
type VideoPromptCriticOutputType = z.infer<typeof VideoPromptCriticOutput>;

const STORYBOARD_SYSTEM_PROMPT = `You are a senior outbound campaign video creative director. Your job is to quality-gate a four-scene storyboard before it is used for a 10-second direct outreach video. The four scenes cover the generated eight seconds and the final frame holds for seconds 8-10.

Evaluate the storyboard and its connective video prompt on a 0-10 scale using this exact rubric:

RUBRIC (each criterion is worth up to 2 points):
1. SCENE DISTINCTNESS - Are all four image prompts visually distinct rather than near-duplicates?
2. BEAT STRUCTURE - Does each scene deliver its assigned beat: hook grabs attention, problem shows a real pain point, solution clearly demos value, and payoff includes an explicit CTA?
3. SEQUENCE COHERENCE - Do the motion notes and overall video prompt read as one continuous generated eight-second flow that resolves naturally into the final two-second hold, rather than four disconnected images?
4. VISUAL SPECIFICITY - Is each image prompt cinematic and specific about subject, lighting, camera angle, and composition rather than generic?
5. TONE/AVATAR/SETTING MATCH - Do all four scenes consistently match the requested tone, avatar, and setting unless a deliberate motion-noted transition explains a change?

SCORING:
- Score 0-6 (< 7): FAIL - storyboard needs regeneration.
- Score 7-10: PASS - storyboard is approved for video generation.

Deduct points for repetitive scenes, vague imagery, missing or misordered beats, disconnected transitions, or a missing hook/CTA.

Output ONLY valid JSON:
{
  "score": <integer 0-10>,
  "passed": <true if score >= 7, else false>,
  "feedback": ["<specific issue 1>", "<specific issue 2>"]
}`;

const LEGACY_SYSTEM_PROMPT = `You are a senior outbound campaign video creative director. Evaluate a temporary single-seed-frame compatibility prompt for a premium 10-second social outreach video on a 0-10 scale. The generated sequence lasts eight seconds and the final frame holds for two seconds. Check visual specificity, narrative motion, hook, CTA, and tone/avatar/setting match. Score 7 or higher passes. Output ONLY valid JSON with score, passed, and feedback.`;

function isStoryboardInput(
  input: VideoPromptCriticInputType,
): input is StoryboardVideoPromptCriticInputType {
  return "storyboard" in input;
}

function formatStoryboard(storyboard: StoryboardScene[]): string {
  return storyboard
    .map(
      (scene) =>
        `SCENE ${scene.sceneNumber} (${scene.timeRange}) - ${scene.beat.toUpperCase()}\nIMAGE PROMPT: ${scene.imagePrompt}\nMOTION / TRANSITION: ${scene.motionNote}`,
    )
    .join("\n\n");
}

function buildUserMessage(input: VideoPromptCriticInputType): string {
  if (!isStoryboardInput(input)) {
    return `Evaluate this temporary single-seed compatibility prompt:\n\nTONE: ${input.tone}\nAVATAR: ${input.avatar}\nSETTING: ${input.setting}\n\nIMAGE PROMPT:\n${input.imagePrompt}\n\nVIDEO PROMPT:\n${input.videoPrompt}\n\nApply the compatibility rubric and output the JSON.`;
  }

  return `Evaluate this four-scene commercial storyboard:\n\nTONE: ${input.tone}\nAVATAR: ${input.avatar}\nSETTING: ${input.setting}\nHOOK DESCRIPTION: ${input.hookDescription}\nCTA DESCRIPTION: ${input.ctaDescription}\n\n${formatStoryboard(input.storyboard)}\n\nCONNECTIVE VIDEO PROMPT:\n${input.videoPrompt}\n\nApply the storyboard rubric and output the JSON.`;
}

export function normalizeVideoPromptCriticOutput(
  raw: unknown,
): VideoPromptCriticOutputType {
  const parsed = VideoPromptCriticRawOutput.parse(raw);
  return VideoPromptCriticOutput.parse({
    ...parsed,
    passed: parsed.score >= 7,
  });
}

export async function runVideoPromptCritic(
  input: VideoPromptCriticInputType,
): Promise<VideoPromptCriticOutputType> {
  const validated = VideoPromptCriticInput.parse(input);

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
      isStoryboardInput(validated)
        ? STORYBOARD_SYSTEM_PROMPT
        : LEGACY_SYSTEM_PROMPT,
      [{ role: "user", content: buildUserMessage(validated) }],
      512,
      { jsonObject: true },
    );
    const output = normalizeVideoPromptCriticOutput(
      JSON.parse(extractJsonObject(rawResponse)),
    );

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
