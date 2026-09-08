import { z } from "zod";

export const DashboardSearchQuerySchema = z.object({
  query: z.string().trim().min(2).max(120),
});
