import { z } from "zod";
import { callGroqVision, type VisionContentPart } from "../../lib/groq.js";
import { extractJsonObject } from "../../lib/llm-json.js";
import { prisma } from "../../lib/prisma.js";

const VideoOutputCriticFrame = z.object({
  label: z.string(),
  mimeType: z.string(),
  data: z.string(),
});

const VideoOutputCriticInput = z.object({
  orgId: z.string(),
  videoAssetId: z.string(),
  videoUrl: z.string().url(),
  frames: z.array(VideoOutputCriticFrame).length(4),
  tone: z.string(),
  setting: z.string(),
  attempt: z.number().int().min(1).default(1),
});

const VideoOutputCriticOutput = z.object({
  score: z.number().int().min(0).max(10),
  passed: z.boolean(),
  issues: z.array(z.string()),
});

type VideoOutputCriticInputType = z.infer<
  typeof VideoOutputCriticInput
>;
type VideoOutputCriticOutputType = z.infer<
  typeof VideoOutputCriticOutput
>;

const SYSTEM_PROMPT = `You are a senior video ad quality reviewer. Your job is to evaluate AI-generated video ads before they are shown to clients.

You will receive four representative frames extracted from a generated video: the opening frame, about 1 second in, the midpoint, and about 2 seconds before the end. Evaluate these frames on a 0-10 scale using this rubric:

RUBRIC (each criterion worth up to 2 points):
1. SUBJECT VISIBILITY - Is the main subject (person or product) clearly visible and in focus? No obscured faces or blurry subjects.
2. NO ARTIFACTS - Do the sampled frames show visual glitches, distortions, or AI generation artifacts such as extra limbs, warped faces, malformed hands, or texture failures?
3. HOOK IN 2s - Does the opening frame and the ~1s frame show something visually compelling enough to stop a scroll?
4. SCENE COHERENCE - Compare the frames. Does the setting and subject remain coherent without sudden scene changes or incoherent backgrounds?
5. PROFESSIONAL QUALITY - Does the video feel premium enough to represent a brand in a paid ad context?

SCORING:
- Score 0-6 (< 7): FAIL - video must be regenerated
- Score 7-10: PASS - approved for client review

Output ONLY valid JSON:
{
  "score": <integer 0-10>,
  "passed": <true if score >= 7, else false>,
  "issues": ["<specific issue 1>", "<specific issue 2>"] // empty array if passed
}`;

export async function runVideoOutputCritic(
  input: VideoOutputCriticInputType,
): Promise<VideoOutputCriticOutputType> {
  const validated = VideoOutputCriticInput.parse(input);

  const userText = `Please evaluate this video ad from the provided extracted frames.

FRAME ORDER:
${validated.frames.map((frame, index) => `${index + 1}. ${frame.label}`).join("\n")}

VIDEO URL FOR TRACEABILITY ONLY: ${validated.videoUrl}
TONE: ${validated.tone || "professional"}
SETTING: ${validated.setting || "office"}
GENERATION ATTEMPT: ${validated.attempt}

Apply the quality rubric to the frames. Output the JSON.`;

  const content: VisionContentPart[] = [
    { type: "text", text: userText },
    ...validated.frames.map((frame) => ({
      type: "image" as const,
      mimeType: frame.mimeType,
      data: frame.data,
    })),
  ];

  const pipelineRun = await prisma.pipelineRun.create({
    data: {
      orgId: validated.orgId,
      agentName: "video-output-critic",
      input: {
        ...validated,
        frames: validated.frames.map((frame) => ({
          label: frame.label,
          mimeType: frame.mimeType,
          bytesBase64: frame.data.length,
        })),
      },
      status: "running",
    },
  });

  try {
    // V1 quality gate evaluates static frames, not actual motion. It will not
    // catch animation-only artifacts such as morphing or stuttering between frames.
    const rawResponse = await callGroqVision(
      SYSTEM_PROMPT,
      [{ role: "user", content }],
      512,
      { jsonObject: true },
    );

    const raw = JSON.parse(extractJsonObject(rawResponse)) as {
      score: number;
      passed: boolean;
      issues: string[];
    };

    const output = VideoOutputCriticOutput.parse({
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
