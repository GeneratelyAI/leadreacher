import { z } from "zod";
import { asRecord } from "../../../platform/persistence/json.js";

export const DashboardCampaignsQuerySchema = z.object({
  status: z.enum(["all", "drafts", "running", "paused", "completed", "archived"]).default("all"),
  search: z.string().trim().max(120).optional(),
  channel: z.string().trim().max(40).optional(),
});

export const SENT_MESSAGE_STATUSES = ["sent", "delivered", "opened", "replied"];

export function campaignMetricRate(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

export function campaignStatusFilter(status: z.infer<typeof DashboardCampaignsQuerySchema>["status"]): string[] | undefined {
  if (status === "all" || status === "archived") return undefined;
  if (status === "drafts") return ["draft", "review"];
  if (status === "running") return ["active"];
  return [status];
}

export function isCampaignArchived(aiConfig: unknown): boolean {
  return asRecord(aiConfig)?.archived === true;
}
