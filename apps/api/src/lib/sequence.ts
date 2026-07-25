import { z } from "zod";
import {
  channelForStepType,
  isSequenceStepType,
  type OutreachChannel,
  SEQUENCE_STEP_TYPES,
} from "./channels.js";

const SequenceStepSchema = z
  .object({
    type: z.string().min(1),
    message: z.string().min(1),
    delayHours: z.number().min(0),
    subject: z.string().min(1).optional(),
  })
  .superRefine((step, ctx) => {
    if (!isSequenceStepType(step.type)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Unsupported sequence step type "${step.type}". Expected one of: ${SEQUENCE_STEP_TYPES.join(", ")}`,
        path: ["type"],
      });
      return;
    }
    if (step.type === "email" && !step.subject?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Email steps require a subject",
        path: ["subject"],
      });
    }
  });

export type SequenceStep = z.infer<typeof SequenceStepSchema>;

const SequenceSchema = z.array(SequenceStepSchema).min(1);

export function parseSequence(sequence: unknown): SequenceStep[] {
  const result = SequenceSchema.safeParse(sequence);
  if (!result.success) {
    throw new Error(`Invalid campaign sequence: ${result.error.message}`);
  }
  return result.data;
}

export function channelsUsedInSequence(sequence: SequenceStep[]): OutreachChannel[] {
  const channels = new Set<OutreachChannel>();
  for (const step of sequence) {
    const channel = channelForStepType(step.type);
    if (channel) channels.add(channel);
  }
  return [...channels];
}
