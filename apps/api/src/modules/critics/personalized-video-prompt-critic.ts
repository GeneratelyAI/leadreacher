import { z } from "zod";
import { callGroq } from "../../lib/groq.js";
import { extractJsonObject } from "../../lib/llm-json.js";
import { prisma } from "../../lib/prisma.js";
import { StoryboardSceneSchema } from "../agents/video-prompt-agent.js";

const InputSchema = z.object({
  orgId: z.string(),
  templateId: z.string(),
  storyboard: z.array(StoryboardSceneSchema).length(4),
  videoPrompt: z.string(),
  sharedNarration: z.string(),
  tone: z.string(),
  avatar: z.string(),
  setting: z.string(),
  hasLogoReference: z.boolean(),
});
const RawOutput = z.object({ score: z.number().int().min(0).max(10), feedback: z.array(z.string()) });
const Output = RawOutput.extend({ passed: z.boolean() });
type Input = z.infer<typeof InputSchema>;
export type PersonalizedVideoTemplateCriticResult = z.infer<typeof Output>;

const SYSTEM_PROMPT = `You quality-gate a shared B2B personalized-video template before paid generation. Score 0-10. Return valid json.

Check: silent first 1.5 seconds reserved for a later greeting; no lead-specific language; credible shared narration for seconds 1.5-8; consistent spokesperson and setting; clean visual space for an original-logo end card; no invented metrics or claims. The worker, not the model, composites the logo for seconds 8-10. Pass at 7 or higher. Output only {"score": number, "feedback": string[]}.`;

export function normalizePersonalizedVideoTemplateCriticOutput(raw: unknown): PersonalizedVideoTemplateCriticResult {
  const parsed = RawOutput.parse(raw);
  return Output.parse({ ...parsed, passed: parsed.score >= 7 });
}

export async function runPersonalizedVideoTemplateCritic(
  input: Input,
): Promise<PersonalizedVideoTemplateCriticResult> {
  const validated = InputSchema.parse(input);
  const pipelineRun = await prisma.pipelineRun.create({
    data: { orgId: validated.orgId, agentName: "personalized-video-template-critic", input: validated, status: "running" },
  });
  try {
    const storyboard = validated.storyboard
      .map((scene) => `SCENE ${scene.sceneNumber} ${scene.timeRange}: ${scene.imagePrompt}\n${scene.motionNote}`)
      .join("\n\n");
    const raw = await callGroq(
      SYSTEM_PROMPT,
      [{ role: "user", content: `TONE: ${validated.tone}\nAVATAR: ${validated.avatar}\nSETTING: ${validated.setting}\nLOGO: ${validated.hasLogoReference}\n\n${storyboard}\n\nSHARED NARRATION:\n${validated.sharedNarration}\n\nVIDEO PROMPT:\n${validated.videoPrompt}` }],
      512,
      { jsonObject: true },
    );
    const output = normalizePersonalizedVideoTemplateCriticOutput(JSON.parse(extractJsonObject(raw)));
    await prisma.pipelineRun.update({ where: { id: pipelineRun.id }, data: { output, status: "completed" } });
    return output;
  } catch (error) {
    await prisma.pipelineRun.update({
      where: { id: pipelineRun.id },
      data: { status: "failed", error: error instanceof Error ? error.message : String(error) },
    });
    throw error;
  }
}
