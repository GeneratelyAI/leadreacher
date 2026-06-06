"use client";

import { useEffect, useRef } from "react";
import { ANIMATION_BOUNCE_START_SECONDS } from "@/lib/constants/animation";

export function useHeroVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const restartBounceLoop = () => {
      video.currentTime = ANIMATION_BOUNCE_START_SECONDS;
      void video.play();
    };

    video.addEventListener("ended", restartBounceLoop);

    return () => {
      video.removeEventListener("ended", restartBounceLoop);
    };
  }, []);

  return videoRef;
}
