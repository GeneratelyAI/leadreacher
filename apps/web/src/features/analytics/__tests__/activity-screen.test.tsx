import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Activity } from "../public/Activity";

const mocks = vi.hoisted(() => ({ search: "", query: vi.fn(), fetch: vi.fn(), prefetch: vi.fn() }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(mocks.search) }));
vi.mock("@tanstack/react-query", () => ({
  keepPreviousData: "retain-previous-activity", useQuery: mocks.query,
  useQueryClient: () => ({ prefetchQuery: mocks.prefetch }),
}));
vi.mock("@/lib/api", () => ({ apiFetch: mocks.fetch }));

describe("activity screen characterization", () => {
  beforeEach(() => {
    vi.clearAllMocks(); mocks.search = "";
    mocks.query.mockReturnValue({ isLoading: true, isFetching: true });
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-09-08T14:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("retains initial kind, saved campaign, dates, page size, and query caching", async () => {
    mocks.search = "kind=message&campaignId=saved&startDate=2026-09-01&endDate=2026-09-08";
    renderToStaticMarkup(<Activity />);
    const options = mocks.query.mock.calls[0]![0];
    const params = "kind=message&limit=10&offset=0&startDate=2026-09-01&endDate=2026-09-08&campaignId=saved";
    expect(options.queryKey).toEqual(["dashboard", "activity", params]);
    expect(options.placeholderData).toBe("retain-previous-activity");
    expect(options.staleTime).toBe(30_000);
    await options.queryFn();
    expect(mocks.fetch).toHaveBeenCalledWith(`/dashboard/activity?${params}`);
  });

  it("uses all activity for unrecognized kinds without enabling paging", () => {
    mocks.search = "kind=unknown";
    const markup = renderToStaticMarkup(<Activity />);
    expect(mocks.query.mock.calls[0]![0].queryKey[2]).toBe("kind=all&limit=10&offset=0");
    expect(markup).toContain("Loading activity");
    expect(markup).toContain("Showing 0 to 0 of");
    expect(markup).toContain('aria-label="Previous page"');
    expect(markup).toContain('aria-label="Next page"');
  });

  it("keeps empty data and failure feedback separate from loading", () => {
    mocks.query.mockReturnValue({ isLoading: false, isFetching: false, error: new Error("No workspace access") });
    const markup = renderToStaticMarkup(<Activity />);
    expect(markup).toContain('role="alert"');
    expect(markup).toContain("No workspace access");
    expect(markup).toContain("No activity yet");
    expect(markup).not.toContain("Loading activity");
  });

  it("groups records by UTC day and preserves explicit and fallback action links", () => {
    mocks.query.mockReturnValue({ data: {
      activity: [
        { id: "one", kind: "message", title: "Ada Lovelace", detail: "Reply received", occurredAt: "2026-09-08T13:45:00Z", action: "reply", href: "/dashboard/messages/saved" },
        { id: "two", kind: "campaign", title: "Approved campaign", detail: "Campaign updated", occurredAt: "2026-09-07T18:00:00Z" },
      ],
      total: 11, filters: { campaigns: [], channels: [] },
    }, isFetching: true, isLoading: false });
    const markup = renderToStaticMarkup(<Activity />);
    expect(markup).toContain("Today"); expect(markup).toContain("Yesterday");
    expect(markup).toContain("15m ago");
    expect(markup).toContain('href="/dashboard/messages/saved"');
    expect(markup).toContain('href="/dashboard/activity"');
    expect(markup).toContain("Updating…");
    expect(markup.indexOf("Ada Lovelace")).toBeLessThan(markup.indexOf("Approved campaign"));
  });
});
