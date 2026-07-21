import { prisma } from "../lib/prisma.js";
import { redis } from "../lib/redis.js";
import {
  runInsightAgent,
  type InsightAgentInput,
  type InsightAgentResult,
} from "../modules/agents/insight-agent.js";

const INSIGHT_CACHE_TTL_SECONDS = 60 * 60;
const SENT_MESSAGE_STATUSES = new Set(["sent", "delivered", "opened", "replied"]);

type MessageMetric = {
  message: string;
  sent: number;
  replies: number;
  replyRate: number;
};

export type CampaignInsightMetrics = Omit<InsightAgentInput, "orgId">;

export type DashboardInsights = {
  status: "ready" | "no_data";
  generatedAt: string;
  whatsWorking: Array<{ campaignId: string; campaignName: string; text: string }>;
  whatsNotWorking: Array<{ campaignId: string; campaignName: string; text: string }>;
  whatToDoNext: Array<{
    campaignId: string;
    campaignName: string;
    action: string;
    reason: string;
    priority: 1 | 2 | 3;
  }>;
};

function messageText(content: unknown): string {
  if (!content || typeof content !== "object" || Array.isArray(content)) {
    return "";
  }

  const record = content as Record<string, unknown>;
  for (const key of ["message", "body", "text"]) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim().slice(0, 120);
    }
  }

  return "";
}

function replyRate(sent: number, replies: number): number {
  if (sent === 0) return 0;
  return Number(((replies / sent) * 100).toFixed(1));
}

export function analyticsInsightsCacheKey(orgId: string): string {
  return `dashboard:analytics-insights:${orgId}`;
}

export async function computeCampaignInsightMetrics(
  campaignId: string,
  orgId: string,
  campaignName: string,
): Promise<CampaignInsightMetrics> {
  const [messages, campaignLeads] = await Promise.all([
    prisma.message.findMany({
      where: { orgId, campaignId },
      select: {
        leadId: true,
        channel: true,
        status: true,
        direction: true,
        content: true,
      },
    }),
    prisma.campaignLead.findMany({
      where: { campaignId },
      select: { leadId: true, lead: { select: { status: true } } },
    }),
  ]);

  const repliedLeadIds = new Set(
    campaignLeads
      .filter((campaignLead) => campaignLead.lead.status === "replied")
      .map((campaignLead) => campaignLead.leadId),
  );
  const outbound = messages.filter(
    (message) =>
      message.direction === "outbound" && SENT_MESSAGE_STATUSES.has(message.status),
  );
  const channelCounts = new Map<string, { sent: number; repliedLeadIds: Set<string> }>();
  const messageCounts = new Map<string, { sent: number; repliedLeadIds: Set<string> }>();

  for (const message of outbound) {
    const channel = channelCounts.get(message.channel) ?? {
      sent: 0,
      repliedLeadIds: new Set<string>(),
    };
    channel.sent += 1;
    if (repliedLeadIds.has(message.leadId)) channel.repliedLeadIds.add(message.leadId);
    channelCounts.set(message.channel, channel);

    const text = messageText(message.content);
    if (!text) continue;
    const grouped = messageCounts.get(text) ?? {
      sent: 0,
      repliedLeadIds: new Set<string>(),
    };
    grouped.sent += 1;
    if (repliedLeadIds.has(message.leadId)) grouped.repliedLeadIds.add(message.leadId);
    messageCounts.set(text, grouped);
  }

  const messageMetrics: MessageMetric[] = [...messageCounts.entries()].map(
    ([message, counts]) => ({
      message,
      sent: counts.sent,
      replies: counts.repliedLeadIds.size,
      replyRate: replyRate(counts.sent, counts.repliedLeadIds.size),
    }),
  );
  const orderedBest = [...messageMetrics].sort(
    (left, right) => right.replyRate - left.replyRate || right.sent - left.sent,
  );
  const orderedWorst = [...messageMetrics].sort(
    (left, right) => left.replyRate - right.replyRate || right.sent - left.sent,
  );
  const totalReplies = repliedLeadIds.size;

  return {
    campaignId,
    campaignName,
    totalSent: outbound.length,
    totalReplies,
    replyRate: replyRate(outbound.length, totalReplies),
    channels: [...channelCounts.entries()].map(([channel, counts]) => ({
      channel,
      sent: counts.sent,
      replies: counts.repliedLeadIds.size,
    })),
    topMessages: orderedBest.slice(0, 3),
    bottomMessages: orderedWorst.slice(0, 3),
  };
}

function appendInsights(
  response: DashboardInsights,
  metrics: CampaignInsightMetrics,
  insight: InsightAgentResult,
): void {
  for (const text of insight.whatsWorking) {
    response.whatsWorking.push({
      campaignId: metrics.campaignId,
      campaignName: metrics.campaignName,
      text,
    });
  }
  for (const text of insight.whatsNotWorking) {
    response.whatsNotWorking.push({
      campaignId: metrics.campaignId,
      campaignName: metrics.campaignName,
      text,
    });
  }
  for (const next of insight.whatToDoNext) {
    response.whatToDoNext.push({
      campaignId: metrics.campaignId,
      campaignName: metrics.campaignName,
      ...next,
    });
  }
}

export async function aggregateOrganizationAnalyticsInsights(
  orgId: string,
): Promise<DashboardInsights> {
  const campaigns = await prisma.campaign.findMany({
    where: { orgId, status: { in: ["active", "completed"] } },
    select: { id: true, name: true },
    orderBy: { updatedAt: "desc" },
  });
  const metrics = await Promise.all(
    campaigns.map((campaign) =>
      computeCampaignInsightMetrics(campaign.id, orgId, campaign.name),
    ),
  );
  const meaningfulMetrics = metrics.filter((campaign) => campaign.totalSent > 0);
  const response: DashboardInsights = {
    status: meaningfulMetrics.length > 0 ? "ready" : "no_data",
    generatedAt: new Date().toISOString(),
    whatsWorking: [],
    whatsNotWorking: [],
    whatToDoNext: [],
  };

  if (meaningfulMetrics.length > 0) {
    const generated = await Promise.all(
      meaningfulMetrics.map(async (campaign) => ({
        campaign,
        insight: await runInsightAgent({ orgId, ...campaign }),
      })),
    );
    for (const { campaign, insight } of generated) {
      appendInsights(response, campaign, insight);
    }
  }

  if (response.status === "ready") {
    await redis.set(
      analyticsInsightsCacheKey(orgId),
      JSON.stringify(response),
      "EX",
      INSIGHT_CACHE_TTL_SECONDS,
    );
  }
  return response;
}

export async function readCachedAnalyticsInsights(
  orgId: string,
): Promise<DashboardInsights | null> {
  const raw = await redis.get(analyticsInsightsCacheKey(orgId));
  if (!raw) return null;

  try {
    const value = JSON.parse(raw) as DashboardInsights;
    return value.status === "ready" || value.status === "no_data" ? value : null;
  } catch {
    return null;
  }
}
