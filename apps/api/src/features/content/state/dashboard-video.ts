import { z } from "zod";

export const CampaignVideoPatchSchema = z.object({
  paused: z.boolean(),
});

export const CampaignVideoEnableSchema = z.object({
  mode: z.enum(["standardized", "personalized"]),
});
