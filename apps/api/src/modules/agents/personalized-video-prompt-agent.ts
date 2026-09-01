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

export function narrationWordCount(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

export const PersonalizedVideoTemplatePromptOutput = VideoPromptOutputSchema.extend({
  sharedNarration: z.string().min(30).max(180).superRefine((value, ctx) => {
    const words = narrationWordCount(value);
    if (words < 14 || words > 18) {
      ctx.addIssue({
        code: "custom",
        message: `Shared narration must contain 14-18 words, received ${words}`,
      });
    }
  }),
});

type Input = z.infer<typeof PersonalizedVideoTemplatePromptInput>;
export type PersonalizedVideoTemplatePromptResult = z.infer<
  typeof PersonalizedVideoTemplatePromptOutput
> & { imagePrompt: string };

const MAX_VALIDATION_RETRIES = 2;

const SYSTEM_PROMPT = `You direct premium personalized spokesperson advertisements. The final delivery is exactly ten seconds. This prompt creates the shared campaign template and must never mention a specific recipient, recipient company, or recipient title.

HARD OUTPUT CONSTRAINTS:
- storyboard must contain exactly four objects, never three or five
- sceneNumber must be exactly 1, 2, 3, 4 in that order
- beat must be exactly hook, problem, solution, payoff in that order
- every storyboard imagePrompt must be at least 40 characters

Timing:
1. 0-1.5s: hold on an attractive, credible professional spokesperson looking directly into the camera in a busy, authentic setting relevant to the advertiser and industry. Show a natural silent acknowledgment with a closed or minimally moving mouth. This slot is reserved for a lead-specific “Hey {firstName},” audio overlay added later.
2. 1.5-8s: animate a natural professional performance aligned with the separate sharedNarration. Keep the spokesperson, setting, lighting, and visual style consistent.
3. 6.5-8.5s: use a smooth camera pan or theme-relevant transition that supports the advertiser's message. The transition may overlap the end of the narration.
4. 8.5-10s: transition into the original supplied company logo as the exact final frame and preserve its integrity. Do not add any other text, data, numbers, graphics, logos, or invented branding.

IMAGE DIRECTION:
- Scene 1 is the seed-image prompt. It must create the professional spokesperson advertisement image using the supplied company logo only as a brand reference.
- The spokesperson and environment must be relevant to the advertiser and industry.
- Preserve the supplied logo exactly. Do not redraw, reinterpret, distort, or alter it.
- Add no written copy, captions, numbers, extra logos, unrelated images, or decorative graphics.

Return exactly this JSON shape:
{
  "storyboard": [
    { "sceneNumber": 1, "timeRange": "0-1.5s", "beat": "hook", "imagePrompt": "<professional spokesperson in an authentic advertiser-relevant setting; no copy or altered logo>", "motionNote": "<silent greeting slot with minimal mouth movement>" },
    { "sceneNumber": 2, "timeRange": "1.5-4s", "beat": "problem", "imagePrompt": "<spokesperson performance and advertiser-relevant context>", "motionNote": "<natural professional performance aligned with narration>" },
    { "sceneNumber": 3, "timeRange": "4-6.5s", "beat": "solution", "imagePrompt": "<theme-relevant advertiser value scene>", "motionNote": "<smooth camera pan into supporting scene>" },
    { "sceneNumber": 4, "timeRange": "6.5-8.5s", "beat": "payoff", "imagePrompt": "<visual payoff transitioning toward the supplied logo frame>", "motionNote": "<transition into the exact supplied logo at 8.5s>" }
  ],
  "videoPrompt": "<visual-only direction for the complete 10-second spokesperson advertisement and supplied-logo ending>",
  "sharedNarration": "<14-18 word campaign pitch that fits within 6.5 seconds; no greeting or lead-specific language>",
  "hookDescription": "<silent direct-to-camera opening>",
  "ctaDescription": "<exact supplied-logo-only ending from 8.5-10s>"
}

Output only valid json.`;

function errorText(error: unknown): string {
  if (error instanceof z.ZodError) return JSON.stringify(error.issues);
  return error instanceof Error ? error.message : String(error);
}

export function buildPersonalizedVideoTemplatePromptMessage(input: Input): string {
  const feedback = input.feedbackHints?.length
    ? `\nPREVIOUS ATTEMPT FAILED:\n${input.feedbackHints.map((hint) => `- ${hint}`).join("\n")}`
    : "";

  return `Create a shared personalized-video template. Do not include lead-specific details. Return valid json.

Return exactly four storyboard scenes. Do not add a fifth scene or any fields outside the requested JSON shape. Use scene numbers 1, 2, 3, and 4 and beats hook, problem, solution, and payoff in that order. Each imagePrompt must be a detailed still-frame prompt of at least 40 characters.

INITIAL CREATIVE DIRECTION: ${input.seedPrompt}
Treat the initial creative direction as the source of truth. Create a professional spokesperson advertisement tailored to the advertiser and industry. Carry its narration, transition, logo instruction, audience, and timing into the storyboard and shared narration. Do not replace those instructions with generic ad copy.
PRODUCT / BUSINESS: ${input.product}
TARGET AUDIENCE: ${input.audience}
TONE: ${input.tone}
AVATAR: ${input.avatar}
SETTING: ${input.setting}
LOGO REFERENCE AVAILABLE: ${input.hasLogoReference ? "yes - use it as the exact final frame from 8.5-10s and preserve its integrity" : "no - finish cleanly with no written end-card text or invented branding"}
${feedback}

The first 1.5 seconds must contain no spoken dialogue or visible speaking. The spokesperson's mouth must remain closed or move minimally. The sharedNarration must contain 14-18 words and fit naturally within 6.5 seconds. Return JSON only.`;
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
