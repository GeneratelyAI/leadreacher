"use client";

import { useRef } from "react";
import { useHeroAnimation } from "@/hooks/useHeroAnimation";

export default function HeroAnimation() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useHeroAnimation(canvasRef);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 z-1 h-full w-full"
      aria-hidden
    />
  );
}
