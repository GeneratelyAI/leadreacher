"use client";

import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import Image from "next/image";
import {
  m,
  useMotionValue,
  useMotionValueEvent,
  useScroll,
} from "framer-motion";

type VideoMagicMoveProps = {
  flowRef: RefObject<HTMLDivElement | null>;
  sourceRef: RefObject<HTMLDivElement | null>;
  targetRef: RefObject<HTMLDivElement | null>;
  mediaSrc: string;
  posterSrc?: string;
  mediaAlt: string;
  disabled?: boolean;
};

type Frame = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type Layout = {
  target: Frame & { pageTop: number };
};

type SourceAudioState = {
  muted: boolean;
  volume: number;
};

const DESKTOP_BREAKPOINT_PX = 768;
const INITIAL_BORDER_RADIUS_PX = 12;
const TARGET_BORDER_RADIUS_PX = 8;
const SOURCE_AUDIO_MUTE_THRESHOLD = 0.001;
const TRANSITION_VIEWPORT_MULTIPLIER = 0.55;
const TRANSITION_FADE_START = 0.92;

const lerp = (from: number, to: number, progress: number) =>
  from + (to - from) * progress;

const clamp = (value: number) => Math.max(0, Math.min(1, value));

const sourceVideo = (
  source: HTMLDivElement | null,
): HTMLVideoElement | null => source?.querySelector("video") ?? null;

const restoreSourceAudio = (
  source: HTMLDivElement | null,
  state: SourceAudioState | null,
) => {
  const video = sourceVideo(source);
  if (!video || !state) return;

  video.volume = state.volume;
  video.muted = state.muted;
};

const fadeSourceAudio = (
  source: HTMLDivElement | null,
  state: SourceAudioState,
  transitionProgress: number,
) => {
  const video = sourceVideo(source);
  if (!video) return;

  const volume = state.volume * (1 - transitionProgress);
  video.volume = volume;
  video.muted = state.muted || volume <= SOURCE_AUDIO_MUTE_THRESHOLD;
};

export function VideoMagicMove({
  flowRef,
  sourceRef,
  targetRef,
  mediaSrc,
  posterSrc,
  mediaAlt,
  disabled = false,
}: VideoMagicMoveProps) {
  const [sourceFrame, setSourceFrame] = useState<Frame | null>(null);
  const sourceFrameRef = useRef<Frame | null>(null);
  const sourceAudioRef = useRef<SourceAudioState | null>(null);
  const layoutRef = useRef<Layout | null>(null);
  const transitionRangeRef = useRef({ start: 0, end: 1 });
  const { scrollY } = useScroll();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const scaleX = useMotionValue(1);
  const scaleY = useMotionValue(1);
  const opacity = useMotionValue(0);
  const borderRadius = useMotionValue(INITIAL_BORDER_RADIUS_PX);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const measure = useCallback(() => {
    if (disabled || window.innerWidth < DESKTOP_BREAKPOINT_PX) return;

    const flow = flowRef.current?.getBoundingClientRect();
    const source = sourceRef.current?.getBoundingClientRect();
    const target = targetRef.current?.getBoundingClientRect();
    if (!flow || !source || !target || source.width === 0 || target.width === 0) return;

    const pageY = window.scrollY;
    const flowBottom = flow.bottom + pageY;
    const targetTop = target.top + pageY;
    const targetCenter = targetTop + target.height / 2;
    const start = flowBottom - window.innerHeight;
    const end = Math.max(
      start + window.innerHeight * TRANSITION_VIEWPORT_MULTIPLIER,
      targetCenter - window.innerHeight / 2,
    );

    transitionRangeRef.current = { start, end };
    layoutRef.current = {
      target: {
        left: target.left,
        top: target.top,
        pageTop: targetTop,
        width: target.width,
        height: target.height,
      },
    };

    if (pageY <= start || !sourceFrameRef.current) {
      const nextSource = {
        left: source.left,
        top: source.top,
        width: source.width,
        height: source.height,
      };
      const previousSource = sourceFrameRef.current;
      sourceFrameRef.current = nextSource;
      if (
        !previousSource ||
        Math.abs(previousSource.left - nextSource.left) > 0.5 ||
        Math.abs(previousSource.top - nextSource.top) > 0.5 ||
        Math.abs(previousSource.width - nextSource.width) > 0.5 ||
        Math.abs(previousSource.height - nextSource.height) > 0.5
      ) {
        setSourceFrame(nextSource);
      }
    }
  }, [disabled, flowRef, sourceRef, targetRef]);

  const update = useCallback(
    (pageY: number) => {
      if (disabled || window.innerWidth < DESKTOP_BREAKPOINT_PX) {
        opacity.set(0);
        setIsTransitioning(false);
        if (sourceRef.current) sourceRef.current.style.opacity = "";
        restoreSourceAudio(sourceRef.current, sourceAudioRef.current);
        sourceAudioRef.current = null;
        return;
      }

      const source = sourceFrameRef.current;
      const layout = layoutRef.current;
      if (!source || !layout) return;

      const target = layout.target;
      const targetViewportTop = target.pageTop - pageY;

      const { start, end } = transitionRangeRef.current;
      const progress = clamp((pageY - start) / Math.max(1, end - start));
      if (progress <= 0) {
        opacity.set(0);
        setIsTransitioning(false);
        if (sourceRef.current) sourceRef.current.style.opacity = "";
        restoreSourceAudio(sourceRef.current, sourceAudioRef.current);
        sourceAudioRef.current = null;
        return;
      }

      if (sourceRef.current) sourceRef.current.style.opacity = "0";
      setIsTransitioning(true);
      if (!sourceAudioRef.current) {
        const video = sourceVideo(sourceRef.current);
        if (video) {
          sourceAudioRef.current = { muted: video.muted, volume: video.volume };
        }
      }
      if (sourceAudioRef.current) {
        fadeSourceAudio(sourceRef.current, sourceAudioRef.current, progress);
      }

      const eased = progress * progress * (3 - 2 * progress);
      x.set(lerp(source.left, target.left, eased));
      y.set(lerp(source.top, targetViewportTop, eased));
      scaleX.set(lerp(1, target.width / source.width, eased));
      scaleY.set(lerp(1, target.height / source.height, eased));
      borderRadius.set(
        lerp(INITIAL_BORDER_RADIUS_PX, TARGET_BORDER_RADIUS_PX, eased),
      );
      opacity.set(
        progress < TRANSITION_FADE_START
          ? 1
          : 1 -
              (progress - TRANSITION_FADE_START) /
                (1 - TRANSITION_FADE_START),
      );
    },
    [borderRadius, disabled, opacity, scaleX, scaleY, sourceRef, x, y],
  );

  useLayoutEffect(() => {
    const sourceElement = sourceRef.current;
    measure();
    update(window.scrollY);
    const observer = new ResizeObserver(() => {
      measure();
      update(window.scrollY);
    });
    if (flowRef.current) observer.observe(flowRef.current);
    if (sourceElement) observer.observe(sourceElement);
    if (targetRef.current) observer.observe(targetRef.current);
    window.addEventListener("resize", measure);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
      if (sourceElement) sourceElement.style.opacity = "";
      restoreSourceAudio(sourceElement, sourceAudioRef.current);
      sourceAudioRef.current = null;
    };
  }, [flowRef, measure, sourceRef, targetRef, update]);

  useMotionValueEvent(scrollY, "change", (pageY) => {
    if (pageY <= transitionRangeRef.current.start) measure();
    update(pageY);
  });

  if (disabled || !sourceFrame) return null;

  return (
    <m.div
      aria-hidden="true"
      data-testid="video-magic-move"
      className="pointer-events-none fixed left-0 top-0 z-[70] hidden origin-top-left overflow-hidden border border-white/20 bg-[#0b0d18] shadow-[0_24px_80px_rgba(0,0,0,.42)] md:block"
      style={{
        width: sourceFrame.width,
        height: sourceFrame.height,
        x,
        y,
        scaleX,
        scaleY,
        opacity,
        borderRadius,
      }}
    >
      {isTransitioning ? (
        <video
          suppressHydrationWarning
          autoPlay
          muted
          loop
          playsInline
          preload="none"
          poster={posterSrc}
          aria-label={mediaAlt}
          className="size-full object-cover object-center"
        >
          <source src={mediaSrc} type="video/mp4" />
        </video>
      ) : null}
      <div className="absolute left-5 top-[60%] flex items-center gap-2 rounded-lg border border-white/20 bg-[#0b0d1be6] px-3 py-2 text-left shadow-xl backdrop-blur-md">
        <Image
          src="/landing/portraits/prospect-68.webp"
          alt=""
          width={28}
          height={28}
          className="size-7 rounded-full border border-white/30 object-cover"
        />
        <span>
          <span className="block text-[9px] font-semibold uppercase tracking-[0.08em] text-[#b6a6ff]">Personalized greeting</span>
          <span className="mt-0.5 block text-sm font-semibold text-white">Hi, Sarah</span>
        </span>
      </div>
    </m.div>
  );
}
