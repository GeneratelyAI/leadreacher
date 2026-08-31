import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../config/env.js", () => ({
  env: { UNIPILE_WEBHOOK_SECRET: "test-secret" },
}));

import { UnipileAdapter } from "../unipile.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("UnipileAdapter.startChat", () => {
  it("sends a LinkedIn MP4 using a native v2 attachment", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ chat_id: "chat-1" }),
      { status: 201, headers: { "Content-Type": "application/json" } },
    ));
    vi.stubGlobal("fetch", fetchMock);

    const adapter = new UnipileAdapter({ apiKey: "key" });
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

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.unipile.com/v2/account-1/chats/send");
    expect(JSON.parse(String(init.body))).toEqual({
      text: "Thanks for connecting.",
      users_ids: "ACo-lead-1",
      attachments: [{
        content: Buffer.from("mp4-content").toString("base64"),
        content_type: "video/mp4",
        filename: "personalized-video-lead-1.mp4",
        send_mode: "native",
      }],
    });
  });
});
