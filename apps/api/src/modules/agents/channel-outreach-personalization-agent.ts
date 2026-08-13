import { z } from "zod";
import { Prisma } from "@prisma/client";
import { callGroq } from "../../lib/groq.js";
import { extractJsonObject } from "../../lib/llm-json.js";
import { prisma } from "../../lib/prisma.js";
import { OUTREACH_CHANNELS } from "../../lib/channels.js";

const ChannelPersonalizationInputSchema = z.object({
  orgId: z.string().min(1),
  channel: z.enum(OUTREACH_CHANNELS),
  campaignName: z.string().min(1),
  baseMessage: z.string().min(1),
  step: z.number().int().min(0),
  campaignBrief: z.object({
    campaignName: z.string().min(1),
    step: z.number().int().min(0),
    valueProposition: z.string().max(280).optional(),
    requestedAngle: z.string().max(120).optional(),
    requestedCta: z.string().max(120).optional(),
    proofPoints: z.array(z.string().max(180)).max(3),
  }).default({ campaignName: "Campaign", step: 0, proofPoints: [] }),
  evidence: z.array(z.object({
    id: z.string().min(1).max(80),
    value: z.string().min(1).max(280),
    source: z.enum(["lead", "enrichment"]),
  })).max(3).default([]),
  prospect: z.object({
    firstName: z.string(),
  }),
});

export const ChannelPersonalizationOutputSchema = z.object({
  message: z.string().trim().min(1).max(1_000),
  rationale: z.string().trim().min(1).max(300),
  evidenceFactIds: z.array(z.string().min(1).max(80)).max(2),
});

type ChannelPersonalizationInput = z.input<typeof ChannelPersonalizationInputSchema>;
export type ChannelPersonalizationResult = z.infer<typeof ChannelPersonalizationOutputSchema>;

const SYSTEM_PROMPT = `You personalize B2B outreach using only the supplied factual prospect and campaign context.

Write for the requested channel:
- linkedin: concise professional language with one credible role or company connection.
- whatsapp: at most 420 characters, identify why the sender is reaching out, sound conversational, and end with a low-pressure question. Never imply prior consent or familiarity.
- instagram: at most 420 characters and natural direct-message language. Do not claim to have seen posts unless a supplied fact explicitly says so.
- facebook: at most 420 characters and natural Messenger language. Do not claim prior interaction.
- email: concise professional email body; the subject is handled separately.

Rules:
- Preserve the base message's real offer and intent.
- Use the prospect's first name naturally.
- Use at most two facts from EVIDENCE only. Cite every fact used by its exact EVIDENCE id.
- Treat the CAMPAIGN BRIEF as the approved strategic context. Do not turn proof points into unverified claims.
- Never infer protected traits, private behavior, intent, pain, budget, or personal circumstances.
- Never fabricate metrics, customers, relationships, events, or content engagement.
- Do not use markdown, emojis, em dashes, or unresolved {{placeholders}}.

Return only valid JSON:
{"message":"<channel-native personalized message>","rationale":"<facts used, briefly>","evidenceFactIds":["<evidence id>"]}`;

export async function runChannelOutreachPersonalizationAgent(
  input: ChannelPersonalizationInput,
): Promise<ChannelPersonalizationResult> {
  const validated = ChannelPersonalizationInputSchema.parse(input);
  const pipelineRun = await prisma.pipelineRun.create({
    data: {
      orgId: validated.orgId,
      agentName: "channel-outreach-personalization",
      input: validated as unknown as Prisma.InputJsonValue,
      status: "running",
    },
  });

  try {
    const raw = await callGroq(
      SYSTEM_PROMPT,
      [{ role: "user", content: JSON.stringify(validated) }],
      700,
      { jsonObject: true },
    );
    const output = ChannelPersonalizationOutputSchema.parse(
      JSON.parse(extractJsonObject(raw)),
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
