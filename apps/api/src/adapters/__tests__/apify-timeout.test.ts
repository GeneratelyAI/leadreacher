import { afterEach, describe, expect, it, vi } from "vitest";
import { ApifyAdapter } from "../apify.js";

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("Apify adapter timeouts", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("aborts the actor run before reporting a polling timeout", async () => {
    const fetchMock = vi.fn(async (): Promise<Response> => jsonResponse({}));
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(Date, "now")
      .mockReturnValueOnce(0)
      .mockReturnValue(120_000);

    const adapter = new ApifyAdapter({ apiKey: "test-token" });
    const waitForRun = (
      adapter as unknown as {
        waitForRun: (actorId: string, runId: string) => Promise<void>;
      }
    ).waitForRun.bind(adapter);

    await expect(
      waitForRun("harvestapi~linkedin-profile-search", "timed-out-run"),
    ).rejects.toThrow("Actor run timed out");

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/actor-runs/timed-out-run/abort"),
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("surfaces Apify free-run limits instead of treating the run as empty", async () => {
    const fetchMock = vi.fn(async (): Promise<Response> =>
      jsonResponse({
        data: {
          status: "SUCCEEDED",
          statusMessage: "free user run limit reached",
          isStatusMessageTerminal: true,
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const adapter = new ApifyAdapter({ apiKey: "test-token" });
    const waitForRun = (
      adapter as unknown as {
        waitForRun: (actorId: string, runId: string) => Promise<void>;
      }
    ).waitForRun.bind(adapter);

    await expect(
      waitForRun("harvestapi~linkedin-profile-search", "quota-run"),
    ).rejects.toThrow("free user run limit reached");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps polling past a non-terminal free-tier queuing message until the run finishes", async () => {
    vi.useFakeTimers();
    let call = 0;
    const fetchMock = vi.fn(async (): Promise<Response> => {
      call += 1;
      if (call === 1) {
        return jsonResponse({
          data: {
            status: "READY",
            statusMessage: "free user run limit reached, waiting in queue",
            isStatusMessageTerminal: false,
          },
        });
      }
      return jsonResponse({ data: { status: "SUCCEEDED" } });
    });
    vi.stubGlobal("fetch", fetchMock);

    const adapter = new ApifyAdapter({ apiKey: "test-token" });
    const waitForRun = (
      adapter as unknown as {
        waitForRun: (actorId: string, runId: string) => Promise<void>;
      }
    ).waitForRun.bind(adapter);

    const promise = waitForRun("harvestapi~linkedin-profile-search", "queued-then-succeeds");
    await vi.advanceTimersByTimeAsync(3000);
    await expect(promise).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});
