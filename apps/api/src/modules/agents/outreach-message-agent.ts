import { z } from "zod";
import { callGroq } from "../../lib/groq.js";
import { extractJsonObject } from "../../lib/llm-json.js";
import { prisma } from "../../lib/prisma.js";

const OutreachMessageInputSchema = z.object({
  orgId: z.string().min(1),
  product: z.string().min(1),
  audience: z.string().min(1),
  tone: z.enum(["professional", "casual", "aggressive"]),
});

function countPlaceholder(message: string, placeholder: string): number {
  return message.split(placeholder).length - 1;
}

export const OutreachMessageOutputSchema = z
  .object({
    message: z.string().trim().min(1).max(1000),
  })
  .superRefine(({ message }, ctx) => {
    for (const placeholder of ["{{FirstName}}", "{{Company}}"] as const) {
      if (countPlaceholder(message, placeholder) !== 1) {
        ctx.addIssue({
          code: "custom",
          path: ["message"],
          message: `${placeholder} must appear exactly once`,
        });
      }
    }
  });

export type OutreachMessageAgentResult = z.infer<typeof OutreachMessageOutputSchema>;
type OutreachMessageAgentInput = z.infer<typeof OutreachMessageInputSchema>;

const MAX_VALIDATION_RETRIES = 2;

const SYSTEM_PROMPT = `You write concise first-touch LinkedIn outreach messages for a B2B business.

Write three to five short lines. The message must contain the literal placeholders {{FirstName}} and {{Company}} exactly once each. Match the requested tone, state the value proposition plainly, and close with a low-commitment call to action.

Do not use emojis, em dashes, fabricated statistics, or markdown. Return only valid JSON with exactly this shape:
{
  "message": "<outreach message>"
}`;

function validationErrorText(error: unknown): string {
  if (error instanceof z.ZodError) {
    return JSON.stringify(error.issues);
  }

  return error instanceof Error ? error.message : String(error);
}

export async function runOutreachMessageAgent(
  input: OutreachMessageAgentInput,
): Promise<OutreachMessageAgentResult> {
  const validated = OutreachMessageInputSchema.parse(input);
  const pipelineRun = await prisma.pipelineRun.create({
    data: {
      orgId: validated.orgId,
      agentName: "outreach-message",
      input: validated,
      status: "running",
    },
  });

  const userMessage = `PRODUCT: ${validated.product}
AUDIENCE: ${validated.audience}
TONE: ${validated.tone}

Write the outreach message now.`;

  try {
    let lastValidationError: unknown = new Error("No response generated");

    for (let attempt = 0; attempt <= MAX_VALIDATION_RETRIES; attempt++) {
      const repairHint =
        attempt > 0
          ? `\n\nYour previous JSON did not pass validation. Correct it: ${validationErrorText(lastValidationError)}`
          : "";
      try {
        const raw = await callGroq(
          SYSTEM_PROMPT,
          [{ role: "user", content: userMessage + repairHint }],
          512,
          { jsonObject: true },
        );
        const parsed = JSON.parse(extractJsonObject(raw));
        const output = OutreachMessageOutputSchema.safeParse(parsed);
        if (!output.success) {
          lastValidationError = output.error;
          continue;
        }

        await prisma.pipelineRun.update({
          where: { id: pipelineRun.id },
          data: { output: output.data, status: "completed" },
        });
        return output.data;
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
