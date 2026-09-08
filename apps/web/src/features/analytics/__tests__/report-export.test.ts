import { afterEach, describe, expect, it, vi } from "vitest";
import { exportReport } from "../state/report-export";
import type { AnalyticsResponse } from "../state/analytics-model";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("analytics report export", () => {
  it("does nothing without saved report data", () => {
    const create = vi.spyOn(URL, "createObjectURL");
    exportReport(null);
    expect(create).not.toHaveBeenCalled();
  });

  it("preserves row order, CSV escaping, filename, and blob cleanup", async () => {
    const anchor = { href: "", download: "", click: vi.fn() };
    const createElement = vi.fn(() => anchor);
    vi.stubGlobal("document", { createElement });
    const create = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:report");
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const trend = { direction: "flat", percent: 0 } as const;
    const report: AnalyticsResponse = {
      summary: {
        messagesSent: 10, repliesReceived: 2, replyRate: 20, meetingsBooked: 1, prospectsReached: 8,
        trends: { messagesSent: trend, repliesReceived: trend, replyRate: trend, meetingsBooked: trend, prospectsReached: trend },
      },
      channels: [{ channel: "email", messagesSent: 10, replies: 2, replyRate: 20, meetingsBooked: 1 }],
      campaigns: [{ id: "saved", name: 'Growth, "September"\nCampaign', messagesSent: 10, replies: 2, replyRate: 20, meetingsBooked: 1 }],
      activityTrend: [], replyRateTrend: [], filters: { campaigns: [], channels: [] },
      range: { startDate: "2026-09-01", endDate: "2026-09-08" }, granularity: "day",
    };

    exportReport(report);
    const blob = create.mock.calls[0]![0] as Blob;
    expect(blob.type).toBe("text/csv;charset=utf-8;");
    expect(await blob.text()).toBe([
      '"Metric","Value"', '"Messages sent","10"', '"Replies received","2"',
      '"Reply rate","20%"', '"Meetings booked","1"', '"Prospects reached","8"', "",
      '"Channel","Messages sent","Replies","Reply rate","Meetings booked"',
      '"email","10","2","20%","1"', "",
      '"Campaign","Messages sent","Replies","Reply rate","Meetings booked"',
      '"Growth, ""September""\nCampaign","10","2","20%","1"',
    ].join("\n"));
    expect(createElement).toHaveBeenCalledWith("a");
    expect(anchor.download).toBe("leadreacher-analytics-2026-09-01-to-2026-09-08.csv");
    expect(anchor.href).toBe("blob:report");
    expect(anchor.click).toHaveBeenCalledOnce();
    expect(revoke).toHaveBeenCalledWith("blob:report");
    expect(anchor.click.mock.invocationCallOrder[0]).toBeLessThan(revoke.mock.invocationCallOrder[0]!);
  });
});
