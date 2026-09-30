import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/lib/api";
import {
  readDiscoveryScrapeCache,
  setDiscoveryOrgScope,
  writeDiscoveryScrapeCache,
} from "../../public/discovery-cache";
import { createScrapeController, type WebsiteScrapeStatus } from "../../public/website-status";

vi.mock("@/lib/api", () => ({ apiFetch: vi.fn(), ApiError: class extends Error {} }));
vi.mock("../../public/preview-api", () => ({ usesOnboardingFixtures: () => false }));

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
}

function status(state: WebsiteScrapeStatus["status"], url = "old.example"): WebsiteScrapeStatus {
  return { status: state, url, market: "", offer: "", audience: "", value: "", strategyStatus: "", error: null };
}

describe("website analysis recovery", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(apiFetch).mockReset();
    vi.stubGlobal("window", {
      localStorage: memoryStorage(),
      sessionStorage: memoryStorage(),
      location: { pathname: "/onboarding/discovery" },
      setTimeout,
      clearTimeout,
    });
    setDiscoveryOrgScope("org-a");
    writeDiscoveryScrapeCache(status("completed"), "org:org-a");
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it.each(["completed", "failed"] as const)("explicitly retries a %s response with missing summary fields", async (state) => {
    const controller = createScrapeController("authenticated");
    vi.mocked(apiFetch)
      .mockResolvedValueOnce(status(state))
      .mockResolvedValueOnce(status("running"));

    await controller.retry();

    expect(apiFetch).toHaveBeenNthCalledWith(2, "/discovery/scrape", {
      method: "POST", body: JSON.stringify({ url: "old.example" }),
    });
    expect(controller.getSnapshot().status.status).toBe("running");
  });

  it("can retry a website recovered from the server without a local cache", async () => {
    const controller = createScrapeController("authenticated");
    window.localStorage.removeItem("lr_discovery_scrape");
    vi.mocked(apiFetch)
      .mockResolvedValueOnce(status("completed"))
      .mockResolvedValueOnce(status("running"));

    await controller.retry();

    expect(apiFetch).toHaveBeenNthCalledWith(2, "/discovery/scrape", {
      method: "POST", body: JSON.stringify({ url: "old.example" }),
    });
    expect(readDiscoveryScrapeCache()).toMatchObject({ scope: "org:org-a", url: "old.example" });
  });

  it("keeps navigation waits from restarting a completed analysis", async () => {
    const controller = createScrapeController("authenticated");
    vi.mocked(apiFetch).mockResolvedValue(status("completed"));

    expect((await controller.waitForReadyToNavigate()).status).toBe("completed");
    expect(apiFetch).toHaveBeenCalledExactlyOnceWith("/discovery/scrape-status");
  });

  it("keeps polling a running analysis without starting a duplicate", async () => {
    const controller = createScrapeController("authenticated");
    vi.mocked(apiFetch).mockResolvedValue(status("running"));

    await controller.retry();
    await vi.advanceTimersByTimeAsync(2000);

    expect(apiFetch).toHaveBeenCalledTimes(2);
    expect(vi.mocked(apiFetch).mock.calls.every(([path]) => path === "/discovery/scrape-status")).toBe(true);
  });

  it("shares an in-flight request when retry is clicked again", async () => {
    const controller = createScrapeController("authenticated");
    let resolveStatus!: (value: WebsiteScrapeStatus) => void;
    vi.mocked(apiFetch).mockReturnValueOnce(new Promise((resolve) => { resolveStatus = resolve; }));

    const first = controller.retry();
    const second = controller.retry();
    resolveStatus(status("running"));
    await Promise.all([first, second]);

    expect(apiFetch).toHaveBeenCalledExactlyOnceWith("/discovery/scrape-status");
  });

  it("uses a corrected website in the active organization instead of the old scoped URL", async () => {
    const controller = createScrapeController("authenticated");
    window.localStorage.setItem("lr_website_url", "unrelated.example");
    vi.mocked(apiFetch)
      .mockResolvedValueOnce(status("completed"))
      .mockResolvedValueOnce(status("running", "correct.example"));

    await controller.ensureWebsiteScrapeStarted({ websiteUrl: "correct.example" });

    expect(apiFetch).toHaveBeenNthCalledWith(2, "/discovery/scrape", {
      method: "POST", body: JSON.stringify({ url: "correct.example" }),
    });
    expect(readDiscoveryScrapeCache()).toMatchObject({ scope: "org:org-a", url: "correct.example" });
    expect(window.localStorage.getItem("lr_website_url")).toBeNull();
  });

  it("waits for an existing analysis before starting the corrected website", async () => {
    const controller = createScrapeController("authenticated");
    vi.mocked(apiFetch)
      .mockResolvedValueOnce(status("running"))
      .mockResolvedValueOnce(status("completed"))
      .mockResolvedValueOnce(status("running", "correct.example"));

    await controller.ensureWebsiteScrapeStarted({ websiteUrl: "correct.example" });
    expect(apiFetch).toHaveBeenCalledTimes(1);
    expect(readDiscoveryScrapeCache()?.url).toBe("correct.example");
    await vi.advanceTimersByTimeAsync(2000);

    expect(apiFetch).toHaveBeenNthCalledWith(3, "/discovery/scrape", {
      method: "POST", body: JSON.stringify({ url: "correct.example" }),
    });
    expect(controller.getSnapshot().websiteUrl).toBe("correct.example");
  });

  it.each(["completed", "running"] as const)("retries a corrected website when its start returns the old %s result under a scrape lock", async (lockedState) => {
    const controller = createScrapeController("authenticated");
    const oldResult = { ...status("completed"), market: "Old industry", offer: "Old offer", audience: "Old audience", value: "Old value" };
    const published: WebsiteScrapeStatus[] = [];
    controller.subscribe((snapshot) => published.push(snapshot.status));
    vi.mocked(apiFetch)
      .mockResolvedValueOnce(oldResult)
      .mockResolvedValueOnce({ ...oldResult, status: lockedState })
      .mockResolvedValueOnce(oldResult)
      .mockResolvedValueOnce(status("running", "correct.example"))
      .mockResolvedValueOnce({ ...status("completed", "correct.example"), offer: "Correct offer" });

    await controller.retry("correct.example");

    expect(controller.getSnapshot()).toMatchObject({
      websiteUrl: "correct.example",
      status: { status: "running", url: "correct.example", market: "", offer: "", audience: "", value: "" },
    });
    expect(readDiscoveryScrapeCache()).toMatchObject({ url: "correct.example", status: "running", offer: "" });
    await vi.advanceTimersByTimeAsync(2000);

    expect(apiFetch).toHaveBeenNthCalledWith(4, "/discovery/scrape", {
      method: "POST", body: JSON.stringify({ url: "correct.example" }),
    });
    expect(controller.getSnapshot().status).toMatchObject({ status: "running", url: "correct.example" });
    await vi.advanceTimersByTimeAsync(2000);

    expect(controller.getSnapshot().status).toMatchObject({ status: "completed", url: "correct.example", offer: "Correct offer" });
    expect(published.some((snapshot) => snapshot.url === "old.example" || snapshot.offer === "Old offer")).toBe(false);
  });

  it("ignores an old response after selecting a different website", async () => {
    const controller = createScrapeController("authenticated");
    let resolveOldStatus!: (value: WebsiteScrapeStatus) => void;
    vi.mocked(apiFetch)
      .mockReturnValueOnce(new Promise((resolve) => { resolveOldStatus = resolve; }))
      .mockResolvedValueOnce(status("completed"))
      .mockResolvedValueOnce(status("running", "correct.example"));

    const oldRequest = controller.ensureWebsiteScrapeStarted();
    await controller.ensureWebsiteScrapeStarted({ websiteUrl: "correct.example" });
    resolveOldStatus(status("completed"));
    await oldRequest;

    expect(controller.getSnapshot()).toMatchObject({ websiteUrl: "correct.example", status: { url: "correct.example", status: "running" } });
    expect(readDiscoveryScrapeCache()?.url).toBe("correct.example");
  });

  it("does not copy an in-flight response into another organization's cache", async () => {
    const controller = createScrapeController("authenticated");
    let resolveOldStatus!: (value: WebsiteScrapeStatus) => void;
    vi.mocked(apiFetch).mockReturnValueOnce(new Promise((resolve) => { resolveOldStatus = resolve; }));

    const request = controller.ensureWebsiteScrapeStarted();
    setDiscoveryOrgScope("org-b");
    writeDiscoveryScrapeCache(status("completed", "other.example"), "org:org-b");
    resolveOldStatus(status("completed"));
    await request;

    expect(readDiscoveryScrapeCache()).toMatchObject({ scope: "org:org-b", url: "other.example" });
  });
});
