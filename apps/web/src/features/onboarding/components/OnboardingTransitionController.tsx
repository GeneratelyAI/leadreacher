"use client";

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { captureStoryObjects, isStoryObjectReady, prepareStoryPosters, storyTiming, type StoryObject } from "./story-handoff";

export type OnboardingSceneDirection = "forward" | "backward";
export type OnboardingScenePhase = "idle" | "exiting" | "entering";

type SceneMotionState = {
  direction: OnboardingSceneDirection;
  phase: OnboardingScenePhase;
};

type NavigationDetail = {
  href: string;
  replace: boolean;
};

const NAVIGATION_EVENT = "leadreacher:onboarding-navigate";
const DEPARTURE_EVENT = "leadreacher:onboarding-departure";
const DEPARTURE_CANCEL_EVENT = "leadreacher:onboarding-departure-cancel";
const sceneMotionContext = createContext<SceneMotionState>({ direction: "forward", phase: "idle" });

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function usesMobileLayout(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(max-width: 63rem)").matches;
}

function isImmediateMobileAudienceTransition(from: string, to: string): boolean {
  return window.matchMedia("(max-width: 63rem)").matches && (
    (from === "how-leadreacher-works" && to === "discovery") ||
    (from === "discovery" && to === "how-leadreacher-works")
  );
}

function sceneFromUrl(url: URL): string {
  if (url.searchParams.get("view") === "website") return "website";
  const path = url.pathname
    .replace(/^\/onboarding-preview/, "/onboarding")
    .replace(/^\/demo\/onboarding/, "/onboarding");
  if (path === "/onboarding/how-leadreacher-works") return "how-leadreacher-works";
  if (path === "/onboarding/discovery") return "discovery";
  if (path === "/onboarding/campaign-content") return "campaign-content";
  if (path.startsWith("/onboarding/campaign-content/")) return path.split("/").at(-1) ?? "campaign-content";
  return path.split("/").filter(Boolean).at(-1) ?? "";
}

function scenePosition(href: string): number {
  const url = new URL(href, window.location.origin);
  const scene = sceneFromUrl(url);
  if (scene === "website") return -1;
  if (scene === "how-leadreacher-works") return 0;
  if (scene === "discovery") return 1;
  if (scene === "campaign-content") return 2;
  if (["personalized-video", "ai-video", "your-video", "document"].includes(scene)) return 3;
  if (scene === "cta") return 4;
  if (scene === "channels") return 5;
  if (scene === "checkout") return 6;
  if (scene === "connect-channels") return 7;
  return 0;
}

function directionFor(source: string, destination: string): OnboardingSceneDirection {
  return scenePosition(destination) < scenePosition(source) ? "backward" : "forward";
}

function carriesObject(object: StoryObject, source: string, destination: string) {
  if (source === destination) return false;
  if (object.key === "content:upload") return (source === "campaign-content" && destination === "your-video") || (source === "your-video" && destination === "campaign-content");
  const creative = ["personalized-video", "ai-video", "your-video", "document"];
  if (object.key === "media") return (creative.includes(source) && ["cta", "campaign-content"].includes(destination)) || (["cta", "campaign-content"].includes(source) && creative.includes(destination));
  return !usesMobileLayout() && object.key.startsWith("channel:") && isChannelHandoff(source, destination);
}

function isDeliberateStoryHandoff(objects: StoryObject[], source: string, destination: string) {
  if ((source === "cta" || destination === "cta") && objects.some((object) => object.key === "media")) return true;
  const carriesChannels = objects.some((object) => object.key.startsWith("channel:"));
  return carriesChannels && isChannelHandoff(source, destination);
}

function isChannelHandoff(source: string, destination: string): boolean {
  return (source === "channels" && destination === "checkout") || (source === "checkout" && destination === "channels");
}

function sampledStoryPath({
  dx,
  dy,
  sourceWidth,
  sourceHeight,
  targetWidth,
  targetHeight,
  sourceRadius,
  targetRadius,
  arc,
}: {
  dx: number;
  dy: number;
  sourceWidth: number;
  sourceHeight: number;
  targetWidth: number;
  targetHeight: number;
  sourceRadius: string;
  targetRadius: string;
  arc: number;
}): Keyframe[] {
  const controlX = dx * .5;
  const controlY = Math.max(0, dy) + arc;
  return Array.from({ length: 13 }, (_, point) => {
    const progress = point / 12;
    const eased = progress ** 3 * (progress * (progress * 6 - 15) + 10);
    const inverse = 1 - eased;
    const x = 2 * inverse * eased * controlX + eased * eased * dx;
    const y = 2 * inverse * eased * controlY + eased * eased * dy;
    const settle = eased < .8 ? eased * .92 : .736 + ((eased - .8) / .2) * .264;
    const glow = Math.sin(Math.PI * eased);
    return {
      transform: `translate3d(${x}px, ${y}px, 0)`,
      width: `${sourceWidth + (targetWidth - sourceWidth) * settle}px`,
      height: `${sourceHeight + (targetHeight - sourceHeight) * settle}px`,
      borderRadius: progress < 1 ? sourceRadius : targetRadius,
      opacity: 1,
      filter: `brightness(${1 + glow * .065}) drop-shadow(0 ${glow * 12}px ${glow * 18}px rgb(83 56 231 / ${glow * 22}%))`,
      offset: progress,
    };
  });
}

function applyHistory(detail: NavigationDetail) {
  if (detail.replace) {
    window.history.replaceState(null, "", detail.href);
  } else {
    window.history.pushState(null, "", detail.href);
  }
}

export function useOnboardingSceneMotion() {
  return useContext(sceneMotionContext);
}

const EASE = "cubic-bezier(0.16, 1, 0.3, 1)";
const AUDIENCE_MORPH = { travel: 1120, stagger: 75, formation: 620, settle: 1760 };

/** Layout coordinates, independent of hover or route transforms. */
function stableBounds(node: HTMLElement) {
  let left = 0, top = 0;
  for (let current: HTMLElement | null = node; current; current = current.offsetParent as HTMLElement | null) {
    left += current.offsetLeft;
    top += current.offsetTop;
  }
  for (let parent = node.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
    left -= parent.scrollLeft;
    top -= parent.scrollTop;
  }
  return { left: left - window.scrollX, top: top - window.scrollY, width: node.offsetWidth, height: node.offsetHeight };
}

/** Owns route-level motion. The persistent canvas and campaign pill never animate here. */
export function OnboardingTransitionController({
  sceneKey,
  children,
}: {
  sceneKey: string;
  children: ReactNode;
}) {
  const previousSceneKey = useRef(sceneKey);
  const pendingDirection = useRef<OnboardingSceneDirection | null>(null);
  const timers = useRef<number[]>([]);
  const animations = useRef<Animation[]>([]);
  const bridges = useRef<HTMLElement[]>([]);
  const outgoing = useRef<HTMLElement | null>(null);
  const formationLayers = useRef<HTMLElement[]>([]);
  const pendingBridge = useRef(false);
  const returningRows = useRef<ReturnType<typeof stableBounds>[]>([]);
  const [motion, setMotion] = useState<SceneMotionState>({ direction: "forward", phase: "idle" });
  const storyObjects = useRef<StoryObject[]>([]);
  const storyFrame = useRef(0);
  const storyRestores = useRef<Array<() => void>>([]);
  const nativeStory = useRef<(() => void) | null>(null);
  const nativeCommit = useRef<(() => void) | null>(null);
  const preparedDestination = useRef<string | null>(null);
  const navigationLockUntil = useRef(0);
  const lockedNavigationHref = useRef<string | null>(null);
  const lockedNavigationDirection = useRef<OnboardingSceneDirection | null>(null);
  const scrollSettlingUntil = useRef(0);

  const clearStory = useCallback(() => {
    cancelAnimationFrame(storyFrame.current);
    storyObjects.current.forEach(({ layer }) => layer.remove());
    storyObjects.current = [];
    storyRestores.current.forEach((restore) => restore());
    storyRestores.current = [];
  }, []);

  const clearTimers = useCallback(() => {
    timers.current.forEach(window.clearTimeout);
    timers.current = [];
  }, []);
  const clearVisuals = useCallback(() => {
    nativeStory.current?.();
    clearStory();
    animations.current.forEach((animation) => animation.cancel());
    animations.current = [];
    bridges.current.forEach((layer) => layer.remove());
    bridges.current = [];
    outgoing.current?.remove();
    outgoing.current = null;
    formationLayers.current.forEach((layer) => layer.remove());
    formationLayers.current = [];
  }, [clearStory]);

  useEffect(() => () => { clearTimers(); clearVisuals(); }, [clearTimers, clearVisuals]);

  useEffect(() => {
    prepareStoryPosters();
    const observer = new MutationObserver(prepareStoryPosters);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["poster"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const captureHistory = () => {
      navigationLockUntil.current = 0;
      preparedDestination.current = null;
      delete document.documentElement.dataset.onboardingDeparture;
      clearTimers();
      clearVisuals();
      if (prefersReducedMotion()) return;
      const destination = sceneFromUrl(new URL(window.location.href));
      scrollSettlingUntil.current = performance.now() + 400;
      storyObjects.current = captureStoryObjects().filter((object) => carriesObject(object, previousSceneKey.current, destination));
      storyObjects.current.forEach(({ layer }) => document.body.append(layer));
    };
    window.addEventListener("popstate", captureHistory, true);
    return () => window.removeEventListener("popstate", captureHistory, true);
  }, [clearTimers, clearVisuals]);

  useEffect(() => {
    // Route rendering can clamp the document scroll position. Let that layout
    // settle before measuring a destination, while user scrolls still cancel.
    const settle = () => { navigationLockUntil.current = 0; nativeCommit.current?.(); clearVisuals(); setMotion((current) => ({ ...current, phase: "idle" })); };
    const scroll = () => { if (performance.now() >= scrollSettlingUntil.current) settle(); };
    const scrollKey = (event: KeyboardEvent) => { if (["PageUp", "PageDown", "Home", "End", "ArrowUp", "ArrowDown", " "].includes(event.key) && !(event.target instanceof HTMLInputElement) && !(event.target instanceof HTMLTextAreaElement)) settle(); };
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const reduce = () => { if (media.matches) settle(); };
    window.addEventListener("resize", settle);
    window.addEventListener("scroll", scroll, { passive: true });
    window.addEventListener("wheel", settle, { passive: true });
    window.addEventListener("touchmove", settle, { passive: true });
    window.addEventListener("keydown", scrollKey);
    media.addEventListener("change", reduce);
    return () => {
      window.removeEventListener("resize", settle);
      window.removeEventListener("scroll", scroll);
      window.removeEventListener("wheel", settle);
      window.removeEventListener("touchmove", settle);
      window.removeEventListener("keydown", scrollKey);
      media.removeEventListener("change", reduce);
    };
  }, [clearVisuals]);

  useEffect(() => {
    const prepareDeparture = (event: Event) => {
      const href = (event as CustomEvent<{ href?: string }>).detail?.href;
      if (!href) return;
      if (preparedDestination.current) {
        event.preventDefault();
        return;
      }
      preparedDestination.current = href;
      const direction = directionFor(`${window.location.pathname}${window.location.search}`, href);
      pendingDirection.current = direction;
      document.documentElement.dataset.onboardingDeparture = direction;
      flushSync(() => setMotion({ direction, phase: "exiting" }));
    };
    const cancelDeparture = () => {
      preparedDestination.current = null;
      pendingDirection.current = null;
      delete document.documentElement.dataset.onboardingDeparture;
      flushSync(() => setMotion((current) => ({ ...current, phase: "idle" })));
    };
    window.addEventListener(DEPARTURE_EVENT, prepareDeparture);
    window.addEventListener(DEPARTURE_CANCEL_EVENT, cancelDeparture);
    return () => {
      window.removeEventListener(DEPARTURE_EVENT, prepareDeparture);
      window.removeEventListener(DEPARTURE_CANCEL_EVENT, cancelDeparture);
    };
  }, []);

  useEffect(() => {
    const onNavigate = (event: Event) => {
      const navigationEvent = event as CustomEvent<NavigationDetail>;
      const detail = navigationEvent.detail;
      if (!detail?.href) return;

      event.preventDefault();
      if (performance.now() < navigationLockUntil.current && (lockedNavigationHref.current === detail.href || (lockedNavigationDirection.current === "backward" && directionFor(`${window.location.pathname}${window.location.search}`, detail.href) === "backward"))) return;
      clearTimers();
      clearVisuals();
      if (detail.href === `${window.location.pathname}${window.location.search}`) {
        preparedDestination.current = null;
        delete document.documentElement.dataset.onboardingDeparture;
        pendingDirection.current = null;
        pendingBridge.current = false;
        returningRows.current = [];
        setMotion((current) => ({ ...current, phase: "idle" }));
        return;
      }
      const direction = directionFor(`${window.location.pathname}${window.location.search}`, detail.href);
      preparedDestination.current = null;
      pendingDirection.current = direction;
      document.documentElement.dataset.onboardingDeparture = direction;
      if (!prefersReducedMotion()) setMotion({ direction, phase: "exiting" });
      const destination = new URL(detail.href, window.location.origin);
      const destinationScene = sceneFromUrl(destination);
      const sourceScene = sceneFromUrl(new URL(window.location.href));
      if (sourceScene === destinationScene) {
        delete document.documentElement.dataset.onboardingDeparture;
        pendingDirection.current = null;
        setMotion({ direction, phase: "idle" });
        applyHistory(detail);
        return;
      }
      navigationLockUntil.current = performance.now() + 180;
      lockedNavigationHref.current = detail.href;
      lockedNavigationDirection.current = direction;
      scrollSettlingUntil.current = performance.now() + 400;
      if (isImmediateMobileAudienceTransition(previousSceneKey.current, destinationScene)) {
        pendingBridge.current = false;
        returningRows.current = [];
        setMotion({ direction, phase: "idle" });
        applyHistory(detail);
        return;
      }
      returningRows.current = direction === "backward" && destinationScene === "how-leadreacher-works"
        ? Array.from(document.querySelectorAll<HTMLElement>("[data-prospect-row]")).map(stableBounds)
        : [];
      const illustrations = Array.from(document.querySelectorAll<HTMLElement>("[data-explanation-step] .how-it-works-illustration"));
      pendingBridge.current = Boolean(illustrations.length && destinationScene === "discovery");

      if (pendingBridge.current || destinationScene === "how-leadreacher-works") {
        setMotion({ direction, phase: "idle" });
        if (pendingBridge.current && !prefersReducedMotion()) {
          window.dispatchEvent(new Event("leadreacher:onboarding-story-handoff"));
          illustrations.forEach((illustration, index) => {
          const bounds = stableBounds(illustration);
          const layer = document.createElement("div");
          layer.className = "onboarding-audience-bridge";
          layer.setAttribute("aria-hidden", "true");
          layer.inert = true;
          layer.dataset.illustrationIndex = String(index);
          Object.assign(layer.style, { left: `${bounds.left}px`, top: `${bounds.top}px`, width: `${bounds.width}px`, height: `${bounds.height}px` });
          const icon = illustration.querySelector("svg")?.cloneNode(true);
          if (icon) layer.append(icon);
          document.body.append(layer);
          bridges.current.push(layer);
          });
          const main = document.querySelector<HTMLElement>(".how-it-works-campaign-main");
          if (main) {
            const snapshot = main.cloneNode(true) as HTMLElement;
            const rect = stableBounds(main);
            snapshot.classList.add("onboarding-explanation-snapshot");
            snapshot.setAttribute("aria-hidden", "true");
            snapshot.inert = true;
            snapshot.querySelectorAll("[id]").forEach((node) => node.removeAttribute("id"));
            snapshot.querySelectorAll<HTMLElement>(".how-it-works-illustration").forEach((node) => node.style.setProperty("visibility", "hidden"));
            const styles = getComputedStyle(main);
            Object.assign(snapshot.style, { position: "fixed", left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px`, margin: "0", padding: styles.padding, gap: styles.gap, pointerEvents: "none", zIndex: "30" });
            snapshot.style.transform = "none";
            const heading = main.querySelector("h1");
            const clonedHeading = snapshot.querySelector("h1");
            if (heading && clonedHeading) Object.assign(clonedHeading.style, { font: getComputedStyle(heading).font, letterSpacing: getComputedStyle(heading).letterSpacing, textAlign: "left" });
            // Route-specific layout selectors no longer apply after navigation.
            // Freeze outgoing copy in viewport coordinates before that happens.
            const snapshotSelector = "[data-explanation-heading], [data-explanation-step] > p, .how-it-works-connector, [role='alert']";
            const originals = Array.from(main.querySelectorAll<HTMLElement>(snapshotSelector));
            snapshot.querySelectorAll<HTMLElement>(snapshotSelector).forEach((part, index) => {
              const original = originals[index];
              if (!original) return;
              // These static copy groups include the shell's final alignment
              // offset. Capture their presented position, not an animated chip.
              const position = original.getBoundingClientRect();
              Object.assign(part.style, {
                position: "fixed", left: `${position.left}px`, top: `${position.top}px`,
                width: `${position.width}px`, height: `${position.height}px`, margin: "0",
              });
            });
            document.body.append(snapshot);
            outgoing.current = snapshot;
            // Release the explanation in reading order while the illustrations
            // retain their visual weight. Do not fade a whole page over the new
            // workspace, or move text together with its travelling illustration.
            const recede = (node: Element, delay: number, duration: number) => {
              animations.current.push(node.animate([
                { opacity: 1, transform: "translateY(0)" },
                { opacity: 0, transform: "translateY(-3px)" },
              ], { delay, duration, easing: EASE, fill: "forwards" }));
            };
            const title = snapshot.querySelector("[data-explanation-heading]");
            if (title) recede(title, 0, 180);
            snapshot.querySelectorAll("[data-explanation-step] > p").forEach((copy, index) => recede(copy, 40 + index * 45, 200));
            snapshot.querySelectorAll(".how-it-works-connector").forEach((connector, index) => recede(connector, 60 + index * 45, 160));
            snapshot.querySelectorAll("[role='alert']").forEach((alert) => recede(alert, 0, 160));
          }
        }
        applyHistory(detail);
        return;
      }

      if (prefersReducedMotion()) {
        applyHistory(detail);
        return;
      }

      storyObjects.current = captureStoryObjects().filter((object) => carriesObject(object, sourceScene, destinationScene));
      const customPixelHandoff = storyObjects.current.some((object) => (
        object.key === "media" && (sourceScene === "cta" || destinationScene === "cta")
      ) || (
        object.key.startsWith("channel:") && isChannelHandoff(sourceScene, destinationScene)
      ));
      if (storyObjects.current.length && typeof document.startViewTransition === "function" && !customPixelHandoff) {
        const objects = storyObjects.current;
        storyObjects.current = [];
        const root = document.documentElement;
        const originalRootName = root.style.viewTransitionName;
        const mediaHandoff = destinationScene === "cta" && objects.some((object) => object.key === "media");
        const deliberateHandoff = isDeliberateStoryHandoff(objects, sourceScene, destinationScene);
        const timing = storyTiming(direction === "backward", false, deliberateHandoff);
        const restores: Array<() => void> = [];
        let cancelled = false;
        let navigationStarted = false;
        let matched = false;
        let resolveUpdate = () => {};
        let observer: MutationObserver | null = null;
        let timeout = 0;
        let transition: ViewTransition | null = null;
        const commit = () => {
          if (cancelled || navigationStarted) return;
          navigationStarted = true;
          applyHistory(detail);
        };
        const targetFor = (object: StoryObject) => Array.from(document.querySelectorAll<HTMLElement>("[data-story-object]")).find((node) => node.dataset.storyObject === object.key && (node.dataset.storyAsset ?? "") === object.asset && !node.closest("[aria-checked='false'], [data-selected='false'], .personalized-video-style-card-preparing"));
        const nameObject = (node: HTMLElement, index: number) => {
          const previous = node.style.viewTransitionName;
          node.style.viewTransitionName = objectName(objects[index], index);
          restores.push(() => { node.style.viewTransitionName = previous; });
        };
        const objectName = (object: StoryObject, index: number) => object.key === "media" ? "onboarding-media" : `onboarding-object-${index}`;
        objects.forEach((object, index) => { const node = targetFor(object); if (node) nameObject(node, index); });
        root.style.viewTransitionName = "none";
        root.dataset.storyNative = "waiting";
        root.dataset.storyKind = mediaHandoff ? "media" : "objects";
        root.style.setProperty("--onboarding-story-duration", `${timing.duration}ms`);
        const cleanup = () => {
          if (cancelled) return;
          cancelled = true;
          observer?.disconnect();
          window.clearTimeout(timeout);
          document.removeEventListener("load", checkReady, true);
          document.removeEventListener("loadeddata", checkReady, true);
          resolveUpdate();
          transition?.skipTransition();
          restores.forEach((restore) => restore());
          root.style.viewTransitionName = originalRootName;
          root.style.removeProperty("--onboarding-story-duration");
          delete root.dataset.storyNative;
          delete root.dataset.storyKind;
          if (nativeCommit.current === commit) nativeCommit.current = null;
          if (nativeStory.current === cleanup) nativeStory.current = null;
        };
        const checkReady = () => {
          if (cancelled || matched || previousSceneKey.current !== destinationScene) return;
          const targets = objects.map(targetFor);
          if (targets.some((node) => !node?.getBoundingClientRect().width)) {
            const candidates = Array.from(document.querySelectorAll<HTMLElement>("[data-story-object]"));
            const differentAssets = objects.every((object) => candidates.some((node) => node.dataset.storyObject === object.key && (node.dataset.storyAsset ?? "") !== object.asset));
            if (differentAssets || document.querySelector('[data-story-ready="true"]')) {
              matched = true;
              observer?.disconnect();
              window.clearTimeout(timeout);
              transition?.skipTransition();
              resolveUpdate();
            }
            return;
          }
          for (const node of targets) {
            const visual = node!.matches("img, video") ? node : node!.querySelector("img, video");
            if (visual instanceof HTMLImageElement && (!visual.complete || !visual.naturalWidth)) return;
            if (visual instanceof HTMLVideoElement && visual.readyState < 2) return;
          }
          matched = true;
          targets.forEach((node, index) => nameObject(node!, index));
          observer?.disconnect();
          window.clearTimeout(timeout);
          root.dataset.storyNative = "carrying";
          resolveUpdate();
        };
        nativeStory.current = cleanup;
        nativeCommit.current = commit;
        setMotion({ direction, phase: "idle" });
        transition = document.startViewTransition(async () => {
          if (cancelled) return;
          await new Promise<void>((resolve) => {
            resolveUpdate = resolve;
            observer = new MutationObserver(checkReady);
            observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-story-asset", "data-story-object", "data-story-ready"] });
            document.addEventListener("load", checkReady, true);
            document.addEventListener("loadeddata", checkReady, true);
            timeout = window.setTimeout(() => { transition?.skipTransition(); resolve(); }, 600);
            commit();
          });
        });
        void transition.ready.catch(() => {});
        void transition.finished.then(cleanup, cleanup);
        return;
      }
      storyObjects.current.forEach(({ layer }) => document.body.append(layer));
      if (storyObjects.current.length) {
        // Navigation is already authorized by the task's successful save.
        // Carry static pixels while the real destination loads, not a second player.
        setMotion({ direction, phase: "idle" });
        applyHistory(detail);
        return;
      }

      applyHistory(detail);
    };

    window.addEventListener(NAVIGATION_EVENT, onNavigate);
    return () => window.removeEventListener(NAVIGATION_EVENT, onNavigate);
  }, [clearTimers, clearVisuals]);

  useLayoutEffect(() => {
    const previous = previousSceneKey.current;
    const changed = previous !== sceneKey;
    previousSceneKey.current = sceneKey;
    if (!changed) return;
    scrollSettlingUntil.current = performance.now() + 400;
    delete document.documentElement.dataset.onboardingDeparture;

    clearTimers();
    const direction = pendingDirection.current ?? directionFor(`/onboarding/${previous}`, `/onboarding/${sceneKey}`);
    pendingDirection.current = null;

    if (prefersReducedMotion() || isImmediateMobileAudienceTransition(previous, sceneKey)) {
      clearVisuals();
      pendingBridge.current = false;
      returningRows.current = [];
      setMotion({ direction, phase: "idle" });
      return;
    }
    // These requests happen after existing save/confirmation handlers resolve.
    // Acknowledge the persisted section, never invent a success state or copy.
    const resolvedSection = previous === "discovery" && sceneKey === "campaign-content" ? "targeting"
      : previous === "cta" && sceneKey === "channels" ? "message"
        : previous === "checkout" && sceneKey === "connect-channels" ? "subscription" : null;
    const acknowledge = () => { if (resolvedSection) {
      const section = document.querySelector(`[data-campaign-section-id="${resolvedSection}"]`);
      if (section) animations.current.push(section.animate([{ opacity: .75 }, { opacity: 1 }], storyTiming()));
    } };
    if (nativeStory.current) {
      acknowledge();
      setMotion({ direction, phase: "idle" });
      return;
    }

    const formingAudience = pendingBridge.current && sceneKey === "discovery";
    pendingBridge.current = false;
    if (formingAudience || sceneKey === "how-leadreacher-works") {
      setMotion({ direction, phase: "idle" });
      const reveal = (node: HTMLElement | null, delay: number, duration: number, distance = 6) => {
        if (!node) return;
        animations.current.push(node.animate([
          { opacity: 0, transform: `translateY(${distance}px)` },
          { opacity: 1, transform: "translateY(0)" },
        ], { duration, delay, easing: EASE, fill: "backwards" }));
      };
      if (formingAudience) {
        const rows = Array.from(document.querySelectorAll<HTMLElement>("[data-prospect-row]"));
        rows.forEach((row, index) => {
          const layer = bridges.current[index];
          if (!layer) return;
          const target = stableBounds(row);
          const origin = { left: Number.parseFloat(layer.style.left), top: Number.parseFloat(layer.style.top), width: layer.offsetWidth, height: layer.offsetHeight };
          // Align each landed circle's left edge with its prospect row.
          const centerX = origin.left + origin.width / 2;
          const travelY = target.top + target.height / 2 - origin.top - origin.height / 2;
          const stackScale = Math.min(.6, (target.height - 12) / origin.height);
          const columnX = target.left + origin.width * stackScale / 2;
          const arrival = `translate(${columnX - centerX}px, ${travelY}px)`;
          const travelX = columnX - centerX;
          // Move into the destination's vertical lane before gathering inward.
          // Sample one eased quadratic path; icons retain uniform proportions.
          const gathering: Keyframe[] = Array.from({ length: 17 }, (_, point) => {
            const progress = point / 16;
            // Quintic interpolation joins anticipation and arrival with zero
            // velocity and acceleration, without a hard stop at either end.
            const t = progress * progress * progress * (progress * (progress * 6 - 15) + 10);
            const x = 2 * (1 - t) * t * travelX * .18 + t * t * travelX;
            const y = -2 * (1 - t) * (1 - t) + 2 * (1 - t) * t * travelY * .9 + t * t * travelY;
            return { transform: `translate(${x}px, ${y}px) scale(${1 + (stackScale - 1) * t})`, opacity: 1, offset: .12 + progress * .66 };
          });
          layer.dataset.formationCategory = row.dataset.prospectRow;
          layer.style.transformOrigin = "center";
          // The illustration keeps its proportions. Its soft circular surface
          // hands off to row-sized layers rather than stretching the icon.
          animations.current.push(layer.animate([
            { transform: "translate(0, 0) scale(1)", opacity: 1, offset: 0, easing: EASE },
            ...gathering,
            { transform: `${arrival} scale(${stackScale})`, opacity: 1, offset: .78, easing: EASE },
            { transform: `${arrival} scale(${stackScale})`, opacity: 0, offset: 1 },
          ], { duration: AUDIENCE_MORPH.travel, delay: index * AUDIENCE_MORPH.stagger, easing: "linear", fill: "both" }));
          const icon = layer.querySelector("svg");
          if (icon) animations.current.push(icon.animate([
            { opacity: 1 },
            { opacity: 1, offset: .2 },
            { opacity: 0 },
          ], { duration: 180, delay: 730 + index * AUDIENCE_MORPH.stagger, fill: "both", easing: EASE }));
        });
        rows.forEach((node, index) => {
          const bounds = stableBounds(node);
          const start = 820 + index * AUDIENCE_MORPH.stagger;
          const surface = document.createElement("div");
          surface.className = "onboarding-audience-formation";
          surface.dataset.formationCategory = node.dataset.prospectRow;
          surface.setAttribute("aria-hidden", "true");
          surface.inert = true;
          Object.assign(surface.style, { left: `${bounds.left}px`, top: `${bounds.top}px`, width: `${bounds.width}px`, height: `${bounds.height}px` });
          // Match the landed circle exactly, including smaller mobile artwork.
          // Reveal a rounded surface at its real dimensions instead of scaling
          // its corners and divider into a visibly stretched rectangle.
          const seed = Math.min((bridges.current[index]?.offsetWidth ?? 100) * .6, bounds.height - 12);
          const insetY = (bounds.height - seed) / 2;
          const seedClip = `inset(${insetY}px ${Math.max(0, bounds.width - seed)}px ${insetY}px 0px round ${seed / 2}px)`;
          const openClip = "inset(0px 0px 0px 0px round 12px)";
          const divider = document.createElement("span");
          surface.append(divider);
          divider.style.transformOrigin = "left center";
          document.body.append(surface);
          formationLayers.current.push(surface);
          // One quiet propagation through the structure, not four hero morphs.
          animations.current.push(surface.animate([
            { opacity: 0, clipPath: seedClip, offset: 0 },
            { opacity: .45, clipPath: seedClip, offset: .08, easing: EASE },
            { opacity: .22, clipPath: openClip, offset: .72, easing: EASE },
            { opacity: 0, clipPath: openClip, offset: 1 },
          ], { duration: AUDIENCE_MORPH.formation, delay: start, easing: "linear", fill: "both" }));
          animations.current.push(divider.animate([
            { transform: "scaleX(.12)", opacity: 0 },
            { transform: "scaleX(1)", opacity: .7 },
          ], { duration: 460, delay: start + 60, easing: EASE, fill: "both" }));
          // Keep real content present throughout, then resolve each row as a
          // group. No chip transforms, dimensions, or measurement owners change.
          animations.current.push(node.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 420, delay: start + 100, easing: EASE, fill: "backwards" }));
          // One opacity owner per row avoids compounding fades. These inner
          // groups only settle by 3px; no individual chip is animated here.
          node.querySelectorAll<HTMLElement>(":scope > p, :scope > .onboarding-campaign-profile-values").forEach((part, partIndex) => {
            animations.current.push(part.animate([{ transform: "translateY(3px)" }, { transform: "translateY(0)" }], { duration: 420, delay: start + 100 + partIndex * 45, easing: EASE, fill: "backwards" }));
          });
        });
        reveal(document.querySelector(".onboarding-discovery-task h1"), 180, 500, 6);
        // Keep measurement wrappers untransformed so viewport alignment cannot
        // read an in-flight action or input offset and compensate a second time.
        reveal(document.querySelector("label[for='prospect-context']"), 1120, 440, 4);
        document.querySelectorAll<HTMLElement>(".discovery-detail-entry > *").forEach((node) => reveal(node, 1160, 440, 4));
        document.querySelectorAll<HTMLElement>(".onboarding-campaign-actions > *").forEach((node) => reveal(node, 1220, 460, 4));
      } else if (returningRows.current.length) {
        const origins = returningRows.current;
        returningRows.current = [];
        // Reverse the spatial relationship, not the text: rows release their
        // surfaces, then the original illustrations return to the explanation.
        document.querySelectorAll<HTMLElement>("[data-explanation-step]").forEach((step, index) => {
          const circle = step.querySelector<HTMLElement>(".how-it-works-illustration");
          const origin = origins[index];
          if (!circle || !origin) return;
          // The newly mounted circle is not animated yet. Include the shell's
          // static alignment transform so departure matches the source row.
          const target = circle.getBoundingClientRect();
          const seed = Math.min(target.width * .6, origin.height - 12);
          const delay = (origins.length - 1 - index) * AUDIENCE_MORPH.stagger;
          const dx = origin.left + seed / 2 - target.left - target.width / 2;
          const dy = origin.top + origin.height / 2 - target.top - target.height / 2;
          const surface = document.createElement("div");
          surface.className = "onboarding-audience-formation";
          surface.dataset.returningCategory = String(index);
          surface.setAttribute("aria-hidden", "true");
          surface.inert = true;
          Object.assign(surface.style, { left: `${origin.left}px`, top: `${origin.top}px`, width: `${origin.width}px`, height: `${origin.height}px` });
          document.body.append(surface);
          formationLayers.current.push(surface);
          animations.current.push(surface.animate([
            { opacity: .4, clipPath: "inset(0px 0px 0px 0px round 12px)" },
            { opacity: .3, clipPath: `inset(${(origin.height - seed) / 2}px ${Math.max(0, origin.width - seed)}px ${(origin.height - seed) / 2}px 0px round ${seed / 2}px)`, offset: .7 },
            { opacity: 0, clipPath: `inset(${(origin.height - seed) / 2}px ${Math.max(0, origin.width - seed)}px ${(origin.height - seed) / 2}px 0px round ${seed / 2}px)` },
          ], { duration: AUDIENCE_MORPH.formation, delay, easing: EASE, fill: "both" }));
          // Use the forward journey's smooth acceleration and curved path in
          // reverse, rather than a quick ease-out followed by a long wait.
          const returning: Keyframe[] = Array.from({ length: 17 }, (_, point) => {
            const progress = point / 16;
            const t = 1 - progress ** 3 * (progress * (progress * 6 - 15) + 10);
            const x = 2 * (1 - t) * t * dx * .18 + t * t * dx;
            const y = 2 * (1 - t) * t * dy * .9 + t * t * dy;
            return { transform: `translate(${x}px, ${y}px) scale(${1 + (seed / target.width - 1) * t})`, opacity: 1, offset: .18 + progress * .82 };
          });
          animations.current.push(circle.animate([
            { transform: `translate(${dx}px, ${dy}px) scale(${seed / target.width})`, opacity: 0 },
            ...returning,
          ], { duration: AUDIENCE_MORPH.travel, delay: 160 + delay, easing: "linear", fill: "backwards" }));
          reveal(step.querySelector("p"), 1030 + delay, 420, 3);
          reveal(step.querySelector(".how-it-works-connector"), 1230 + delay, 180, 0);
        });
        reveal(document.querySelector("[data-explanation-heading]"), 180, 500, 3);
        document.querySelectorAll<HTMLElement>(".how-it-works-campaign-actions > *").forEach((action) => reveal(action, 1220, 460, 3));
        timers.current.push(window.setTimeout(clearVisuals, AUDIENCE_MORPH.settle));
        return;
      } else {
        clearVisuals();
        // How It Works owns only its one-shot SVG story. Its heading, circles,
        // copy, and actions are stationary so no scene entrance competes.
      }
      timers.current.push(window.setTimeout(clearVisuals, formingAudience ? AUDIENCE_MORPH.settle : 680));
      return;
    }

    if (storyObjects.current.length) {
      acknowledge();
      setMotion({ direction, phase: "idle" });
      const mediaHandoff = (previous === "cta" || sceneKey === "cta") && storyObjects.current.some((object) => object.key === "media");
      const channelHandoff = isChannelHandoff(previous, sceneKey);
      const deliberateHandoff = isDeliberateStoryHandoff(storyObjects.current, previous, sceneKey);
      const timing = storyTiming(direction === "backward", false, deliberateHandoff);
      const started = performance.now();
      const pending = new Set(storyObjects.current);
      const flights = new Map<StoryObject, { target: HTMLElement; landed: boolean; restore: () => void }>();
      const fading = new Set<StoryObject>();
      const candidateBounds = new Map<StoryObject, DOMRect>();
      const channelOrder = [...storyObjects.current]
        .filter((object) => object.key.startsWith("channel:"))
        .sort((left, right) => left.key.localeCompare(right.key));
      const match = () => {
        for (const [object, flight] of flights) {
          if (!flight.target.isConnected || (flight.landed && isStoryObjectReady(flight.target)) || performance.now() - started > 12_000) {
            flight.restore();
            flights.delete(object);
          }
        }
        for (const object of pending) {
          const target = Array.from(document.querySelectorAll<HTMLElement>("[data-story-object]")).find((node) => node.dataset.storyObject === object.key && (node.dataset.storyAsset ?? "") === object.asset && !node.closest("[aria-checked='false'], [data-selected='false'], [data-story-selected='false'], .personalized-video-style-card-preparing") && node.getBoundingClientRect().width > 0);
          const bounds = target?.getBoundingClientRect();
          if (!target || !bounds?.width || !bounds.height) continue;
          const previousBounds = candidateBounds.get(object);
          candidateBounds.set(object, bounds);
          if (performance.now() - started < (deliberateHandoff ? 100 : 32) || !previousBounds || Math.abs(previousBounds.x - bounds.x) > .5 || Math.abs(previousBounds.y - bounds.y) > .5 || Math.abs(previousBounds.width - bounds.width) > .5 || Math.abs(previousBounds.height - bounds.height) > .5) continue;
          if (object.key !== "media" && !isStoryObjectReady(target)) continue;
          pending.delete(object);
          const visibility = target.style.visibility;
          target.style.visibility = "hidden";
          const restore = () => { target.style.visibility = visibility; object.layer.remove(); };
          storyRestores.current.push(restore);
          const flight = { target, landed: false, restore };
          flights.set(object, flight);
          const channelIndex = channelOrder.findIndex((candidate) => candidate.key === object.key);
          const staggerIndex = direction === "backward" ? channelOrder.length - 1 - channelIndex : channelIndex;
          const stagger = channelHandoff && channelIndex >= 0 ? staggerIndex * 24 : 0;
          const duration = Math.max(1, timing.duration - stagger);
          const targetScaleX = bounds.width / object.bounds.width;
          const targetScaleY = bounds.height / object.bounds.height;
          const preservesArtworkRatio = object.key.startsWith("channel:");
          const uniformScale = Math.min(targetScaleX, targetScaleY);
          const scaleX = preservesArtworkRatio ? uniformScale : targetScaleX;
          const scaleY = preservesArtworkRatio ? uniformScale : targetScaleY;
          const dx = preservesArtworkRatio
            ? bounds.left + bounds.width / 2 - object.bounds.left - object.bounds.width * uniformScale / 2
            : bounds.left - object.bounds.left;
          const dy = preservesArtworkRatio
            ? bounds.top + bounds.height / 2 - object.bounds.top - object.bounds.height * uniformScale / 2
            : bounds.top - object.bounds.top;
          if (channelHandoff || (mediaHandoff && object.key === "media")) {
            object.layer.dataset.storyDirection = direction;
            object.layer.dataset.storyDuration = `${timing.duration}`;
          }
          const isTravelStory = (channelHandoff && object.key.startsWith("channel:")) || (mediaHandoff && object.key === "media");
          const keyframes = isTravelStory
            ? sampledStoryPath({
                dx,
                dy,
                sourceWidth: object.bounds.width,
                sourceHeight: object.bounds.height,
                targetWidth: preservesArtworkRatio ? object.bounds.width * uniformScale : bounds.width,
                targetHeight: preservesArtworkRatio ? object.bounds.height * uniformScale : bounds.height,
                sourceRadius: object.layer.style.borderRadius || "0px",
                targetRadius: getComputedStyle(target).borderRadius,
                arc: object.key === "media" ? 18 : 20,
              })
            : [
                { transform: "translate3d(0, 0, 0) scale(1, 1)", opacity: 1 },
                { transform: `translate3d(${dx}px, ${dy}px, 0) scale(${scaleX}, ${scaleY})`, opacity: 1 },
              ];
          const animation = object.layer.animate(keyframes, { ...timing, duration, delay: stagger, easing: isTravelStory ? "linear" : timing.easing, fill: "forwards" });
          animations.current.push(animation);
          void animation.finished.then(() => {
            flight.landed = true;
            object.layer.dataset.storyState = "holding";
            if (isStoryObjectReady(target)) { restore(); flights.delete(object); }
          }).catch(() => {});
        }
        const waitLimit = mediaHandoff ? 10_000 : deliberateHandoff ? 2_000 : 96;
        const destinationReady = Boolean(document.querySelector('[data-story-ready="true"]'));
        for (const object of pending) {
          const knownDifferentAsset = destinationReady && Array.from(document.querySelectorAll<HTMLElement>("[data-story-object]")).some((node) => node.dataset.storyObject === object.key && (node.dataset.storyAsset ?? "") !== object.asset && !node.closest("[aria-checked='false'], [data-selected='false'], [data-story-selected='false']") && node.getBoundingClientRect().width > 0);
          if (performance.now() - started >= waitLimit || knownDifferentAsset) {
            pending.delete(object);
            fading.add(object);
            const fade = object.layer.animate([{ opacity: 1 }, { opacity: 0 }], { ...timing, duration: 120 });
            animations.current.push(fade);
            void fade.finished.then(() => { object.layer.remove(); fading.delete(object); }).catch(() => {});
          }
        }
        if (pending.size || flights.size || fading.size) storyFrame.current = requestAnimationFrame(match);
        else clearStory();
      };
      storyFrame.current = requestAnimationFrame(match);
      return;
    }

    clearVisuals();
    acknowledge();
    setMotion({ direction, phase: "entering" });
    timers.current.push(window.setTimeout(() => {
      setMotion({ direction, phase: "idle" });
    }, direction === "backward" ? 240 : 320));
  }, [sceneKey, clearStory, clearTimers, clearVisuals]);

  const value = useMemo(() => motion, [motion]);
  return <sceneMotionContext.Provider value={value}>{children}</sceneMotionContext.Provider>;
}

export function requestOnboardingNavigation(href: string, replace: boolean): boolean {
  if (typeof window === "undefined") return false;
  const event = new CustomEvent<NavigationDetail>(NAVIGATION_EVENT, {
    cancelable: true,
    detail: { href, replace },
  });
  return !window.dispatchEvent(event);
}

export function prepareOnboardingNavigation(href: string): boolean {
  if (typeof window === "undefined") return false;
  return window.dispatchEvent(new CustomEvent(DEPARTURE_EVENT, { cancelable: true, detail: { href } }));
}

export function cancelOnboardingNavigation(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(DEPARTURE_CANCEL_EVENT));
}
