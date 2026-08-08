"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { ArrowUpRight, Check, Link2, Zap } from "lucide-react";
import { SocialMediaIcon } from "@/components/ui/SocialMediaIcon";
import { cn } from "@/lib/utils";

export type OrbitalStatus = "completed" | "in-progress" | "pending";

export type OrbitalTimelineItem = {
  id: number;
  title: string;
  date: string;
  content: string;
  category: string;
  relatedIds: number[];
  status: OrbitalStatus;
  energy: number;
  image?: string;
  whatsapp?: boolean;
};

type RadialOrbitalTimelineProps = {
  timelineData: OrbitalTimelineItem[];
  className?: string;
  energyLabel?: string;
};

function ChannelIcon({ item }: { item: OrbitalTimelineItem }) {
  if (item.whatsapp) {
    return <SocialMediaIcon name="whatsapp" className="size-5 text-[#25D366]" />;
  }

  if (item.image) {
    return <Image src={item.image} width={22} height={22} alt="" className="size-[22px] object-contain" />;
  }

  return <Check aria-hidden className="size-4" />;
}

function statusLabel(status: OrbitalStatus) {
  if (status === "completed") return "Connected";
  if (status === "in-progress") return "Connecting";
  return "Available";
}

export default function RadialOrbitalTimeline({
  timelineData,
  className,
  energyLabel = "Channel readiness",
}: RadialOrbitalTimelineProps) {
  const [rotationAngle, setRotationAngle] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [isInteracting, setIsInteracting] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [orbitRadius, setOrbitRadius] = useState(200);
  const reducedMotion = Boolean(useReducedMotion());
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const updateRadius = () => setOrbitRadius(Math.min(200, Math.max(118, root.clientWidth * 0.3)));
    updateRadius();
    const observer = new ResizeObserver(updateRadius);
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { threshold: 0.1 },
    );
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  const shouldAutoRotate = !reducedMotion && isVisible && !isInteracting && selectedId === null;

  useEffect(() => {
    if (!shouldAutoRotate) return;

    const interval = window.setInterval(() => {
      setRotationAngle((current) => Number(((current + 14) % 360).toFixed(3)));
    }, 2200);

    return () => window.clearInterval(interval);
  }, [shouldAutoRotate]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setSelectedId(null);
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, []);

  const selectedItem = useMemo(
    () => timelineData.find((item) => item.id === selectedId) ?? null,
    [selectedId, timelineData],
  );
  const relatedIds = useMemo(
    () => new Set(selectedItem?.relatedIds ?? []),
    [selectedItem],
  );

  const selectNode = (id: number) => {
    if (selectedId === id) {
      setSelectedId(null);
      return;
    }

    const index = timelineData.findIndex((entry) => entry.id === id);
    if (index < 0) return;

    const targetAngle = 270 - (index / timelineData.length) * 360;
    setRotationAngle((current) => {
      const normalizedCurrent = ((current % 360) + 360) % 360;
      let delta = targetAngle - normalizedCurrent;
      if (delta > 180) delta -= 360;
      if (delta < -180) delta += 360;
      return current + delta;
    });
    setSelectedId(id);
  };

  return (
    <div
      ref={rootRef}
      className={cn(
        "relative flex h-[520px] w-full items-center justify-center overflow-hidden rounded-2xl bg-[#080a12] text-white",
        className,
      )}
      onClick={() => setSelectedId(null)}
      onPointerEnter={() => setIsInteracting(true)}
      onPointerLeave={() => setIsInteracting(false)}
      onFocusCapture={() => setIsInteracting(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setIsInteracting(false);
      }}
    >
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(106,70,245,.16),transparent_33%),linear-gradient(145deg,#0b0d17,#070810)]"
      />
      <div
        className="relative flex size-full items-center justify-center"
        style={{ perspective: "1000px" }}
      >
        <div aria-hidden className="absolute size-16 rounded-full bg-gradient-to-br from-[#8f73ff] via-[#5b36ed] to-[#35c7a1] shadow-[0_0_45px_rgba(104,66,245,.45)]">
          <span className="absolute -inset-2 rounded-full border border-white/20 motion-safe:animate-ping" />
          <span className="absolute -inset-4 rounded-full border border-white/10 motion-safe:animate-ping [animation-delay:.5s]" />
          <span className="absolute inset-4 rounded-full bg-white/85 backdrop-blur-md" />
        </div>
        <div aria-hidden className="absolute size-[min(78vw,400px)] rounded-full border border-white/10" />

        {timelineData.map((item, index) => {
          const angle = ((index / timelineData.length) * 360 + rotationAngle) % 360;
          const radians = (angle * Math.PI) / 180;
          const x = Number((orbitRadius * Math.cos(radians)).toFixed(3));
          const y = Number((orbitRadius * Math.sin(radians)).toFixed(3));
          const isExpanded = selectedId === item.id;
          const isRelated = relatedIds.has(item.id);
          const depth = Math.round(100 + 50 * Math.cos(radians));
          const opacity = isExpanded
            ? 1
            : Number(Math.max(0.48, Math.min(1, 0.48 + 0.52 * ((1 + Math.sin(radians)) / 2))).toFixed(3));

          return (
            <div
              key={item.id}
              className={cn(
                "absolute transition-[transform,opacity] ease-out",
                shouldAutoRotate ? "duration-700" : "duration-500",
              )}
              style={{ transform: `translate(${x}px, ${y}px)`, zIndex: isExpanded ? 200 : depth, opacity }}
            >
              <span
                aria-hidden
                className={cn("absolute rounded-full", isRelated && "motion-safe:animate-pulse")}
                style={{
                  width: `${item.energy * 0.5 + 40}px`,
                  height: `${item.energy * 0.5 + 40}px`,
                  left: `-${(item.energy * 0.5) / 2}px`,
                  top: `-${(item.energy * 0.5) / 2}px`,
                  background: "radial-gradient(circle, rgba(139,112,255,.28) 0%, rgba(139,112,255,0) 70%)",
                }}
              />
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  selectNode(item.id);
                }}
                aria-expanded={isExpanded}
                aria-controls={`orbital-channel-${item.id}`}
                className={cn(
                  "relative flex size-11 items-center justify-center rounded-full border-2 transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a894ff] focus-visible:ring-offset-4 focus-visible:ring-offset-[#080a12]",
                  isExpanded && "scale-150 border-white bg-white text-black shadow-[0_0_22px_rgba(255,255,255,.4)]",
                  !isExpanded && isRelated && "border-[#b8a8ff] bg-white/70 text-black motion-safe:animate-pulse",
                  !isExpanded && !isRelated && "border-white/35 bg-[#080a12] text-white hover:border-white/70 hover:bg-white/10",
                )}
              >
                <ChannelIcon item={item} />
                <span className="sr-only">{isExpanded ? `Close ${item.title} details` : `View ${item.title} details`}</span>
              </button>
              <span
                className={cn(
                  "pointer-events-none absolute left-1/2 top-14 -translate-x-1/2 whitespace-nowrap text-xs font-semibold transition-all duration-300",
                  isExpanded ? "scale-110 text-white" : "text-white/65",
                )}
              >
                {item.title}
              </span>

              {isExpanded ? (
                <div
                  id={`orbital-channel-${item.id}`}
                  className="absolute left-1/2 top-20 w-64 -translate-x-1/2 overflow-visible rounded-lg border border-white/25 bg-black/92 text-left shadow-[0_22px_70px_rgba(0,0,0,.55)] backdrop-blur-lg"
                  onClick={(event) => event.stopPropagation()}
                >
                  <span aria-hidden className="absolute -top-3 left-1/2 h-3 w-px -translate-x-1/2 bg-white/45" />
                  <div className="p-5 pb-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="rounded-sm border border-white/45 px-2 py-0.5 text-[10px] font-semibold uppercase text-white">
                        {statusLabel(item.status)}
                      </span>
                      <span className="text-[10px] text-white/45">{item.date}</span>
                    </div>
                    <h3 className="mt-3 text-sm font-semibold">{item.title}</h3>
                    <p className="mt-3 text-xs leading-5 text-white/72">{item.content}</p>
                  </div>
                  <div className="border-t border-white/10 px-5 py-4">
                    <div className="mb-1.5 flex items-center justify-between text-[10px]">
                      <span className="flex items-center gap-1.5 text-white/68"><Zap className="size-3" />{energyLabel}</span>
                      <span>{item.energy}%</span>
                    </div>
                    <div className="h-1 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full bg-gradient-to-r from-[#3b82f6] to-[#8b5cf6]" style={{ width: `${item.energy}%` }} />
                    </div>
                    {item.relatedIds.length > 0 ? (
                      <div className="mt-4 border-t border-white/10 pt-3">
                        <p className="flex items-center gap-1.5 text-[10px] font-medium uppercase text-white/58"><Link2 className="size-3" />Connected nodes</p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {item.relatedIds.map((relatedId) => {
                            const related = timelineData.find((entry) => entry.id === relatedId);
                            if (!related) return null;
                            return (
                              <button
                                key={relatedId}
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  selectNode(relatedId);
                                }}
                                className="inline-flex h-7 items-center gap-1 rounded-sm border border-white/20 px-2 text-[10px] text-white/74 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a894ff]"
                              >
                                {related.title}<ArrowUpRight className="size-2.5" />
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <p className="sr-only" aria-live="polite">
        {selectedItem
          ? `${selectedItem.title} selected. ${selectedItem.content}`
          : shouldAutoRotate
            ? "Channel orbit rotating."
            : "Channel orbit paused."}
      </p>
    </div>
  );
}
