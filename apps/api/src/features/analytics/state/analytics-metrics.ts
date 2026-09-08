import type { OverviewMetricTrend } from "../public/date-range.js";

type ActivityMessage = {
  createdAt: Date;
  direction: string;
  leadId?: string;
};

function bucketKey(date: Date, granularity: "day" | "week"): string {
  if (granularity === "day") return date.toISOString().slice(0, 10);
  const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const weekday = day.getUTCDay();
  const offset = weekday === 0 ? -6 : 1 - weekday;
  day.setUTCDate(day.getUTCDate() + offset);
  return day.toISOString().slice(0, 10);
}
export function buildAnalyticsActivityTrend(
  start: Date,
  end: Date,
  messages: ActivityMessage[],
  meetings: Array<{ updatedAt: Date }>,
  granularity: "day" | "week" = "day",
): Array<{ date: string; messagesSent: number; repliesReceived: number; meetingsBooked: number; prospectsReached: number; replyRate: number }> {
  const firstDay = new Date(`${start.toISOString().slice(0, 10)}T00:00:00.000Z`);
  const lastDay = new Date(`${end.toISOString().slice(0, 10)}T00:00:00.000Z`);
  const counts = new Map<string, {
    messagesSent: number;
    repliesReceived: number;
    meetingsBooked: number;
    prospectIds: Set<string>;
  }>();

  for (const cursor = new Date(firstDay); cursor <= lastDay; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const key = bucketKey(cursor, granularity);
    if (!counts.has(key)) counts.set(key, {
      messagesSent: 0,
      repliesReceived: 0,
      meetingsBooked: 0,
      prospectIds: new Set<string>(),
    });
  }
  for (const message of messages) {
    const key = bucketKey(message.createdAt, granularity);
    const day = counts.get(key);
    if (!day) continue;
    if (message.direction === "outbound") {
      day.messagesSent += 1;
      if (message.leadId) day.prospectIds.add(message.leadId);
    }
    if (message.direction === "inbound") day.repliesReceived += 1;
  }
  for (const meeting of meetings) {
    const day = counts.get(bucketKey(meeting.updatedAt, granularity));
    if (day) day.meetingsBooked += 1;
  }
  return [...counts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, values]) => ({
      date,
      messagesSent: values.messagesSent,
      repliesReceived: values.repliesReceived,
      meetingsBooked: values.meetingsBooked,
      prospectsReached: values.prospectIds.size,
      replyRate: values.messagesSent === 0 ? 0 : Math.round((values.repliesReceived / values.messagesSent) * 1000) / 10,
    }));
}

export function analyticsReplyRate(sent: number, replies: number): number {
  if (sent === 0) return 0;
  return Math.round((replies / sent) * 1000) / 10;
}

export function analyticsRateTrend(current: number, previous: number): OverviewMetricTrend {
  const delta = Math.round((current - previous) * 10) / 10;
  if (previous === 0 && current === 0) return { direction: "flat", percent: 0 };
  if (previous === 0 && current > 0) return { direction: "new", percent: null };
  if (delta === 0) return { direction: "flat", percent: 0 };
  return { direction: delta > 0 ? "up" : "down", percent: Math.abs(delta) };
}
