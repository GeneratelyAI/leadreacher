import { z } from "zod";
import { type Prisma } from "@prisma/client";
import { leadName } from "../../prospects/public/presentation.js";

export type DashboardActivity = {
  id: string;
  kind: "message" | "prospect" | "video" | "campaign";
  title: string;
  detail: string;
  occurredAt: Date;
  avatarUrl?: string | null;
  channel?: string;
  action?: "reply" | "view";
  href?: string;
};

export type ActivityMessage = {
  id: string;
  direction: string;
  channel: string;
  createdAt: Date;
  campaignLeadId?: string;
  lead: { id?: string; firstName: string; lastName: string; company: string; avatarUrl: string | null };
  campaign: { id?: string; name: string };
};

export type ActivityLead = {
  id: string;
  firstName: string;
  lastName: string;
  company: string;
  avatarUrl: string | null;
  createdAt: Date;
};

export type ActivityVideo = {
  id: string;
  status: string;
  needsReview: boolean;
  updatedAt: Date;
  campaign: { name: string } | null;
  lead: { firstName: string; lastName: string; avatarUrl: string | null } | null;
};

export type ActivityCampaign = {
  id: string;
  name: string;
  status: string;
  updatedAt: Date;
  _count: { leads: number };
};

export type ActivitySummaryKey =
  | "totalActivities"
  | "messagesSent"
  | "repliesReceived"
  | "meetingsBooked"
  | "videosSent";

export type ActivitySummaryTrend = {
  direction: "up" | "down" | "flat" | "new";
  percent: number | null;
};

export const ActivityListQuerySchema = z.object({
  kind: z.enum(["all", "message", "prospect", "video", "campaign"]).default("all"),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  offset: z.coerce.number().int().min(0).default(0),
  startDate: z.string().date().optional(),
  endDate: z.string().date().optional(),
  channel: z.string().trim().max(40).optional(),
  campaignId: z.string().trim().min(1).optional(),
});

export function activityKindFromEventType(eventType: string): DashboardActivity["kind"] {
  if (eventType.startsWith("message.")) return "message";
  if (eventType.startsWith("prospect.")) return "prospect";
  if (eventType.startsWith("video.")) return "video";
  return "campaign";
}

export function activityMetadata(value: Prisma.JsonValue | null): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function metadataString(metadata: Record<string, unknown>, key: string): string | null {
  const value = metadata[key];
  return typeof value === "string" && value.trim() ? value : null;
}

export function sortDashboardActivity(items: DashboardActivity[]): DashboardActivity[] {
  return items.sort((left, right) => right.occurredAt.getTime() - left.occurredAt.getTime());
}

export function buildDashboardActivity(input: {
  messages: ActivityMessage[];
  leads: ActivityLead[];
  videos: ActivityVideo[];
  campaigns: ActivityCampaign[];
}): DashboardActivity[] {
  return sortDashboardActivity([
    ...input.messages.map((message) => {
      const name = leadName(message.lead);
      const direction = message.direction === "inbound" ? "Reply received" : "Outreach sent";
      return {
        id: `message:${message.id}`,
        kind: "message" as const,
        title: `${direction} ${message.direction === "inbound" ? "from" : "to"} ${name}`,
        detail: `${message.channel} · ${message.campaign.name}`,
        occurredAt: message.createdAt,
        avatarUrl: message.lead.avatarUrl,
        channel: message.channel,
        action: message.direction === "inbound" && message.campaignLeadId ? "reply" as const : "view" as const,
        href: message.campaignLeadId
          ? `/dashboard/messages/${message.campaignLeadId}`
          : message.lead.id
            ? `/dashboard/prospects/${message.lead.id}`
            : "/dashboard/activity",
      };
    }),
    ...input.leads.map((lead) => ({
      id: `lead:${lead.id}`,
      kind: "prospect" as const,
      title: `Prospect added: ${leadName(lead)}`,
      detail: lead.company || "Company not provided",
      occurredAt: lead.createdAt,
      avatarUrl: lead.avatarUrl,
      action: "view" as const,
      href: `/dashboard/prospects/${lead.id}`,
    })),
    ...input.videos.map((video) => ({
      id: `video:${video.id}`,
      kind: "video" as const,
      title: video.needsReview
        ? "Video needs review"
        : video.status === "failed"
          ? "Video generation failed"
          : video.status === "ready" || video.status === "approved"
            ? "Video ready"
            : "Video generation updated",
      detail: video.lead
        ? `For ${leadName(video.lead)}`
        : video.campaign?.name ?? "Campaign video",
      occurredAt: video.updatedAt,
      avatarUrl: video.lead?.avatarUrl ?? null,
      action: "view" as const,
      href: "/dashboard/campaigns",
    })),
    ...input.campaigns.map((campaign) => ({
      id: `campaign:${campaign.id}`,
      kind: "campaign" as const,
      title: `${campaign.name} is ${campaign.status}`,
      detail: `${campaign._count.leads} enrolled ${campaign._count.leads === 1 ? "prospect" : "prospects"}`,
      occurredAt: campaign.updatedAt,
      action: "view" as const,
      href: "/dashboard/campaigns",
    })),
  ]);
}
