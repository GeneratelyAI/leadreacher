import { z } from "zod";
import { callGroq } from "../../lib/groq.js";
import { extractJsonObject } from "../../lib/llm-json.js";
import { prisma } from "../../lib/prisma.js";

const ChannelMetricSchema = z.object({
  channel: z.string().min(1),
  sent: z.number().int().nonnegative(),
  replies: z.number().int().nonnegative(),
});

const MessageMetricSchema = z.object({
  message: z.string().min(1).max(120),
  sent: z.number().int().positive(),
  replies: z.number().int().nonnegative(),
  replyRate: z.number().min(0).max(100),
});

const PersonalizationSegmentSchema = z.object({
  angle: z.string().min(1).max(80),
  cta: z.string().min(1).max(80),
  evidenceTypes: z.array(z.string().min(1).max(80)).max(3),
  sent: z.number().int().positive(),
  replies: z.number().int().nonnegative(),
  replyRate: z.number().min(0).max(100),
});

const InsightAgentInputSchema = z.object({
  orgId: z.string().min(1),
  campaignId: z.string().min(1),
  campaignName: z.string().min(1),
  totalSent: z.number().int().nonnegative(),
  totalReplies: z.number().int().nonnegative(),
  replyRate: z.number().min(0).max(100),
  channels: z.array(ChannelMetricSchema),
  topMessages: z.array(MessageMetricSchema).max(3),
  bottomMessages: z.array(MessageMetricSchema).max(3),
  personalizationSegments: z.array(PersonalizationSegmentSchema).max(6).default([]),
});

export const InsightAgentOutputSchema = z.object({
  whatsWorking: z.array(z.string().min(10)).min(1).max(5),
  whatsNotWorking: z.array(z.string().min(10)).min(1).max(5),
  whatToDoNext: z
    .array(
      z.object({
        action: z.string().min(10).max(200),
        reason: z.string().min(10).max(200),
        priority: z.union([z.literal(1), z.literal(2), z.literal(3)]),
      }),
    )
    .min(1)
    .max(5),
});

export type InsightAgentInput = z.input<typeof InsightAgentInputSchema>;
export type InsightAgentResult = z.infer<typeof InsightAgentOutputSchema>;

const MAX_VALIDATION_RETRIES = 2;

const SYSTEM_PROMPT = `You narrate B2B outreach performance using only the metrics supplied in the user input.

Every claim must be directly supported by those metrics. Use only numbers present in the input. Do not invent trends, forecasts, sentiment, benchmarks, confidence, causes, or facts. Do not give generic advice. Refer to the exact campaign, channels, message excerpts, and personalization segments provided. A personalization segment is a compact tag, not a customer fact.

Return up to five concise items for each section. Priority 1 is the biggest lever. Return only valid JSON with this exact shape:
{
  "whatsWorking": ["..."],
  "whatsNotWorking": ["..."],
  "whatToDoNext": [{ "action": "...", "reason": "...", "priority": 1 }]
}`;

function validationErrorText(error: unknown): string {
  if (error instanceof z.ZodError) {
    return JSON.stringify(error.issues);
  }

  return error instanceof Error ? error.message : String(error);
}

export async function runInsightAgent(
  input: InsightAgentInput,
): Promise<InsightAgentResult> {
  const validated = InsightAgentInputSchema.parse(input);
  const pipelineRun = await prisma.pipelineRun.create({
    data: {
      orgId: validated.orgId,
      agentName: "analytics-insight",
      input: validated,
      status: "running",
    },
  });

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
          [
            {
              role: "user",
              content: `REAL, COMPUTED CAMPAIGN METRICS:\n${JSON.stringify(validated)}${repairHint}`,
            },
          ],
          900,
          { jsonObject: true },
        );
        const output = InsightAgentOutputSchema.safeParse(
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
