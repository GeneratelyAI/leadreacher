"use client";

import Image from "next/image";
import { useId, useRef, type ReactNode, type RefObject } from "react";
import {
  m,
  type MotionValue,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import { Check, UserRound } from "@/components/ui/icons";
import VideoPlayer from "@/components/ui/video-player";
import { cn } from "@/lib/utils";
import { EdgeSurface } from "@/components/ui/edge-surface";
import { VideoMagicMove } from "@/components/ui/video-magic-move";

type ScrollExpandMediaProps = {
  mediaSrc: string;
  mediaAlt: string;
  mediaType?: "image" | "video";
  posterSrc?: string;
  title: ReactNode;
  eyebrow?: string;
  description?: ReactNode;
  children?: ReactNode;
  className?: string;
  magicMoveTargetRef?: RefObject<HTMLDivElement | null>;
};

function PersonalizationCallout({
  arrowProgress,
  textRotate,
  compact = false,
}: {
  arrowProgress: MotionValue<number> | number;
  textRotate: MotionValue<number>;
  compact?: boolean;
}) {
  const filterId = `crayon-${useId().replaceAll(":", "")}`;

  return (
    <div className={cn("relative text-left", compact ? "h-48 w-44" : "h-36 w-36 large-desktop:h-44 large-desktop:w-52")}>
      <m.p
        className={cn(
          "relative z-10 pt-1 font-semibold leading-[1.05] text-white drop-shadow-[0_2px_8px_rgba(0,0,0,.65)]",
          compact ? "w-44 text-[1.6rem]" : "w-36 text-[1.5rem] large-desktop:w-52 large-desktop:text-[2.15rem]",
        )}
        style={{ fontFamily: '"Bradley Hand", "Comic Sans MS", cursive', rotate: textRotate, x: compact ? 0 : -16, y: compact ? 0 : -20 }}
      >
        &quot;Customer Name&quot;
        <br />
        will be
        <br />
        personalized
        <br />
        to each prospect
      </m.p>
      <svg
        aria-hidden="true"
        viewBox={compact ? "0 0 260 330" : "0 0 208 176"}
        fill="none"
        className={cn(
          "pointer-events-none absolute overflow-visible",
          compact ? "-top-24 left-0 h-[calc(100%+6rem)] w-[calc(100%+5rem)]" : "inset-0 h-full w-40 large-desktop:w-[15.5rem]",
        )}
      >
        <defs>
          <filter id={filterId} x="-8%" y="-12%" width="116%" height="124%">
            <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="8" result="grain" />
            <feDisplacementMap in="SourceGraphic" in2="grain" scale="1.8" />
          </filter>
        </defs>
        {compact ? (
          <m.path
            d="M88 246C125 236 154 187 179 123C193 87 204 56 215 28M191 45L215 28L216 58"
            stroke="#70a8ff"
            strokeWidth="9"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            filter={`url(#${filterId})`}
            style={{ pathLength: arrowProgress }}
          />
        ) : (
          <m.path
            className="xl:hidden"
            d="M70 146C70 180 92 205 135 214C153 218 171 215 185 205M163 190L185 205L162 222"
            stroke="#70a8ff"
            strokeWidth="9"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            filter={`url(#${filterId})`}
            style={{ pathLength: arrowProgress }}
          />
        )}
        <m.path
          className="hidden xl:block"
          d="M82 170C80 224 100 272 145 292C160 299 173 300 185 292M164 277L185 292L162 309"
          stroke="#70a8ff"
          strokeWidth="9"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          filter={`url(#${filterId})`}
          style={{ pathLength: arrowProgress }}
        />
      </svg>
    </div>
  );
}

export function ScrollExpandMedia({
  mediaSrc,
  mediaAlt,
  mediaType = "image",
  posterSrc,
  title,
  eyebrow = "See LeadReacher in action",
  description,
  children,
  className,
  magicMoveTargetRef,
}: ScrollExpandMediaProps) {
  const flowRef = useRef<HTMLDivElement>(null);
  const videoFrameRef = useRef<HTMLDivElement>(null);
  const reducedMotion = Boolean(useReducedMotion());
  const isVideo = mediaType === "video";

  const { scrollYProgress } = useScroll({
    target: flowRef,
    offset: ["start start", "end end"],
  });

  const frameScale = useTransform(
    scrollYProgress,
    [0, 0.12, 0.62, 1],
    reducedMotion ? [1, 1, 1, 1] : [0.36, 0.36, 1, 1],
  );
  const frameY = useTransform(
    scrollYProgress,
    [0, 0.62],
    reducedMotion ? [0, 0] : [116, 0],
  );
  const introOpacity = useTransform(
    scrollYProgress,
    [0, 0.16, 0.36, 1],
    reducedMotion ? [0, 0, 0, 0] : [1, 1, 0, 0],
  );
  const introY = useTransform(scrollYProgress, [0, 0.36, 1], [0, -42, -42]);
  const contextOpacity = useTransform(scrollYProgress, [0, 0.18, 0.42, 1], [1, 1, 0, 0]);
  const contextY = useTransform(scrollYProgress, [0, 0.42, 1], [0, -18, -18]);
  const calloutOpacity = useTransform(
    scrollYProgress,
    [0, 0.62, 0.7, 1],
    reducedMotion ? [1, 1, 1, 1] : [0, 0, 1, 1],
  );
  const calloutScale = useTransform(
    scrollYProgress,
    [0, 0.62, 0.7, 0.77, 1],
    reducedMotion ? [1, 1, 1, 1, 1] : [0.76, 0.76, 1.06, 1, 1],
  );
  const arrowRotate = useTransform(
    scrollYProgress,
    [0, 0.62, 0.7, 0.77, 1],
    reducedMotion ? [-5, -5, -5, -5, -5] : [-12, -12, -3, -5, -5],
  );
  const textRotate = useTransform(
    scrollYProgress,
    [0, 0.62, 0.7, 0.77, 1],
    reducedMotion ? [-8, -8, -8, -8, -8] : [-9, -9, -5, -8, -8],
  );
  const calloutY = useTransform(
    scrollYProgress,
    [0, 0.62, 0.7, 0.77, 1],
    reducedMotion ? [0, 0, 0, 0, 0] : [24, 24, -5, 0, 0],
  );
  const arrowProgress = useTransform(
    scrollYProgress,
    [0, 0.69, 0.84, 1],
    reducedMotion ? [1, 1, 1, 1] : [0, 0, 1, 1],
  );
  const approvalOpacity = useTransform(
    scrollYProgress,
    [0, 0.58, 0.76, 1],
    reducedMotion ? [1, 1, 1, 1] : [0, 0, 1, 1],
  );
  const approvalY = useTransform(scrollYProgress, [0, 0.58, 0.76, 1], [16, 16, 0, 0]);
  const greetingOpacity = useTransform(
    scrollYProgress,
    [0, 0.62, 0.72, 1],
    reducedMotion ? [1, 1, 1, 1] : [0, 0, 1, 1],
  );
  const greetingY = useTransform(scrollYProgress, [0, 0.62, 0.72, 1], [12, 12, 0, 0]);
  const greetingScale = useTransform(
    scrollYProgress,
    [0, 0.62, 0.72, 1],
    reducedMotion ? [1, 1, 1, 1] : [0.94, 0.94, 1, 1],
  );
  const backgroundOpacity = useTransform(scrollYProgress, [0, 0.68, 1], [0.32, 0.08, 0.08]);
  const contentOpacity = useTransform(
    scrollYProgress,
    [0, 0.76, 0.96, 1],
    reducedMotion ? [1, 1, 1, 1] : [0, 0, 1, 1],
  );
  const contentY = useTransform(scrollYProgress, [0, 0.76, 0.96, 1], [18, 18, 0, 0]);

  const media = isVideo ? (
    <VideoPlayer
      src={mediaSrc}
      poster={posterSrc}
      ariaLabel={mediaAlt}
      autoPlay
      startWhenVisible
      muted
      loop
      deferSourceUntilVisible
    />
  ) : (
    <Image src={mediaSrc} alt={mediaAlt} fill sizes="(max-width: 768px) 100vw, 90vw" className="object-cover object-center" />
  );

  return (
    <section
      data-navbar-theme="dark"
      className={cn("relative z-20 -mt-10 overflow-clip text-white sm:-mt-12", className)}
    >
      <div ref={flowRef} className="relative md:h-[200svh]">
        <EdgeSurface as="div" tone="dark" className="flex flex-col px-4 pb-14 pt-16 sm:px-8 md:sticky md:top-0 md:h-svh md:min-h-[720px] md:items-center md:justify-center md:px-0 md:py-0">
          {posterSrc ? (
            <m.div aria-hidden style={{ opacity: backgroundOpacity }} className="pointer-events-none absolute inset-0 hidden md:block">
              <Image src={posterSrc} alt="" fill sizes="100vw" className="scale-110 object-cover blur-2xl saturate-125" />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,12,27,.72),rgba(13,16,32,.94))]" />
            </m.div>
          ) : null}

          <m.div
            style={{ opacity: introOpacity, y: introY }}
            className="relative z-10 mx-auto max-w-5xl text-center max-md:transform-none! max-md:opacity-100! md:absolute md:inset-x-6 md:top-[7vh]"
          >
            <p className="text-xs font-semibold uppercase text-[#aa96ff]">{eyebrow}</p>
            <h2 className="mx-auto mt-4 max-w-4xl text-pretty text-4xl font-semibold leading-[1.08] sm:text-5xl lg:text-[3.5rem]">
              {title}
            </h2>
            {description ? <div className="mx-auto mt-5 max-w-3xl text-base leading-7 text-white/65 lg:text-lg lg:leading-8">{description}</div> : null}
          </m.div>

          <m.div
            ref={videoFrameRef}
            data-testid="scroll-expand-video-source"
            style={{ scale: frameScale, y: frameY }}
            className="relative z-20 mx-auto mt-9 aspect-video w-full max-w-3xl origin-center overflow-hidden rounded-xl border border-white/20 bg-[#0b0d18] shadow-[0_38px_120px_rgba(0,0,0,.48)] [backface-visibility:hidden] [transform:translateZ(0)] max-md:transform-none! md:absolute md:mt-0 md:w-[min(90vw,calc(70svh*16/9),80rem)] md:max-w-none md:will-change-transform"
          >
            {media}

            <m.div
              aria-hidden
              style={{ opacity: contextOpacity, y: contextY }}
              className="pointer-events-none absolute left-3 top-3 z-20 flex items-center gap-2 rounded-lg border border-white/15 bg-[#0b0d1bcc] px-3 py-2 text-left shadow-lg backdrop-blur-md sm:left-5 sm:top-5 sm:px-4 sm:py-3"
            >
              <span className="flex size-8 items-center justify-center rounded-md bg-[#6842f5] text-white"><UserRound className="size-4" /></span>
              <span><span className="block text-[10px] font-semibold uppercase text-[#b6a6ff]">Prepared for</span><span className="mt-0.5 block text-xs font-semibold text-white sm:text-sm">Sarah · Common Thread</span></span>
            </m.div>

            <m.div
              aria-hidden
              style={{ opacity: approvalOpacity, y: approvalY }}
              className="pointer-events-none absolute right-3 top-3 z-20 hidden items-center gap-2 rounded-lg border border-white/15 bg-[#0b0d1bcc] px-3 py-2 text-xs font-semibold text-white shadow-lg backdrop-blur-md sm:right-5 sm:top-5 md:flex"
            >
              <span className="flex size-6 items-center justify-center rounded-full bg-[#33c98b] text-[#07120e]"><Check className="size-3.5" /></span>
              Ready for your approval
            </m.div>

            <m.div
              aria-hidden
              style={{ opacity: greetingOpacity, y: greetingY, scale: greetingScale }}
              className="pointer-events-none absolute bottom-3 right-3 z-20 flex origin-left items-center gap-2 rounded-lg border border-white/20 bg-[#0b0d1be6] px-3 py-2 text-left shadow-xl backdrop-blur-md xl:left-5 xl:right-auto xl:top-[60%] xl:bottom-auto"
            >
              <Image
                src="/landing/portraits/prospect-68.webp"
                alt=""
                width={28}
                height={28}
                className="size-7 rounded-full border border-white/30 object-cover shadow-[0_2px_8px_rgba(0,0,0,.32)]"
              />
              <span>
                <span className="block text-[9px] font-semibold uppercase tracking-[0.08em] text-[#b6a6ff]">Personalized greeting</span>
                <span className="mt-0.5 block text-sm font-semibold text-white">Hi, Sarah</span>
              </span>
            </m.div>
          </m.div>

          <m.div
            style={{ opacity: calloutOpacity, scale: calloutScale, rotate: arrowRotate, y: calloutY }}
            className="pointer-events-none absolute left-8 top-8 z-30 hidden origin-top-left md:block xl:left-12 xl:top-[calc(48.8vh-10rem)] large-desktop:left-[calc(8.2vw-1.75rem)]"
          >
            <PersonalizationCallout arrowProgress={arrowProgress} textRotate={textRotate} />
          </m.div>

          <m.div
            style={{ opacity: calloutOpacity, scale: calloutScale, y: calloutY }}
            className="relative z-30 mx-auto mt-6 block h-48 w-36 md:hidden max-md:transform-none! max-md:opacity-100!"
          >
            <PersonalizationCallout arrowProgress={1} textRotate={textRotate} compact />
          </m.div>

        </EdgeSurface>
      </div>

      {children ? (
        <m.div style={{ opacity: contentOpacity, y: contentY }} className="relative z-10 bg-[#0d1020] px-5 pb-28 pt-8 sm:px-8 sm:pb-32 md:px-10 md:pb-40 md:pt-10 max-md:transform-none! max-md:opacity-100!">
          <div className="mx-auto max-w-7xl large-desktop:max-w-[88rem]">{children}</div>
        </m.div>
      ) : null}
      {isVideo && magicMoveTargetRef ? (
        <VideoMagicMove
          flowRef={flowRef}
          sourceRef={videoFrameRef}
          targetRef={magicMoveTargetRef}
          mediaSrc={mediaSrc}
          posterSrc={posterSrc}
          mediaAlt={mediaAlt}
          disabled={reducedMotion}
        />
      ) : null}
    </section>
  );
}
