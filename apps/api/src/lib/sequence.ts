import { z } from "zod";

const SequenceStepSchema = z.object({
  type: z.string(),
  message: z.string().min(1),
  delayHours: z.number().min(0),
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
