import { z } from "zod";
import { callGroq } from "../../lib/groq.js";
import { extractJsonObject } from "../../lib/llm-json.js";
import { prisma } from "../../lib/prisma.js";
import { VideoPromptOutputSchema } from "./video-prompt-agent.js";

const PersonalizedVideoTemplatePromptInput = z.object({
  orgId: z.string(),
  templateId: z.string(),
  seedPrompt: z.string().min(1),
  product: z.string().min(1),
  audience: z.string().min(1),
  tone: z.string().min(1),
  avatar: z.string().min(1),
  setting: z.string().min(1),
  hasLogoReference: z.boolean(),
  feedbackHints: z.array(z.string()).optional(),
});

const PersonalizedVideoTemplatePromptOutput = VideoPromptOutputSchema.extend({
  sharedNarration: z.string().min(30).max(450),
});

type Input = z.infer<typeof PersonalizedVideoTemplatePromptInput>;
export type PersonalizedVideoTemplatePromptResult = z.infer<
  typeof PersonalizedVideoTemplatePromptOutput
> & { imagePrompt: string };

const MAX_VALIDATION_RETRIES = 2;

const SYSTEM_PROMPT = `You direct premium B2B personalized-video templates. The final delivery is ten seconds, but this prompt creates the shared template only and must never mention a specific lead, name, company, or title.

Timing:
1. 0-1.5s: a silent direct-to-camera opening with the consistent spokesperson. This slot is reserved for a lead-specific “Hey {firstName},” audio overlay added later.
2. 1.5-6.5s: visual business pitch. The separate sharedNarration plays here.
3. 6.5-8s: resolve to the supplied logo as a clean end card.
4. 8-10s: the worker holds the final logo frame. Do not add any visual text, numbers, metrics, or invented claims.

Return exactly this JSON shape:
{
  "storyboard": [
    { "sceneNumber": 1, "timeRange": "0-2s", "beat": "hook", "imagePrompt": "<silent direct-to-camera opening still>", "motionNote": "<silent greeting slot, then transition into pitch>" },
    { "sceneNumber": 2, "timeRange": "2-4s", "beat": "problem", "imagePrompt": "<business context>", "motionNote": "<continuous movement>" },
    { "sceneNumber": 3, "timeRange": "4-6s", "beat": "solution", "imagePrompt": "<credible product value>", "motionNote": "<transition to logo>" },
    { "sceneNumber": 4, "timeRange": "6-8s", "beat": "payoff", "imagePrompt": "<clean logo end card>", "motionNote": "<settle on final frame for the 8-10s hold>" }
  ],
  "videoPrompt": "<visual-only Veo direction for the shared 8-second sequence; no spoken dialogue>",
  "sharedNarration": "<6.5-second spoken campaign pitch for seconds 1.5-8; no greeting, no lead-specific language>",
  "hookDescription": "<silent direct-to-camera opening>",
  "ctaDescription": "<logo-only ending>"
}

Output only JSON.`;

function errorText(error: unknown): string {
  if (error instanceof z.ZodError) return JSON.stringify(error.issues);
  return error instanceof Error ? error.message : String(error);
}

export function buildPersonalizedVideoTemplatePromptMessage(input: Input): string {
  const feedback = input.feedbackHints?.length
    ? `\nPREVIOUS ATTEMPT FAILED:\n${input.feedbackHints.map((hint) => `- ${hint}`).join("\n")}`
    : "";

  return `Create a shared personalized-video template. Do not include lead-specific details.

INITIAL CREATIVE DIRECTION: ${input.seedPrompt}
PRODUCT / BUSINESS: ${input.product}
TARGET AUDIENCE: ${input.audience}
TONE: ${input.tone}
AVATAR: ${input.avatar}
SETTING: ${input.setting}
LOGO REFERENCE AVAILABLE: ${input.hasLogoReference ? "yes - preserve it exactly for the final end card" : "no - use no written end-card text"}
${feedback}

The first 1.5 seconds must contain no spoken dialogue. Return JSON only.`;
}

export async function runPersonalizedVideoTemplatePromptAgent(
  input: Input,
): Promise<PersonalizedVideoTemplatePromptResult> {
  const validated = PersonalizedVideoTemplatePromptInput.parse(input);
  const pipelineRun = await prisma.pipelineRun.create({
    data: {
      orgId: validated.orgId,
      agentName: "personalized-video-template-prompt",
      input: validated,
      status: "running",
    },
  });

  try {
    let lastError: unknown = new Error("No response generated");
    for (let attempt = 0; attempt <= MAX_VALIDATION_RETRIES; attempt++) {
      try {
        const raw = await callGroq(
          SYSTEM_PROMPT,
          [{
            role: "user",
            content: `${buildPersonalizedVideoTemplatePromptMessage(validated)}${attempt > 0 ? `\nFix this validation error: ${errorText(lastError)}` : ""}`,
          }],
          2048,
          { jsonObject: true },
        );
        const output = PersonalizedVideoTemplatePromptOutput.safeParse(
          JSON.parse(extractJsonObject(raw)),
        );
        if (!output.success) {
          lastError = output.error;
          continue;
        }

        await prisma.pipelineRun.update({
          where: { id: pipelineRun.id },
          data: { output: output.data, status: "completed" },
        });
        return { ...output.data, imagePrompt: output.data.storyboard[0].imagePrompt };
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError;
  } catch (error) {
    await prisma.pipelineRun.update({
      where: { id: pipelineRun.id },
      data: { status: "failed", error: errorText(error) },
    });
    throw error;
  }
}
