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
    expect(request.reasoning_effort).toBe("none");
    expect(request.response_format).toEqual({ type: "json_object" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to the next model when the primary model is rate limited", async () => {
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

  it("falls back when a model exhausts its completion budget before valid JSON", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { code: "json_validate_failed", message: "max completion tokens reached before generating a valid document" } }), {
          status: 400,
        }),
      )
      .mockResolvedValueOnce(completion('{"market":"healthcare"}'));
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await expect(
      callGroq("Return JSON", [{ role: "user", content: "Analyze" }], 500, {
        jsonObject: true,
      }),
    ).resolves.toBe('{"market":"healthcare"}');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("falls back when the preferred model is unavailable to the organization", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: "The model is blocked at the organization level" } }), {
          status: 403,
        }),
      )
      .mockResolvedValueOnce(completion('{"market":"restaurants"}'));
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await expect(
      callGroq("Return JSON", [{ role: "user", content: "Analyze" }], 500),
    ).resolves.toBe('{"market":"restaurants"}');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("uses strict structured output when a JSON schema is supplied", async () => {
    const fetchMock = vi.fn().mockResolvedValue(completion('{"market":"restaurants"}'));
    vi.stubGlobal("fetch", fetchMock);
    const schema = {
      type: "object",
      properties: { market: { type: "string" } },
      required: ["market"],
      additionalProperties: false,
    };

    await callGroq("Return JSON", [{ role: "user", content: "Analyze" }], 500, {
      jsonSchema: { name: "discovery", schema },
    });

    const request = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(request.response_format).toEqual({
      type: "json_schema",
      json_schema: { name: "discovery", strict: true, schema },
    });
  });

  it("retries a short provider-directed rate limit before changing models", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { code: "rate_limit_exceeded" } }), {
          status: 429,
          headers: { "retry-after": "0" },
        }),
      )
      .mockResolvedValueOnce(completion('{"market":"restaurants"}'));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      callGroq("Return JSON", [{ role: "user", content: "Analyze" }], 500),
    ).resolves.toBe('{"market":"restaurants"}');

    const firstRequest = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    const retryRequest = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body));
    expect(retryRequest.model).toBe(firstRequest.model);
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
