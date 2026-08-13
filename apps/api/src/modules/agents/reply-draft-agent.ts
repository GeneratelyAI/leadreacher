import { z } from "zod";
import { callGroq } from "../../lib/groq.js";
import { extractJsonObject } from "../../lib/llm-json.js";
import { prisma } from "../../lib/prisma.js";

const ReplyDraftAgentInputSchema = z.object({
  orgId: z.string().min(1),
  campaignName: z.string().min(1),
  prospectName: z.string().min(1),
  company: z.string().min(1),
  campaignPromise: z.string().max(280).optional(),
  personalizationContext: z.object({
    angle: z.string().max(80).optional(),
    cta: z.string().max(80).optional(),
    evidenceTypes: z.array(z.string().max(80)).max(3),
  }).optional(),
  goal: z.enum(["answer", "qualify", "book", "close"]).default("answer"),
  conversation: z.array(z.object({
    direction: z.enum(["inbound", "outbound"]),
    content: z.string().min(1),
  })).min(1),
});

export const ReplyDraftAgentOutputSchema = z.object({
  drafts: z.array(z.string().trim().min(1).max(600)).min(1).max(3),
});

export type ReplyDraftAgentResult = z.infer<typeof ReplyDraftAgentOutputSchema>;
type ReplyDraftAgentInput = z.input<typeof ReplyDraftAgentInputSchema>;

const MAX_VALIDATION_RETRIES = 2;

const SYSTEM_PROMPT = `You write concise human-reviewed LinkedIn reply drafts for B2B conversations.

Use only the campaign and conversation facts provided. Write one to three short sentences per draft. Answer the prospect's latest point directly, preserve the campaign promise where relevant, and work toward the supplied GOAL without repeating the original pitch. Be helpful and end with a natural low-commitment next step when appropriate.

Do not claim that a meeting is booked, fabricate outcomes or statistics, use emojis, use em dashes, or mention that you are an AI. These are draft suggestions only. Return valid JSON with this exact shape:
{
  "drafts": ["<reply draft>"]
}`;

function validationErrorText(error: unknown): string {
  if (error instanceof z.ZodError) return JSON.stringify(error.issues);
  return error instanceof Error ? error.message : String(error);
}

export async function runReplyDraftAgent(
  input: ReplyDraftAgentInput,
): Promise<ReplyDraftAgentResult> {
  const validated = ReplyDraftAgentInputSchema.parse(input);
  const pipelineRun = await prisma.pipelineRun.create({
    data: {
      orgId: validated.orgId,
      agentName: "reply-draft",
      input: validated,
      status: "running",
    },
  });

  const conversation = validated.conversation
    .map((message) => `${message.direction === "inbound" ? "PROSPECT" : "OUTBOUND"}: ${message.content}`)
    .join("\n");
  const userMessage = `CAMPAIGN: ${validated.campaignName}
PROSPECT: ${validated.prospectName}
COMPANY: ${validated.company}
GOAL: ${validated.goal}
CAMPAIGN PROMISE: ${validated.campaignPromise ?? "Not supplied"}
PERSONALIZATION CONTEXT: ${JSON.stringify(validated.personalizationContext ?? {})}

CONVERSATION:
${conversation}

Write one to three reply drafts now.`;

  try {
    let lastValidationError: unknown = new Error("No response generated");
    for (let attempt = 0; attempt <= MAX_VALIDATION_RETRIES; attempt += 1) {
      const repairHint = attempt > 0
        ? `\n\nYour previous JSON did not pass validation. Correct it: ${validationErrorText(lastValidationError)}`
        : "";
      try {
        const raw = await callGroq(
          SYSTEM_PROMPT,
          [{ role: "user", content: userMessage + repairHint }],
          700,
          { jsonObject: true },
        );
        const output = ReplyDraftAgentOutputSchema.safeParse(
          JSON.parse(extractJsonObject(raw)),
        );
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
