const STRANDS = [
  { x: 14, top: 32, bottom: 68, color: "#8ca8ff", width: 1.1, delay: "0ms" },
  { x: 27, top: 22, bottom: 78, color: "#7860ee", width: 1.35, delay: "-900ms" },
  { x: 39, top: 37, bottom: 63, color: "#c09cff", width: 1, delay: "-1.8s" },
  { x: 50, top: 14, bottom: 86, color: "#6546e8", width: 1.6, delay: "-2.7s" },
  { x: 61, top: 32, bottom: 68, color: "#83b8ff", width: 1.05, delay: "-1.2s" },
  { x: 73, top: 22, bottom: 78, color: "#9a62ef", width: 1.3, delay: "-2.1s" },
  { x: 86, top: 37, bottom: 63, color: "#6f7ff5", width: 1, delay: "-3s" },
] as const;

export default function HeroSectionBreak() {
  return (
    <div
      className="hero-section-break pointer-events-none absolute inset-x-0 top-0 z-10 h-20 sm:h-26 lg:h-32"
      aria-hidden
    >
      <svg
        className="absolute inset-0 size-full overflow-visible"
        viewBox="0 0 1440 128"
        preserveAspectRatio="none"
        fill="none"
      >
        <defs>
          <linearGradient id="hero-break-edge" x1="0" y1="0" x2="1440" y2="0" gradientUnits="userSpaceOnUse">
            <stop stopColor="#c6c3f2" stopOpacity="0" />
            <stop offset="0.2" stopColor="#d8d5f7" stopOpacity="0.52" />
            <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.96" />
            <stop offset="0.8" stopColor="#d8d5f7" stopOpacity="0.52" />
            <stop offset="1" stopColor="#c6c3f2" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="hero-break-glow" x1="0" y1="0" x2="1440" y2="0" gradientUnits="userSpaceOnUse">
            <stop stopColor="#8b7fd4" stopOpacity="0" />
            <stop offset="0.5" stopColor="#7660ec" stopOpacity="0.3" />
            <stop offset="1" stopColor="#8b7fd4" stopOpacity="0" />
          </linearGradient>
        </defs>

        <path d="M-20 17 Q720 111 1460 17 L1460 128 L-20 128 Z" fill="var(--landing-light-bg)" />
        <path
          d="M-20 17 Q720 111 1460 17"
          stroke="url(#hero-break-glow)"
          strokeWidth="7"
          vectorEffect="non-scaling-stroke"
          opacity="0.2"
        />
        <path
          d="M-20 17 Q720 111 1460 17"
          stroke="url(#hero-break-edge)"
          strokeWidth="1.25"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      <svg
        className="absolute left-1/2 top-1/2 h-[64%] w-20 -translate-x-1/2 -translate-y-1/2 overflow-visible sm:w-24 lg:w-28"
        viewBox="0 0 100 100"
        fill="none"
      >
        <defs>
          <linearGradient id="hero-break-strand" x1="0" y1="0" x2="0" y2="100" gradientUnits="userSpaceOnUse">
            <stop stopColor="#ffffff" stopOpacity="0" />
            <stop offset="0.28" stopColor="#ffffff" stopOpacity="0.82" />
            <stop offset="0.58" stopColor="#7760ef" stopOpacity="0.72" />
            <stop offset="1" stopColor="#7760ef" stopOpacity="0" />
          </linearGradient>
          <radialGradient id="hero-break-node" cx="0" cy="0" r="1" gradientTransform="translate(50 54) rotate(90) scale(30 44)" gradientUnits="userSpaceOnUse">
            <stop stopColor="#775fec" stopOpacity="0.18" />
            <stop offset="1" stopColor="#775fec" stopOpacity="0" />
          </radialGradient>
        </defs>

        <ellipse cx="50" cy="54" rx="44" ry="30" fill="url(#hero-break-node)" />
        {STRANDS.map((strand) => (
          <g key={strand.x} className="hero-section-break__strand" style={{ animationDelay: strand.delay }}>
            <line
              x1={strand.x}
              y1={strand.top}
              x2={strand.x}
              y2={strand.bottom}
              stroke="url(#hero-break-strand)"
              strokeWidth={strand.width}
              strokeLinecap="round"
            />
            <circle cx={strand.x} cy={strand.top + 4} r={strand.width + 0.8} fill={strand.color} fillOpacity="0.72" />
            <circle cx={strand.x} cy={strand.bottom - 3} r={strand.width + 0.35} fill={strand.color} fillOpacity="0.48" />
          </g>
        ))}
      </svg>
    </div>
  );
}
