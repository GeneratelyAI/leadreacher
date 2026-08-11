import { randomUUID } from "node:crypto";
import { redis } from "./redis.js";

export const DASHBOARD_EVENT_TYPES = [
  "campaign.updated",
  "campaign.metrics.updated",
  "conversation.updated",
  "channel.updated",
  "video.updated",
  "activity.created",
] as const;

export type DashboardEventType = (typeof DASHBOARD_EVENT_TYPES)[number];

export type DashboardEvent = {
  version: 1;
  id: string;
  orgId: string;
  type: DashboardEventType;
  resources: {
    campaignId?: string;
    campaignLeadId?: string;
    socialAccountId?: string;
    videoAssetId?: string;
  };
  occurredAt: string;
};

export const dashboardEventChannel = (orgId: string) => `leadreacher:dashboard:${orgId}`;

export async function publishDashboardEvent(
  input: Omit<DashboardEvent, "version" | "id" | "occurredAt">,
): Promise<DashboardEvent> {
  const event: DashboardEvent = {
    ...input,
    version: 1,
    id: randomUUID(),
    occurredAt: new Date().toISOString(),
  };

  void redis.publish(dashboardEventChannel(input.orgId), JSON.stringify(event)).catch(() => {
    // Live updates are best effort. The persisted record remains authoritative.
  });
  return event;
}
