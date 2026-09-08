export type OverviewMode = "casual" | "advanced";
export type Trend = { direction: "up" | "down" | "flat" | "new"; percent: number | null };

export type DashboardOverview = {
  organization: { name: string; plan: string; subscriptionStatus: string | null; hasBillingPortal: boolean };
  engine: { status: "running" | "ready" | "needs_attention"; label: string; detail: string };
  metrics: { prospects: number; outreachInProgress: number; replies: number; meetingsBooked: number; outreachSent: number; customers?: number };
  trends?: Partial<Record<"prospects" | "outreachInProgress" | "replies" | "meetingsBooked" | "outreachSent" | "customers", Trend>>;
  dateRange?: { startDate: string; endDate: string };
  primaryCampaign: {
    id: string;
    name: string;
    status: string;
    channels: string[];
    prospectCount: number;
    stats?: { prospects: number; contacted: number; replies: number; meetings: number; customers: number };
    channelSendCounts?: Record<string, number>;
  } | null;
  channels: Array<{ id: string; platform: string; accountName: string; avatarUrl: string | null; status: string }>;
  actions?: {
    needsReply: Array<{
      campaignLeadId: string;
      prospectName: string;
      company: string | null;
      avatarUrl: string | null;
      campaignName: string;
      preview: string;
      occurredAt: string;
    }>;
    needsReplyCount: number;
    reconnectAccounts: Array<{ id: string; platform: string; accountName: string; status: string }>;
    failedSendCount: number;
    stalledCount: number;
  };
};

export type AnalyticsResponse = {
  summary: {
    messagesSent: number;
    repliesReceived: number;
    replyRate: number;
    meetingsBooked: number;
    prospectsReached: number;
    trends: Record<"messagesSent" | "repliesReceived" | "replyRate" | "meetingsBooked" | "prospectsReached", Trend>;
  };
  activityTrend: Array<{ date: string; messagesSent: number; repliesReceived: number; meetingsBooked: number; prospectsReached: number; replyRate: number }>;
  channels: Array<{ channel: string; messagesSent: number; replies: number; replyRate: number; meetingsBooked: number }>;
  campaigns: Array<{ id: string; name: string; messagesSent: number; replies: number; replyRate: number; meetingsBooked: number }>;
};
