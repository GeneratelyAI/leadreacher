import { z } from "zod";

const NAME_PART_MAX_LENGTH = 72;

export const CampaignNamingSchema = z.object({
  audience: z.string().trim().min(1).max(NAME_PART_MAX_LENGTH),
  channelLabel: z.string().trim().min(1).max(32),
  goal: z.string().trim().min(1).max(NAME_PART_MAX_LENGTH),
});

export type CampaignNaming = z.infer<typeof CampaignNamingSchema>;

function normalizePart(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function formatCampaignName(input: CampaignNaming): string {
  const naming = CampaignNamingSchema.parse(input);
  return [naming.audience, naming.channelLabel, naming.goal]
    .map(normalizePart)
    .join(" · ");
}
