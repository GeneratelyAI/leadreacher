import { z } from "zod";

export const OverviewQuerySchema = z.object({
  startDate: z.string().date().optional(),
  endDate: z.string().date().optional(),
  activityKind: z.enum(["all", "message", "prospect", "video", "campaign"]).default("all"),
});

export type OverviewMetricKey =
  | "prospects"
  | "outreachInProgress"
  | "replies"
  | "meetingsBooked"
  | "outreachSent"
  | "customers";

export type OverviewActivityMessage = {
  createdAt: Date;
  direction: string;
  leadId?: string;
};

export function buildOverviewActivityTrend(
  start: Date,
  end: Date,
  messages: OverviewActivityMessage[],
): Array<{ date: string; sent: number; replies: number }> {
  const firstDay = new Date(`${start.toISOString().slice(0, 10)}T00:00:00.000Z`);
  const lastDay = new Date(`${end.toISOString().slice(0, 10)}T00:00:00.000Z`);
  const counts = new Map<string, { sent: number; replies: number }>();

  for (const cursor = new Date(firstDay); cursor <= lastDay; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    counts.set(cursor.toISOString().slice(0, 10), { sent: 0, replies: 0 });
  }

  for (const message of messages) {
    const date = message.createdAt.toISOString().slice(0, 10);
    const day = counts.get(date);
    if (!day) continue;
    if (message.direction === "outbound") day.sent += 1;
    if (message.direction === "inbound") day.replies += 1;
  }

  return [...counts].map(([date, values]) => ({ date, ...values }));
}
