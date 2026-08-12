import { describe, expect, it } from "vitest";
import { verifyR2PublicVideo } from "../production-preflight.js";

describe("production preflight R2 check", () => {
  it("accepts an MP4 response with byte-range support", async () => {
    const fetcher = async (): Promise<Response> =>
      new Response("ok", {
        status: 206,
        headers: { "content-type": "video/mp4", "content-range": "bytes 0-1/2" },
      });

    await expect(verifyR2PublicVideo("https://cdn.example.test/video.mp4", fetcher)).resolves.toBeUndefined();
  });

  it("rejects a public object without MP4 range playback", async () => {
    const fetcher = async (): Promise<Response> =>
      new Response("missing", { status: 200, headers: { "content-type": "text/plain" } });

    await expect(verifyR2PublicVideo("https://cdn.example.test/video.mp4", fetcher)).rejects.toThrow(
      "R2 preflight failed",
    );
  });
});
