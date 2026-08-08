"use client";

import { useEffect, useRef, useState, type HTMLAttributes, type ReactNode } from "react";
import { createNoise3D } from "simplex-noise";
import { cn } from "@/lib/utils";

type WavyBackgroundProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  children?: ReactNode;
  containerClassName?: string;
  colors?: string[];
  waveWidth?: number;
  backgroundFill?: string;
  blur?: number;
  speed?: "slow" | "fast";
  waveOpacity?: number;
};

const DEFAULT_COLORS = ["#8b7fd4", "#a89cf0", "#6b5fbf", "#c8c0ff", "#ffffff"];

export function WavyBackground({
  children,
  className,
  containerClassName,
  colors = DEFAULT_COLORS,
  waveWidth = 32,
  backgroundFill = "#f7f6ff",
  blur = 10,
  speed = "fast",
  waveOpacity = 0.5,
  ...props
}: WavyBackgroundProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const noiseRef = useRef(createNoise3D());
  const [isSafari, setIsSafari] = useState(false);

  useEffect(() => {
    setIsSafari(
      navigator.userAgent.includes("Safari") &&
        !navigator.userAgent.includes("Chrome"),
    );
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!container || !canvas || !context) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const animationSpeed = speed === "fast" ? 0.002 : 0.001;
    let width = 0;
    let height = 0;
    let time = 0;
    let animationId = 0;

    const resize = () => {
      const bounds = container.getBoundingClientRect();
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, bounds.width);
      height = Math.max(1, bounds.height);
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.filter = `blur(${blur}px)`;
    };

    const draw = () => {
      context.clearRect(0, 0, width, height);
      context.globalAlpha = 1;
      context.fillStyle = backgroundFill;
      context.fillRect(0, 0, width, height);
      context.globalAlpha = waveOpacity;
      time += animationSpeed;

      for (let wave = 0; wave < 5; wave += 1) {
        context.beginPath();
        context.lineWidth = waveWidth;
        context.strokeStyle = colors[wave % colors.length] ?? DEFAULT_COLORS[0];
        for (let x = -20; x <= width + 20; x += 5) {
          const y = noiseRef.current(x / 800, wave * 0.3, time) * Math.min(100, height * 0.12);
          if (x === -20) context.moveTo(x, y + height * 0.58);
          else context.lineTo(x, y + height * 0.58);
        }
        context.stroke();
      }

      if (!reducedMotion) animationId = window.requestAnimationFrame(draw);
    };

    resize();
    draw();
    const resizeObserver = new ResizeObserver(() => {
      resize();
      if (reducedMotion) draw();
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      window.cancelAnimationFrame(animationId);
    };
  }, [backgroundFill, blur, colors, speed, waveOpacity, waveWidth]);

  return (
    <div
      ref={containerRef}
      className={cn("relative flex h-screen flex-col items-center justify-center overflow-hidden", containerClassName)}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 size-full"
        style={isSafari ? { filter: `blur(${blur}px)` } : undefined}
        aria-hidden
      />
      {children ? (
        <div className={cn("relative z-10", className)} {...props}>
          {children}
        </div>
      ) : null}
    </div>
  );
}
