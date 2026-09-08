import { afterEach, describe, expect, it, vi } from "vitest";
import { startBetterStackHeartbeat } from "../better-stack.js";

describe("startBetterStackHeartbeat", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("does nothing when no heartbeat URL is configured", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const stop = startBetterStackHeartbeat({
      name: "campaign-worker",
      url: undefined,
    });

    expect(fetchMock).not.toHaveBeenCalled();
    stop();
  });

  it("checks in immediately and stops after shutdown", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    const stop = startBetterStackHeartbeat({
      name: "campaign-worker",
      url: "https://uptime.betterstack.com/api/v1/heartbeat/test-token",
      intervalMs: 60_000,
    });

    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    stop();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
