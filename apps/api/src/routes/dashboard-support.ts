import type { Prisma } from "@prisma/client";
import { ValidationError } from "../lib/errors.js";

export type OverviewMetricTrend = {
  direction: "up" | "down" | "flat" | "new";
  percent: number | null;
};

export function resolveOverviewDateRange(
  query: { startDate?: string; endDate?: string; activityKind?: string },
  now = new Date(),
): { start: Date; end: Date; previousStart: Date; previousEnd: Date } {
  const defaultEnd = new Date(now);
  defaultEnd.setUTCHours(23, 59, 59, 999);
  const defaultStart = new Date(defaultEnd);
  defaultStart.setUTCDate(defaultStart.getUTCDate() - 6);
  defaultStart.setUTCHours(0, 0, 0, 0);

  const start = query.startDate ? new Date(`${query.startDate}T00:00:00.000Z`) : defaultStart;
  const end = query.endDate ? new Date(`${query.endDate}T23:59:59.999Z`) : defaultEnd;
  if (end < start) throw new ValidationError("The end date must be on or after the start date");

  const duration = end.getTime() - start.getTime() + 1;
  return {
    start,
    end,
    previousStart: new Date(start.getTime() - duration),
    previousEnd: new Date(start.getTime() - 1),
  };
}

export function overviewMetricTrend(current: number, previous: number): OverviewMetricTrend {
  if (previous === 0) {
    return current > 0
      ? { direction: "new", percent: null }
      : { direction: "flat", percent: 0 };
  }
  const percent = Math.round(Math.abs(((current - previous) / previous) * 100));
  if (percent === 0) return { direction: "flat", percent: 0 };
  return { direction: current > previous ? "up" : "down", percent };
}

export function leadSearchWhere(rawQuery: string): Prisma.LeadWhereInput {
  const terms = rawQuery.trim().split(/\s+/).filter(Boolean);
  return {
    AND: terms.map((term) => ({
      OR: [
        { firstName: { contains: term, mode: "insensitive" } },
        { lastName: { contains: term, mode: "insensitive" } },
        { company: { contains: term, mode: "insensitive" } },
        { title: { contains: term, mode: "insensitive" } },
      ],
    })),
  };
}

export function conversationKey(campaignId: string, leadId: string): string {
  return `${campaignId}:${leadId}`;
}
