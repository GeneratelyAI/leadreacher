import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { captureStoryObjects, isStoryObjectReady, storyTiming } from "../story-handoff";

const drawImage = vi.fn();
const fillRect = vi.fn();
const computed = { visibility: "visible", borderRadius: "14px", backgroundColor: "rgb(9, 16, 38)", objectFit: "contain", objectPosition: "50% 50%" };

class ElementFixture {
  style: Record<string, string> = {};
  dataset: Record<string, string> = {};
  children: ElementFixture[] = [];
  parentElement: ElementFixture | null = null;
  isConnected = true;
  visual: ElementFixture | null = null;
  kind = "div";
  ready = true;
  selected = true;
  computed = computed;
  matches(selector: string) { return selector.split(", ").includes(this.kind); }
  closest(selector: string) { return ((!this.ready && selector.includes("data-story-ready")) || (!this.selected && selector.includes("data-story-selected"))) ? this : null; }
  querySelector(selector: string) { return selector === "[data-story-visual]" ? null : this.visual; }
  getBoundingClientRect() { return { x: 10, y: 20, left: 10, top: 20, right: 210, bottom: 120, width: 200, height: 100 }; }
  append(child: ElementFixture) { this.children.push(child); }
  setAttribute() {}
}

class ImageFixture extends ElementFixture {
  kind = "img";
  complete = true;
  naturalWidth = 100;
  naturalHeight = 100;
  src = "";
  isConnected = false;
  decode() { return Promise.resolve(); }
}

class VideoFixture extends ElementFixture {
  kind = "video";
  readyState = 2;
  videoWidth = 100;
  videoHeight = 100;
  poster = "";
  paused = true;
  currentTime = 0;
}

class CanvasFixture extends ElementFixture {
  kind = "canvas";
  width = 0;
  height = 0;
  getContext() { return { drawImage, fillRect, fillStyle: "" }; }
}

const objects: ElementFixture[] = [];

beforeEach(() => {
  objects.length = 0;
  vi.clearAllMocks();
  vi.stubGlobal("HTMLImageElement", ImageFixture);
  vi.stubGlobal("Image", ImageFixture);
  vi.stubGlobal("HTMLVideoElement", VideoFixture);
  vi.stubGlobal("HTMLCanvasElement", CanvasFixture);
  vi.stubGlobal("SVGElement", class extends ElementFixture {});
  vi.stubGlobal("innerHeight", 900);
  vi.stubGlobal("window", { devicePixelRatio: 2 });
  vi.stubGlobal("document", {
    documentElement: {},
    querySelector: () => null,
    querySelectorAll: (selector: string) => selector === "[data-story-object]" ? objects : objects.flatMap((node) => {
      const video = node instanceof VideoFixture ? node : node.visual;
      return video instanceof VideoFixture && video.poster ? [video] : [];
    }),
    createElement: (tag: string) => tag === "canvas" ? new CanvasFixture() : new ElementFixture(),
  });
  vi.stubGlobal("getComputedStyle", (node: ElementFixture) => node.computed ?? { getPropertyValue: () => "" });
});

afterEach(() => vi.unstubAllGlobals());

describe("story snapshot readiness and identity", () => {
  it("keeps the shared deliberate handoff at1400ms", () => {
    expect(storyTiming(false, false, true).duration).toBe(1400);
    expect(storyTiming(true, false, true).duration).toBe(1400);
  });

  it("does not capture unselected channel marks", () => {
    const selected = new ImageFixture();
    selected.dataset.storyObject = "channel:gmail";
    const unselected = new ImageFixture();
    unselected.dataset.storyObject = "channel:outlook";
    unselected.selected = false;
    objects.push(selected, unselected);
    expect(captureStoryObjects().map((object) => object.key)).toEqual(["channel:gmail"]);
  });

  it("does not treat a measurable but unpainted attachment as ready", () => {
    const node = new VideoFixture();
    node.ready = false;
    expect(isStoryObjectReady(node as unknown as HTMLElement)).toBe(false);
    node.ready = true;
    node.readyState = 0;
    expect(isStoryObjectReady(node as unknown as HTMLElement)).toBe(false);
    node.readyState = 2;
    expect(isStoryObjectReady(node as unknown as HTMLElement)).toBe(true);
  });

  it("captures the poster actually on screen instead of a different decoded frame", () => {
    const node = new VideoFixture();
    node.dataset.storyObject = "media";
    node.poster = "/campaign-poster.png";
    objects.push(node);
    expect(captureStoryObjects()).toHaveLength(1);
    expect(drawImage.mock.calls[0][0]).toBeInstanceOf(ImageFixture);
    expect((drawImage.mock.calls[0][0] as ImageFixture).src).toBe(node.poster);
  });

  it("preserves contain letterboxing and the source radius in inert snapshots", () => {
    const node = new VideoFixture();
    node.dataset.storyObject = "media";
    node.dataset.storyAsset = "campaign:uploaded-video";
    objects.push(node);
    const [snapshot] = captureStoryObjects();
    expect(snapshot.asset).toBe("campaign:uploaded-video");
    expect(snapshot.layer.style.borderRadius).toBe("14px");
    expect(fillRect).toHaveBeenCalledWith(0, 0, 400, 200);
    expect(drawImage).toHaveBeenCalledWith(node, 100, 0, 200, 200);
    expect(snapshot.layer.inert).toBe(true);
  });
});
