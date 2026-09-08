import { afterEach, expect, it, vi } from "vitest";
import { getAudienceAnalysis, getStrategyBrief, isStaleAudienceRun, selectedChannelsFromStrategy, strategyErrorMessage, type StrategyResponse } from "../strategy-model";

function strategy(icpDefinition: StrategyResponse["icpDefinition"]): StrategyResponse {
  return { id: "saved", orgId: "organization", updatedAt: "2026-09-08", icpDefinition, channels: {} };
}

afterEach(() => vi.useRealTimers());

it("distinguishes absent analysis from a saved running, failed, or completed analysis", () => {
  expect(getAudienceAnalysis(null)).toBeNull();
  expect(getAudienceAnalysis(strategy({ audienceAnalysis: { status: "ready" } }))).toBeNull();
  for (const status of ["running", "failed", "completed"]) {
    expect(getAudienceAnalysis(strategy({ audienceAnalysis: { status } }))?.status).toBe(status);
  }
});

it("preserves legacy parsing defaults without coercing provider strings into numeric counts", () => {
  const result = getAudienceAnalysis(strategy({ audienceAnalysis: {
    status: "completed", source: "connected_linkedin",
    companies: { status: "unavailable", totalFound: "7", reason: "After connection" },
    decisionMakers: { totalFound: 8, sampleSize: 4 },
    topIndustries: [null, { industry: "Software", count: 4, percentage: 50 }, { industry: "" }],
  } }));
  expect(result?.companies).toEqual({ status: "unavailable", totalFound: 0, sampleSize: 0, reason: "After connection" });
  expect(result?.source).toBe("connected_linkedin");
  expect(result?.topIndustries).toEqual([{ industry: "Software", count: 4, percentage: 50 }]);
  expect(result?.reachability).toEqual({ percentage: 0, reachableProfiles: 0, totalProfiles: 0 });
});

it("does not present an incomplete strategy brief as ready", () => {
  expect(getStrategyBrief(strategy({ strategyBrief: { status: "ready", goal: "Find buyers" } }))).toBeNull();
  const saved = { status: "ready", goal: "Find buyers", market: "Software", audience: "Founders", offer: "Outreach", valueProposition: "Save time", decisionMakerRoles: ["Founder", "  ", 4] };
  expect(getStrategyBrief(strategy({ strategyBrief: saved }))).toMatchObject({ goal: "Find buyers", decisionMakerRoles: ["Founder"], outreachAngles: [], executionPlan: [] });
});

it("retains the strict six-minute stale-run boundary", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-08T16:06:00Z"));
  const analysis = getAudienceAnalysis(strategy({ audienceAnalysis: { status: "running", startedAt: "2026-09-08T16:00:00Z" } }))!;
  expect(isStaleAudienceRun(analysis)).toBe(false);
  vi.advanceTimersByTime(1);
  expect(isStaleAudienceRun(analysis)).toBe(true);
  expect(isStaleAudienceRun({ ...analysis, status: "completed" })).toBe(false);
});

it("keeps saved channel ordering and existing error messages", () => {
  expect(selectedChannelsFromStrategy({ ...strategy({}), channels: { selected: ["email", "retired", "linkedin", "email"] } })).toEqual(["email", "linkedin", "email"]);
  expect(strategyErrorMessage(new Error("provider unavailable"))).toBe("provider unavailable");
  expect(strategyErrorMessage("expected object, received null")).toBe("We couldn't start the audience analysis. Please retry.");
});
