/** Static visual snapshots only: no cloned media players or controls. */
export type StoryObject = {
  key: string;
  asset: string;
  bounds: DOMRect;
  layer: HTMLElement;
};

const posters = new Map<string, HTMLImageElement>();

/** Decode posters while their real video elements are mounted, before activation. */
export function prepareStoryPosters() {
  document.querySelectorAll<HTMLVideoElement>("[data-story-object] video[poster], video[data-story-object][poster]").forEach((video) => {
    if (!video.poster || posters.has(video.poster)) return;
    const poster = new Image();
    poster.src = video.poster;
    posters.set(video.poster, poster);
    void poster.decode().catch(() => {});
    if (posters.size > 32) posters.delete(posters.keys().next().value!);
  });
}

function storyVisual(node: HTMLElement): Element | null {
  const explicit = node.matches("[data-story-visual]") ? node : node.querySelector("[data-story-visual]");
  const visual = explicit ?? (node.matches("canvas, img, video, svg") ? node : node.querySelector("canvas, img, video, svg"));
  if (visual instanceof HTMLVideoElement && visual.poster && visual.paused && visual.currentTime === 0) {
    const poster = posters.get(visual.poster);
    return poster?.complete && poster.naturalWidth ? poster : null;
  }
  return visual;
}

export function isStoryObjectReady(node: HTMLElement): boolean {
  if (node.closest('[data-story-ready="false"]')) return false;
  const visual = storyVisual(node);
  if (visual instanceof HTMLCanvasElement) return visual.width > 0 && visual.height > 0;
  if (visual instanceof HTMLImageElement) return visual.complete && visual.naturalWidth > 0;
  if (visual instanceof HTMLVideoElement) return visual.readyState >= 2 && visual.videoWidth > 0;
  return visual instanceof SVGElement;
}

function sourceFrame(node: HTMLElement, visual: Element) {
  const bounds = node.getBoundingClientRect();
  if (node.dataset.storyObject?.startsWith("channel:") && visual.isConnected) return { bounds: visual.getBoundingClientRect(), style: getComputedStyle(node) };
  const parent = node.parentElement;
  const parentBounds = parent?.getBoundingClientRect();
  const style = getComputedStyle(node);
  const radiusParent = parent && parentBounds && Math.abs(parentBounds.width - bounds.width) < 1 && Math.abs(parentBounds.height - bounds.height) < 1 && style.borderRadius === "0px";
  return { bounds, style: radiusParent ? getComputedStyle(parent) : style };
}

function backgroundFor(node: HTMLElement): string {
  for (let current: HTMLElement | null = node; current; current = current.parentElement) {
    const color = getComputedStyle(current).backgroundColor;
    if (color !== "rgba(0, 0, 0, 0)" && color !== "transparent") return color;
  }
  return "transparent";
}

function positionOffset(value: string, remaining: number): number {
  if (value.endsWith("%")) return remaining * parseFloat(value) / 100;
  if (value === "left" || value === "top") return 0;
  if (value === "right" || value === "bottom") return remaining;
  if (value === "center") return remaining / 2;
  return parseFloat(value) || 0;
}

export function storyTiming(backward = false, local = false, handoff = false) {
  const canvas = document.querySelector(".onboarding-campaign-scene");
  const style = getComputedStyle(canvas ?? document.documentElement);
  const property = handoff
    ? "--onboarding-motion-story-handoff"
    : local
      ? "--onboarding-motion-state"
      : backward
        ? "--onboarding-motion-scene-back"
        : "--onboarding-motion-scene";
  const value = style.getPropertyValue(property).trim();
  const duration = parseFloat(value) * (value.endsWith("ms") ? 1 : 1000);
  const fallback = handoff ? 1400 : backward || local ? 240 : 320;
  return { duration: Number.isFinite(duration) ? duration : fallback, easing: style.getPropertyValue("--onboarding-motion-ease").trim() || "cubic-bezier(0.16, 1, 0.3, 1)" };
}

export function captureStoryObjects(): StoryObject[] {
  prepareStoryPosters();
  return Array.from(document.querySelectorAll<HTMLElement>("[data-story-object]")).flatMap((node) => {
    if (node.closest("[data-selected='false'], [data-story-selected='false'], [aria-checked='false'], dialog:not([open])")) return [];
    if (!isStoryObjectReady(node)) return [];
    const visual = storyVisual(node);
    if (!visual) return [];
    const { bounds, style: frameStyle } = sourceFrame(node, visual);
    if (!bounds.width || !bounds.height || bounds.bottom <= 0 || bounds.top >= innerHeight || getComputedStyle(node).visibility === "hidden") return [];
    let layer: HTMLElement;
    if (visual instanceof HTMLCanvasElement || visual instanceof HTMLImageElement || visual instanceof HTMLVideoElement) {
      const width = visual instanceof HTMLCanvasElement ? visual.width : visual instanceof HTMLVideoElement ? visual.videoWidth : visual.naturalWidth;
      const height = visual instanceof HTMLCanvasElement ? visual.height : visual instanceof HTMLVideoElement ? visual.videoHeight : visual.naturalHeight;
      if (!width || !height) return [];
      const pixels = document.createElement("canvas");
      const resolution = Math.min(3, Math.max(1, window.devicePixelRatio || 1));
      pixels.width = Math.round(bounds.width * resolution);
      pixels.height = Math.round(bounds.height * resolution);
      const context = pixels.getContext("2d");
      if (!context) return [];
      const visibleElement = visual.isConnected ? visual : node.matches("video") ? node : node.querySelector("video") ?? node;
      const visualStyle = getComputedStyle(visibleElement);
      const scale = visualStyle.objectFit === "contain"
        ? Math.min(pixels.width / width, pixels.height / height)
        : Math.max(pixels.width / width, pixels.height / height);
      const [horizontal = "50%", vertical = "50%"] = visualStyle.objectPosition.split(" ");
      if (node.dataset.storyObject === "media") {
        context.fillStyle = backgroundFor(node);
        context.fillRect(0, 0, pixels.width, pixels.height);
      }
      try { context.drawImage(visual, positionOffset(horizontal, pixels.width - width * scale), positionOffset(vertical, pixels.height - height * scale), width * scale, height * scale); }
      catch { return []; }
      layer = document.createElement("div");
      Object.assign(pixels.style, {
        display: "block",
        width: "100%",
        height: "100%",
        objectFit: "cover",
      });
      layer.append(pixels);
    } else if (visual instanceof SVGElement && !visual.querySelector("image, use")) {
      layer = document.createElement("div");
      const svg = visual.cloneNode(true) as SVGElement;
      svg.removeAttribute("id");
      svg.querySelectorAll("[id]").forEach((element) => element.removeAttribute("id"));
      Object.assign(svg.style, { width: "100%", height: "100%", color: getComputedStyle(visual).color });
      layer.append(svg);
    } else return [];
    layer.className = "onboarding-story-object";
    layer.dataset.storySnapshot = node.dataset.storyObject;
    layer.dataset.storyAsset = node.dataset.storyAsset ?? "";
    layer.setAttribute("aria-hidden", "true");
    layer.inert = true;
    Object.assign(layer.style, { position: "fixed", pointerEvents: "none", zIndex: "80", left: `${bounds.left}px`, top: `${bounds.top}px`, width: `${bounds.width}px`, height: `${bounds.height}px`, margin: "0", overflow: "hidden", borderRadius: frameStyle.borderRadius, transformOrigin: "top left" });
    return [{ key: node.dataset.storyObject!, asset: node.dataset.storyAsset ?? "", bounds, layer }];
  });
}
