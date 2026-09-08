import { z } from "zod";

export const AnalyticsQuerySchema = z.object({
  startDate: z.string().date().optional(),
  endDate: z.string().date().optional(),
  campaignId: z.string().trim().min(1).optional(),
  channel: z.string().trim().max(40).optional(),
  channels: z.union([z.string(), z.array(z.string())]).optional().transform((value) => {
    if (!value) return [] as string[];
    const parts = Array.isArray(value) ? value : value.split(",");
    return [...new Set(parts.map((part) => part.trim()).filter(Boolean))].slice(0, 20);
  }),
  granularity: z.enum(["day", "week"]).default("day"),
});

export function resolveAnalyticsChannels(query: z.infer<typeof AnalyticsQuerySchema>): string[] {
  if (query.channels.length > 0) return query.channels;
  if (query.channel) return [query.channel];
  return [];
}

export type AnalyticsQuery = z.infer<typeof AnalyticsQuerySchema>;
