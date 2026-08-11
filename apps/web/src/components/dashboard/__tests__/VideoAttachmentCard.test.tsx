import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { VideoAttachmentCard } from "../VideoAttachmentCard";

describe("VideoAttachmentCard", () => {
  it("renders a native inline video with an accessible playback control", () => {
    const markup = renderToStaticMarkup(
      <VideoAttachmentCard
        src="https://media.example/personalized-video.mp4"
        poster="https://media.example/personalized-video.jpg"
        filename="Sarah's personalized video"
      />,
    );

    expect(markup).toContain("<video");
    expect(markup).toContain('playsInline=""');
    expect(markup).toContain('muted=""');
    expect(markup).toContain('poster="https://media.example/personalized-video.jpg"');
    expect(markup).toContain("Play Sarah&#x27;s personalized video");
    expect(markup).toContain('target="_blank"');
  });
});
