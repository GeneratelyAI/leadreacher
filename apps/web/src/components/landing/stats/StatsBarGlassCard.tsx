"use client";

import { useCallback, useRef, type ReactNode } from "react";

type StatsBarGlassCardProps = {
  children: ReactNode;
};

export default function StatsBarGlassCard({ children }: StatsBarGlassCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const shimmerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = useCallback(() => {
    const card = cardRef.current;
    if (!card) return;

    if (shimmerTimeoutRef.current) {
      clearTimeout(shimmerTimeoutRef.current);
    }

    card.classList.remove("liquid-glass-card--shimmer");
    void card.offsetWidth;
    card.classList.add("liquid-glass-card--shimmer");

    shimmerTimeoutRef.current = setTimeout(() => {
      card.classList.remove("liquid-glass-card--shimmer");
    }, 900);
  }, []);

  return (
    <div
      ref={cardRef}
      className="liquid-glass-card"
      onMouseEnter={handleMouseEnter}
    >
      <svg
        className="pointer-events-none absolute h-0 w-0"
        aria-hidden
        focusable="false"
      >
        <defs>
          <filter
            id="stats-bar-liquid-glass-refraction"
            x="-5%"
            y="-5%"
            width="110%"
            height="110%"
            colorInterpolationFilters="sRGB"
          >
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.012"
              numOctaves="2"
              seed="3"
              result="noise"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="noise"
              scale="3"
              xChannelSelector="R"
              yChannelSelector="G"
              result="displaced"
            />
            <feGaussianBlur in="displaced" stdDeviation="0.4" result="soft" />
            <feBlend in="soft" in2="SourceGraphic" mode="screen" />
          </filter>
        </defs>
      </svg>

      <div
        className="liquid-glass-card__refraction pointer-events-none absolute inset-0 rounded-[inherit]"
        aria-hidden
      />
      <div
        className="liquid-glass-card__shimmer pointer-events-none absolute inset-0 rounded-[inherit]"
        aria-hidden
      />

      <div className="relative z-1">{children}</div>
    </div>
  );
}
