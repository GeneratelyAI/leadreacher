import { describe, expect, it } from "vitest";
import { parseDashboardEvent } from "../DashboardQueryProvider";

describe("parseDashboardEvent", () => {
  it("accepts versioned dashboard events", () => {
    const event = parseDashboardEvent("data: {\"version\":1,\"id\":\"event-1\",\"orgId\":\"org-1\",\"type\":\"campaign.metrics.updated\",\"resources\":{\"campaignId\":\"campaign-1\"},\"occurredAt\":\"2026-08-11T00:00:00.000Z\"}\n\n");

    expect(event?.type).toBe("campaign.metrics.updated");
    expect(event?.resources.campaignId).toBe("campaign-1");
  });

  it("rejects unknown event types", () => {
    expect(parseDashboardEvent("data: {\"version\":1,\"id\":\"event-1\",\"type\":\"message.body\",\"resources\":{}}\n\n")).toBeNull();
  });
});
