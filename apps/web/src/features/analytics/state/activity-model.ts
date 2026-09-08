export const PAGE_SIZE = 10;

export type ActivityKind = "message" | "prospect" | "video" | "campaign";
export type ActivityTab = "all" | ActivityKind;

export type ActivityTrend = {
  direction: "up" | "down" | "flat" | "new";
  percent: number | null;
};

export type ActivityItem = {
  id: string;
  kind: ActivityKind;
  title: string;
  detail: string;
  occurredAt: string;
  avatarUrl?: string | null;
  channel?: string;
  action?: "reply" | "view";
  href?: string;
};

export type ActivitySummary = {
  totalActivities: number;
  messagesSent: number;
  repliesReceived: number;
  meetingsBooked: number;
  videosSent: number;
  trends: Record<keyof Omit<ActivitySummary, "trends">, ActivityTrend>;
};

export type ActivityResponse = {
  activity: ActivityItem[];
  total: number;
  limit: number;
  offset: number;
  summary: ActivitySummary;
  filters: {
    campaigns: Array<{ id: string; name: string }>;
    channels: string[];
  };
  range: { startDate: string; endDate: string };
};

export type DayGroup = {
  key: string;
  label: string;
  items: ActivityItem[];
};

export const KIND_TABS: Array<{ value: ActivityTab; label: string }> = [
  { value: "all", label: "All Activity" },
  { value: "message", label: "Messages" },
  { value: "prospect", label: "Prospects" },
  { value: "campaign", label: "Campaigns" },
  { value: "video", label: "Videos" },
];
