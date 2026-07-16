import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../config/env.js", () => ({
  env: { UNIPILE_WEBHOOK_SECRET: "test-secret" },
}));

import { UnipileAdapter } from "../unipile.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("UnipileAdapter.startChat", () => {
  it("sends a LinkedIn MP4 using Unipile's native video_message field", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ chat_id: "chat-1" }),
      { status: 201, headers: { "Content-Type": "application/json" } },
    ));
    vi.stubGlobal("fetch", fetchMock);

    const adapter = new UnipileAdapter({ dsn: "api.example.com", apiKey: "key" });
    await adapter.startChat(
      "account-1",
      "ACo-lead-1",
      "Thanks for connecting.",
      {
        videoMessage: {
          buffer: Buffer.from("mp4-content"),
          filename: "personalized-video-lead-1.mp4",
          contentType: "video/mp4",
        },
      },
    );

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const form = init.body as FormData;
    const video = form.get("video_message");
    expect(form.get("text")).toBe("Thanks for connecting.");
    expect(video).toBeInstanceOf(Blob);
    expect((video as File).type).toBe("video/mp4");
    expect((video as File).name).toBe("personalized-video-lead-1.mp4");
  });
});
