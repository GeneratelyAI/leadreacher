"use client";

import { useHeroVideo } from "@/hooks/useHeroVideo";
import { ANIMATION_VIDEO_SRC } from "@/lib/constants/animation";

export default function HeroVideo() {
  const videoRef = useHeroVideo();

  return (
    <video
      ref={videoRef}
      autoPlay
      muted
      playsInline
      preload="auto"
      poster="/BG.png"
      className="absolute inset-0 z-1 h-full w-full object-cover object-center"
      src={ANIMATION_VIDEO_SRC}
      aria-hidden
    />
  );
}
