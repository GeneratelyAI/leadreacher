import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Overview } from "../public/Overview";
import { ApiError } from "@/lib/api";

const mocks = vi.hoisted(() => ({ search: "", query: vi.fn(), fetch: vi.fn() }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(mocks.search) }));
vi.mock("@/components/dashboard/Shell", () => ({ useShell: () => ({ memberName: "Fallback Member" }) }));
vi.mock("@tanstack/react-query", () => ({ keepPreviousData: "retain-previous-overview", useQuery: mocks.query }));
vi.mock("@/lib/api", async (original) => ({ ...await original<typeof import("@/lib/api")>(), apiFetch: mocks.fetch }));

describe("overview screen characterization", () => {
  beforeEach(() => {
    vi.clearAllMocks(); mocks.search = "";
    mocks.query.mockReturnValue({ isLoading: true, isFetching: true });
  });

  it("passes a date range only when both dates exist and preserves both query keys", async () => {
    mocks.search = "startDate=2026-09-01";
    renderToStaticMarkup(<Overview />);
    expect(mocks.query.mock.calls[0]![0].queryKey).toEqual(["dashboard", "overview", ""]);
    mocks.query.mockClear();
    mocks.search += "&endDate=2026-09-08";
    renderToStaticMarkup(<Overview />);
    for (const [index, key] of ["overview", "analytics"].entries()) {
      const options = mocks.query.mock.calls[index]![0];
      expect(options.queryKey).toEqual(["dashboard", key, "startDate=2026-09-01&endDate=2026-09-08"]);
      expect(options.placeholderData).toBe("retain-previous-overview");
      expect(options.staleTime).toBe(30_000);
      await options.queryFn();
      expect(mocks.fetch).toHaveBeenCalledWith(`/dashboard/${key}?startDate=2026-09-01&endDate=2026-09-08`);
    }
  });

  it("uses the active LinkedIn account name while preserving the default casual view", () => {
    mocks.query.mockImplementation((options) => ({
      data: options.queryKey[1] === "overview" ? {
        organization: { name: "Saved workspace" }, engine: { status: "ready", label: "Ready", detail: "Saved campaign ready" },
        metrics: { prospects: 8, outreachInProgress: 0, replies: 2, meetingsBooked: 1, outreachSent: 10 },
        primaryCampaign: null, channels: [{ id: "sender", platform: "linkedin", status: "active", accountName: "Ada Lovelace" }],
      } : null, isLoading: false, isFetching: false,
    }));
    const markup = renderToStaticMarkup(<Overview />);
    expect(markup).toContain("Ada</span>");
    expect(markup).not.toContain("Fallback</span>");
    expect(markup).toContain("At a glance");
    expect(markup).toContain("Saved campaign ready");
    expect(markup).toContain("Inbox is clear");
  });

  it("distinguishes expired authentication from other failures", () => {
    mocks.query.mockReturnValue({ error: new ApiError("Unauthorized", 401), isLoading: false });
    const expired = renderToStaticMarkup(<Overview />);
    expect(expired).toContain('role="alert"');
    expect(expired).toContain("Your session has expired. Please sign in again.");
    mocks.query.mockReturnValue({ error: new Error("Cannot load saved totals"), isLoading: false });
    expect(renderToStaticMarkup(<Overview />)).toContain("Cannot load saved totals");
  });
});
