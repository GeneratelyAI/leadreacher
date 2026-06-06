"use client";

import { useEffect, useRef } from "react";
import {
  ANIMATION_BOUNCE_LOOP_START_INDEX,
  ANIMATION_FPS,
  ANIMATION_FRAME_PATHS,
  ANIMATION_TOTAL_FRAMES,
} from "@/lib/constants/animation";
import { drawCoverFrame } from "@/lib/animation/canvas-frame";
import { recolorPlaneFrame } from "@/lib/animation/plane-colors";

const LAST_FRAME_INDEX = ANIMATION_TOTAL_FRAMES - 1;

function getNextFrameIndex(currentIndex: number): number {
  return currentIndex < LAST_FRAME_INDEX
    ? currentIndex + 1
    : ANIMATION_BOUNCE_LOOP_START_INDEX;
}

function preloadFrames(
  onFrameReady: (index: number, canvas: HTMLCanvasElement | null) => void,
) {
  for (let index = 0; index < ANIMATION_FRAME_PATHS.length; index += 1) {
    const img = new Image();
    img.src = ANIMATION_FRAME_PATHS[index];
    img.onload = () => onFrameReady(index, recolorPlaneFrame(img));
    img.onerror = () => onFrameReady(index, null);
  }
}

export function useHeroAnimation(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  const framesRef = useRef<(HTMLCanvasElement | null)[]>([]);
  const frameIndexRef = useRef(0);
  const lastTimeRef = useRef(0);
  const rafRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let loadedCount = 0;
    let cancelled = false;
    const frames: (HTMLCanvasElement | null)[] = Array.from(
      { length: ANIMATION_TOTAL_FRAMES },
      () => null,
    );

    const resizeCanvas = () => {
      const parent = canvas.parentElement;
      if (!parent) return;

      const dpr = window.devicePixelRatio || 1;
      const width = parent.clientWidth;
      const height = parent.clientHeight;

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const renderCurrentFrame = () => {
      const parent = canvas.parentElement;
      if (!parent) return;

      const frame = framesRef.current[frameIndexRef.current];
      if (!frame) return;

      drawCoverFrame(
        ctx,
        frame,
        parent.clientWidth,
        parent.clientHeight,
      );
    };

    const startPlayback = () => {
      if (cancelled) return;

      framesRef.current = frames;
      resizeCanvas();
      window.addEventListener("resize", resizeCanvas);

      const frameIntervalMs = 1000 / ANIMATION_FPS;

      const animate = (time: number) => {
        if (cancelled) return;

        if (!lastTimeRef.current) lastTimeRef.current = time;
        const elapsed = time - lastTimeRef.current;

        if (elapsed >= frameIntervalMs) {
          lastTimeRef.current = time - (elapsed % frameIntervalMs);
          renderCurrentFrame();
          frameIndexRef.current = getNextFrameIndex(frameIndexRef.current);
        }

        rafRef.current = requestAnimationFrame(animate);
      };

      rafRef.current = requestAnimationFrame(animate);
    };

    const handleFrameReady = (
      index: number,
      processedFrame: HTMLCanvasElement | null,
    ) => {
      if (!cancelled) {
        frames[index] = processedFrame;
      }

      loadedCount += 1;
      if (loadedCount === ANIMATION_TOTAL_FRAMES) {
        startPlayback();
      }
    };

    preloadFrames(handleFrameReady);

    return () => {
      cancelled = true;
      window.removeEventListener("resize", resizeCanvas);
      cancelAnimationFrame(rafRef.current);
      lastTimeRef.current = 0;
      frameIndexRef.current = 0;
    };
  }, [canvasRef]);
}
