import { afterEach, describe, expect, it, vi } from "vitest";
import { callGroq, GROQ_TEXT_MODELS } from "../groq.js";

function completion(content: string): Response {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("callGroq", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("uses the primary model when it succeeds", async () => {
    const fetchMock = vi.fn().mockResolvedValue(completion('{"market":"restaurants"}'));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      callGroq("Return JSON", [{ role: "user", content: "Analyze mrsub.ca" }], 500, {
        jsonObject: true,
      }),
    ).resolves.toBe('{"market":"restaurants"}');

    const request = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(request.model).toBe(GROQ_TEXT_MODELS[0]);
    expect(request.response_format).toEqual({ type: "json_object" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to the 120B model when the primary model is rate limited", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { code: "rate_limit_exceeded" } }), {
          status: 429,
        }),
      )
      .mockResolvedValueOnce(completion('{"market":"quick-service restaurants"}'));
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await expect(
      callGroq("Return JSON", [{ role: "user", content: "Analyze mrsub.ca" }], 500, {
        jsonObject: true,
      }),
    ).resolves.toBe('{"market":"quick-service restaurants"}');

    const primaryRequest = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    const fallbackRequest = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body));
    expect(primaryRequest.model).toBe(GROQ_TEXT_MODELS[0]);
    expect(fallbackRequest.model).toBe(GROQ_TEXT_MODELS[1]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not hide non-transient request errors behind a fallback", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { code: "invalid_request" } }), {
        status: 400,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      callGroq("Return JSON", [{ role: "user", content: "Analyze" }], 500),
    ).rejects.toThrow("Groq");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
