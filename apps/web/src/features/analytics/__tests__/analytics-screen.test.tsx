import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Analytics } from "../public/Analytics";

const mocks = vi.hoisted(() => ({
  search: "",
  query: vi.fn(),
  fetch: vi.fn(),
  replace: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
  useSearchParams: () => new URLSearchParams(mocks.search),
}));
vi.mock("@tanstack/react-query", () => ({
  keepPreviousData: "retain-previous-analytics",
  useQuery: mocks.query,
}));
vi.mock("@/lib/api", () => ({ apiFetch: mocks.fetch }));

const emptyAnalytics = {
  summary: { messagesSent: 0, repliesReceived: 0, replyRate: 0, meetingsBooked: 0, prospectsReached: 0, trends: {} },
  channels: [], campaigns: [], activityTrend: [], replyRateTrend: [],
  filters: { campaigns: [], channels: [] },
  range: { startDate: "2026-09-01", endDate: "2026-09-08" }, granularity: "day",
};

function render(data?: typeof emptyAnalytics, status = "no_data", error?: Error) {
  mocks.query.mockImplementation((options) => options.queryKey[1] === "analytics"
    ? { data, error, isLoading: !data && !error, isFetching: !data && !error }
    : { data: { status, whatsWorking: [], whatsNotWorking: [], whatToDoNext: [] } });
  return renderToStaticMarkup(<Analytics />);
}

describe("analytics screen contract before decomposition", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.search = ""; });

  it("retains date/campaign filters and deduplicates channels in the request key", async () => {
    mocks.search = "startDate=2026-09-01&endDate=2026-09-08&campaignId=saved&channels=linkedin,%20email,linkedin,,email";
    render();
    const options = mocks.query.mock.calls[0]![0];
    const query = "granularity=day&startDate=2026-09-01&endDate=2026-09-08&campaignId=saved&channels=linkedin%2Cemail";
    expect(options.queryKey).toEqual(["dashboard", "analytics", query]);
    expect(options.placeholderData).toBe("retain-previous-analytics");
    expect(options.staleTime).toBe(30_000);
    await options.queryFn();
    expect(mocks.fetch).toHaveBeenCalledWith(`/dashboard/analytics?${query}`);
  });

  it("polls only aggregating insights, independently of report filters", async () => {
    render();
    const options = mocks.query.mock.calls[1]![0];
    expect(options.queryKey).toEqual(["dashboard", "analytics-insights"]);
    expect(options.refetchInterval({ state: { data: { status: "aggregating" } } })).toBe(2_500);
    for (const data of [undefined, { status: "ready" }, { status: "no_data" }]) {
      expect(options.refetchInterval({ state: { data } })).toBe(false);
    }
    await options.queryFn();
    expect(mocks.fetch).toHaveBeenCalledWith("/dashboard/analytics/insights");
  });

  it("shows loading separately from missing data and exposes query failures", () => {
    expect(render()).toContain("Loading analytics");
    const failed = render(undefined, "no_data", new Error("Request denied"));
    expect(failed).toContain('role="alert"');
    expect(failed).toContain("Request denied");
    expect(failed).not.toContain("Loading analytics");
  });

  it("keeps no-data and pending-insight copy distinct", () => {
    const empty = render(emptyAnalytics);
    expect(empty).toContain("No delivery data in this range.");
    expect(empty).toContain("No campaign activity in this range.");
    expect(empty).toContain("Once you have sent some outreach, insights will appear here.");
    const pending = render(emptyAnalytics, "aggregating");
    expect(pending).toContain("Still gathering data");
    expect(pending).not.toContain("Once you have sent some outreach");
  });
});
