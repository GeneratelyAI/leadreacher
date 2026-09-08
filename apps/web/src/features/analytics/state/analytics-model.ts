export type Trend = {
  direction: "up" | "down" | "flat" | "new";
  percent: number | null;
};

export type AnalyticsSummary = {
  messagesSent: number;
  repliesReceived: number;
  replyRate: number;
  meetingsBooked: number;
  prospectsReached: number;
  trends: Record<keyof Omit<AnalyticsSummary, "trends">, Trend>;
};

export type ActivityPoint = {
  date: string;
  messagesSent: number;
  repliesReceived: number;
  meetingsBooked: number;
  replyRate: number;
};

export type ChannelRow = {
  channel: string;
  messagesSent: number;
  replies: number;
  replyRate: number;
  meetingsBooked: number;
};

export type CampaignRow = {
  id: string;
  name: string;
  messagesSent: number;
  replies: number;
  replyRate: number;
  meetingsBooked: number;
};

export type AnalyticsResponse = {
  summary: AnalyticsSummary;
  activityTrend: ActivityPoint[];
  replyRateTrend: Array<{ date: string; replyRate: number }>;
  channels: ChannelRow[];
  campaigns: CampaignRow[];
  filters: {
    campaigns: Array<{ id: string; name: string }>;
    channels: string[];
  };
  range: { startDate: string; endDate: string };
  granularity: "day" | "week";
};

export type AnalyticsInsights = {
  status: "ready" | "aggregating" | "no_data";
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
