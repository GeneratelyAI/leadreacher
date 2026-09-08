import type { AnalyticsResponse } from "./analytics-model";

function downloadCsv(filename: string, rows: string[][]) {
  const content = rows
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function exportReport(analytics: AnalyticsResponse | null) {
  if (!analytics) return;
  const rows: string[][] = [
    ["Metric", "Value"],
    ["Messages sent", String(analytics.summary.messagesSent)],
    ["Replies received", String(analytics.summary.repliesReceived)],
    ["Reply rate", `${analytics.summary.replyRate}%`],
    ["Meetings booked", String(analytics.summary.meetingsBooked)],
    ["Prospects reached", String(analytics.summary.prospectsReached)],
    [],
    ["Channel", "Messages sent", "Replies", "Reply rate", "Meetings booked"],
    ...analytics.channels.map((row) => [
      row.channel,
      String(row.messagesSent),
      String(row.replies),
      `${row.replyRate}%`,
      String(row.meetingsBooked),
    ]),
    [],
    ["Campaign", "Messages sent", "Replies", "Reply rate", "Meetings booked"],
    ...analytics.campaigns.map((row) => [
      row.name,
      String(row.messagesSent),
      String(row.replies),
      `${row.replyRate}%`,
      String(row.meetingsBooked),
    ]),
  ];
  downloadCsv(`leadreacher-analytics-${analytics.range.startDate}-to-${analytics.range.endDate}.csv`, rows);
}
