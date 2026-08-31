"use client";

import Image from "next/image";
import { m, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState, type RefObject } from "react";

import {
  ArrowRight,
  CalendarDays,
  Check,
  FileVideo,
  Link2,
  MoreHorizontal,
  Pause,
  Play,
} from "@/components/ui/icons";
import { useDeferredVideoSource } from "@/hooks/useDeferredVideoSource";

type ApprovalPreviewProps = {
  videoTargetRef?: RefObject<HTMLDivElement | null>;
  videoSrc: string;
  videoPoster?: string;
};

const DEFAULT_MESSAGE =
  "Hi Daniel, I noticed Acme is scaling demand gen without growing the team. I recorded a 45-second idea to help you book more qualified meetings with less manual prospecting. Worth a quick look?";

export function ApprovalPreview({
  videoTargetRef,
  videoSrc,
  videoPoster,
}: ApprovalPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playWhenReadyRef = useRef(false);
  const reducedMotion = useReducedMotion();
  const { sourceEnabled, enableSource } = useDeferredVideoSource(videoRef, {
    defer: true,
  });
  const [isPlaying, setIsPlaying] = useState(false);

  async function toggleVideo() {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      enableSource();
      if (!sourceEnabled) {
        playWhenReadyRef.current = true;
        return;
      }
      await video.play();
    } else {
      video.pause();
    }
  }

  useEffect(() => {
    if (sourceEnabled) videoRef.current?.load();
  }, [sourceEnabled]);

  return (
    <div className="group relative isolate overflow-hidden rounded-xl border border-[#8f75f0] bg-[#f8f6ff] shadow-[0_30px_80px_rgba(75,42,185,0.24)]">
      <span aria-hidden className="absolute inset-x-0 top-0 z-20 h-1 bg-[linear-gradient(90deg,#5a32ed_0%,#a997ff_48%,#5a32ed_100%)]" />
      <div className="flex min-h-12 items-center gap-2 border-b border-[#e4def6] bg-[#fdfcff]/95 px-3.5 py-2 backdrop-blur-sm">
        <span className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-md bg-[#0a66c2] shadow-sm">
          <Image src="/landing/linkedin-logo.webp" alt="LinkedIn" width={28} height={28} className="size-full object-cover" />
        </span>
        <span className="relative size-8 shrink-0 overflow-hidden rounded-full bg-[#ebe7ff] ring-2 ring-white">
          <Image src="/landing/portraits/prospect-32.webp" alt="" fill sizes="32px" className="object-cover" />
          <span className="absolute bottom-0 right-0 size-2.5 rounded-full border-2 border-white bg-[#22a85a]" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="truncate text-sm font-semibold text-[#171427]">Daniel Chen</p>
          </div>
          <p className="truncate text-xs text-[#6e687d]">VP Marketing at Acme</p>
        </div>
        <button type="button" aria-label="More message options" className="flex size-9 shrink-0 items-center justify-center rounded-full text-[#6e687d] transition-colors hover:bg-[#f0ecff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6842f5]">
          <MoreHorizontal className="size-5" aria-hidden />
        </button>
      </div>

      <div className="relative flex flex-col overflow-hidden bg-[radial-gradient(circle_at_88%_6%,rgba(169,151,255,0.13),transparent_30%),linear-gradient(180deg,#ffffff_0%,#fdfcff_100%)]">
        <div className="flex-1 overflow-hidden px-4 pb-3 pt-2.5 sm:px-5">
          <m.div
            initial={reducedMotion ? false : { opacity: 0, y: 54, scale: 0.97 }}
            whileInView={reducedMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, amount: 0.55 }}
            transition={{ duration: 0.72, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="ml-auto max-w-[88%] sm:max-w-[84%]"
          >
            <div className="relative rounded-2xl rounded-br-md border border-[#d7ccff] bg-[linear-gradient(135deg,#f7f4ff_0%,#eee9ff_100%)] px-3 py-2.5 shadow-[0_8px_24px_rgba(83,49,190,0.12)]">
              <span aria-hidden className="absolute -right-px top-6 h-10 w-0.5 rounded-full bg-[linear-gradient(180deg,#6842f5,#b6a6ff)]" />
              <p className="whitespace-pre-line text-xs leading-5 text-[#211b36] sm:text-[13px]">{DEFAULT_MESSAGE}</p>

              <div ref={videoTargetRef} data-testid="campaign-video-preview" className="relative mt-2 aspect-[2/1] w-full overflow-hidden rounded-lg bg-[#121426] ring-1 ring-[#6842f5]/20">
                <video
                  ref={videoRef}
                  suppressHydrationWarning
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  poster={videoPoster}
                  aria-label="Personalized video prepared for Daniel"
                  onCanPlay={(event) => {
                    if (playWhenReadyRef.current) {
                      playWhenReadyRef.current = false;
                      void event.currentTarget.play().catch(() => setIsPlaying(false));
                    }
                  }}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  className="absolute inset-0 size-full object-cover object-center"
                >
                  {sourceEnabled ? <source src={videoSrc} type="video/mp4" /> : null}
                </video>
                <div aria-hidden className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,10,21,.08),rgba(8,10,21,.58))]" />
                <button
                  type="button"
                  onClick={toggleVideo}
                  aria-label={isPlaying ? "Pause personalized video preview" : "Play personalized video preview"}
                  className="absolute left-1/2 top-1/2 flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/[0.38] text-white ring-1 ring-white/60 backdrop-blur-sm transition-colors hover:bg-black/55 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-white"
                >
                  {isPlaying ? <Pause className="size-5 fill-white" aria-hidden /> : <Play className="ml-0.5 size-5 fill-white" aria-hidden />}
                </button>
                <span className="absolute right-2 top-2 flex items-center gap-1.5 rounded-full border border-white/25 bg-[#171127]/65 px-2 py-1 text-[9px] font-semibold text-white backdrop-blur-md">
                  <span className="size-1.5 rounded-full bg-[#b6a6ff] shadow-[0_0_8px_#b6a6ff]" />
                  Personalized for Daniel
                </span>
              </div>

              <div className="mt-1.5 flex items-center justify-end gap-1.5 text-[10px] text-[#756e85]">
                10:24 AM
                <span className="flex size-4 items-center justify-center rounded-full bg-[#6842f5] text-white shadow-[0_2px_7px_rgba(104,66,245,0.3)]">
                  <Check className="size-2.5" weight="bold" aria-hidden />
                </span>
              </div>
            </div>
          </m.div>

          <m.div
            initial={reducedMotion ? false : { opacity: 0, x: -24 }}
            whileInView={reducedMotion ? undefined : { opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.7 }}
            transition={{ duration: 0.55, delay: 0.72, ease: [0.22, 1, 0.36, 1] }}
            className="mt-2 flex items-end gap-2"
          >
            <span className="relative size-6 shrink-0 overflow-hidden rounded-full bg-[#ebe7ff]">
              <Image src="/landing/portraits/prospect-32.webp" alt="" fill sizes="24px" className="object-cover" />
            </span>
            <div className="max-w-[78%]">
              <div className="rounded-2xl rounded-bl-md border border-[#e5e0ee] bg-[#f3f1f8] px-3 py-2 text-xs leading-4 text-[#2d283b]">
                This is exactly what we&apos;re working on. I watched it. Let&apos;s talk. Thursday at 2 PM works for me.
              </div>
              <p className="mt-1 text-[10px] text-[#8a8498]">10:31 AM</p>
            </div>
          </m.div>

          <m.div
            initial={reducedMotion ? false : { opacity: 0, y: 12, scale: 0.98 }}
            whileInView={reducedMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, amount: 0.8 }}
            transition={{ duration: 0.45, delay: 1.05, ease: [0.22, 1, 0.36, 1] }}
            className="relative ml-8 mt-2 flex max-w-[19rem] items-center gap-2.5 rounded-xl border border-[#cfc2fb] bg-[#faf8ff] px-3 py-2 shadow-[0_8px_20px_rgba(83,49,190,0.09)]"
          >
            <span
              aria-hidden
              className="absolute -left-5 -top-4 h-6 w-5 rounded-bl-lg border-b border-l border-dashed border-[#aa98e7]"
            />
            <span
              aria-hidden
              className="absolute -left-[1.4rem] -top-[1.15rem] size-1.5 rounded-full border border-[#aa98e7] bg-[#fdfcff]"
            />
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[#6842f5] text-white shadow-[0_5px_14px_rgba(104,66,245,0.28)]">
              <CalendarDays className="size-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-[#28243a]">Meeting booked</p>
              <p className="truncate text-[10px] text-[#706b80]">Thursday · 2:00 PM · 20 min</p>
            </div>
            <Check className="size-4 shrink-0 text-[#6842f5]" weight="bold" aria-hidden />
          </m.div>
        </div>

        <div className="border-t border-[#e4def6] bg-[#faf8ff]/95 px-4 py-2 backdrop-blur-sm">
          <div className="rounded-lg border border-[#bfb2e9] bg-white px-3 py-1.5 shadow-[inset_0_1px_2px_rgba(62,38,128,0.04)]">
            <div className="flex min-h-5 items-start">
              <p className="text-xs text-[#7b7488]">Write a message…</p>
            </div>
            <div className="flex items-center gap-1 text-[#5f586d]">
              <button type="button" aria-label="Attach a file" className="flex size-7 items-center justify-center rounded-full hover:bg-[#f0ecff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6842f5]">
                <Link2 className="size-4" aria-hidden />
              </button>
              <button type="button" aria-label="Attach a video" className="flex size-7 items-center justify-center rounded-full hover:bg-[#f0ecff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6842f5]">
                <FileVideo className="size-4" aria-hidden />
              </button>
              <button type="button" aria-label="Add a GIF" className="flex h-7 items-center justify-center rounded-full px-2 text-[11px] font-bold hover:bg-[#f0ecff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6842f5]">GIF</button>
              <button type="button" aria-label="Add an emoji" className="flex size-7 items-center justify-center rounded-full text-base hover:bg-[#f0ecff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6842f5]"><span aria-hidden>☺</span></button>
              <span className="ml-auto flex size-8 items-center justify-center rounded-full bg-[#6842f5] text-white shadow-[0_6px_16px_rgba(104,66,245,0.28)]" aria-hidden>
                <ArrowRight className="size-4" weight="bold" />
              </span>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
