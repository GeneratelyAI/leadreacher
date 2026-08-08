"use client";

import Image from "next/image";
import { useRef, type ReactNode } from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import { ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";

type ScrollExpandMediaProps = {
  mediaSrc: string;
  mediaAlt: string;
  title: string;
  eyebrow?: string;
  description?: string;
  children?: ReactNode;
  className?: string;
};

export function ScrollExpandMedia({
  mediaSrc,
  mediaAlt,
  title,
  eyebrow = "See LeadReacher in action",
  description,
  children,
  className,
}: ScrollExpandMediaProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const reducedMotion = Boolean(useReducedMotion());
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });

  const frameWidth = useTransform(
    scrollYProgress,
    [0, 0.72],
    reducedMotion ? ["92vw", "92vw"] : ["46vw", "92vw"],
  );
  const frameHeight = useTransform(
    scrollYProgress,
    [0, 0.72],
    reducedMotion ? ["76vh", "76vh"] : ["44vh", "76vh"],
  );
  const frameY = useTransform(
    scrollYProgress,
    [0, 0.72],
    reducedMotion ? [0, 0] : [72, 0],
  );
  const frameRadius = useTransform(scrollYProgress, [0, 0.72], [28, 14]);
  const backgroundOpacity = useTransform(scrollYProgress, [0, 0.72], [0.26, 0.08]);
  const titleScale = useTransform(scrollYProgress, [0, 0.48], [1, 0.9]);
  const titleOpacity = useTransform(scrollYProgress, [0, 0.42, 0.68], [1, 1, 0]);
  const contentOpacity = useTransform(scrollYProgress, [0.55, 0.82], [0, 1]);
  const mediaScale = useTransform(scrollYProgress, [0, 0.72], [1.08, 1]);

  return (
    <section
      ref={sectionRef}
      data-navbar-theme="dark"
      className={cn(
        "relative z-20 -mt-7 h-[150vh] min-h-[1000px] overflow-clip rounded-t-[28px] bg-[#0d1020] text-white sm:-mt-9 sm:rounded-t-[40px]",
        className,
      )}
    >
      <div className="sticky top-0 flex h-svh items-center justify-center overflow-hidden">
        <motion.div
          aria-hidden
          style={{ opacity: backgroundOpacity }}
          className="absolute inset-0"
        >
          <Image
            src={mediaSrc}
            alt=""
            fill
            sizes="100vw"
            className="scale-110 object-cover blur-2xl saturate-125"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,12,27,.55),rgba(13,16,32,.9))]" />
        </motion.div>

        <motion.div
          style={{ opacity: titleOpacity, scale: titleScale }}
          className="pointer-events-none absolute inset-x-5 top-[8vh] z-20 text-center sm:top-[7vh]"
        >
          <p className="text-xs font-semibold uppercase text-[#aa96ff]">{eyebrow}</p>
          <h2 className="mx-auto mt-4 max-w-4xl text-balance text-4xl font-semibold leading-tight sm:text-5xl lg:text-6xl">
            {title}
          </h2>
          {description ? (
            <p className="mx-auto mt-5 max-w-2xl text-sm leading-6 text-white/62 sm:text-base sm:leading-7">
              {description}
            </p>
          ) : null}
          <span className="mx-auto mt-6 flex w-fit items-center gap-2 text-xs font-medium text-white/48">
            Scroll to expand <ArrowDown className="size-3.5" aria-hidden />
          </span>
        </motion.div>

        <motion.div
          style={{
            width: frameWidth,
            height: frameHeight,
            y: frameY,
            borderRadius: frameRadius,
          }}
          className="relative z-10 mt-[18vh] min-h-[300px] min-w-[300px] max-w-[94vw] overflow-hidden border border-white/15 bg-white shadow-[0_38px_120px_rgba(0,0,0,.48)] sm:mt-[20vh]"
        >
          <motion.div style={{ scale: mediaScale }} className="absolute inset-0">
            <Image
              src={mediaSrc}
              alt={mediaAlt}
              fill
              sizes="(max-width: 768px) 94vw, 92vw"
              className="object-cover object-center"
            />
          </motion.div>
          <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-[#090b16]/76 via-transparent to-[#090b16]/8" />
          {children ? (
            <motion.div
              style={{ opacity: contentOpacity }}
              className="absolute inset-x-0 bottom-0 z-10 p-5 sm:p-7 lg:p-9"
            >
              {children}
            </motion.div>
          ) : null}
        </motion.div>
      </div>
    </section>
  );
}
