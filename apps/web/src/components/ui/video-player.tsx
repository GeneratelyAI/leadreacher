"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Pause, Play, Volume1, Volume2, VolumeX } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

type VideoPlayerProps = {
  src: string;
  ariaLabel: string;
  className?: string;
  poster?: string;
  autoPlay?: boolean;
  startWhenVisible?: boolean;
  muted?: boolean;
  loop?: boolean;
  interactive?: boolean;
};

const formatTime = (seconds: number) => {
  if (!Number.isFinite(seconds)) return "0:00";
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
};

export default function VideoPlayer({ src, ariaLabel, className, poster, autoPlay = false, startWhenVisible = false, muted = false, loop = false, interactive = true }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const userPausedRef = useRef(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(muted);
  const [volume, setVolume] = useState(1);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showControls, setShowControls] = useState(false);

  const togglePlay = async () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      userPausedRef.current = false;
      try {
        await video.play();
      } catch {
        setIsPlaying(false);
      }
    } else {
      userPausedRef.current = true;
      video.pause();
    }
  };

  const enableAudio = () => {
    const video = videoRef.current;
    if (!video || !video.muted) return;

    video.muted = false;
    if (video.volume === 0) video.volume = 1;
    setIsMuted(false);
    setVolume(video.volume);
  };

  const updateProgress = () => {
    const video = videoRef.current;
    if (!video) return;
    setCurrentTime(video.currentTime);
    setProgress(video.duration ? (video.currentTime / video.duration) * 100 : 0);
  };

  const seek = (value: number) => {
    const video = videoRef.current;
    if (!video || !video.duration) return;
    video.currentTime = (value / 100) * video.duration;
    setProgress(value);
  };

  const changeVolume = (value: number) => {
    const video = videoRef.current;
    if (!video) return;
    const nextVolume = value / 100;
    video.volume = nextVolume;
    video.muted = nextVolume === 0;
    setVolume(nextVolume);
    setIsMuted(nextVolume === 0);
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    const muted = !video.muted;
    video.muted = muted;
    if (!muted && video.volume === 0) video.volume = 1;
    setIsMuted(muted);
    setVolume(muted ? video.volume : video.volume || 1);
  };

  const setSpeed = (speed: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = speed;
    setPlaybackRate(speed);
  };

  const revealControls = () => setShowControls(true);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) {
        video.pause();
      } else if (autoPlay && !userPausedRef.current) {
        void video.play().catch(() => setIsPlaying(false));
      }
    }, { threshold: 0.2 });
    observer.observe(video);
    return () => observer.disconnect();
  }, [autoPlay]);

  return (
    <div
      className={cn("group/player relative size-full overflow-hidden bg-[#0b0d18]", !interactive && "pointer-events-none", className)}
      role="group"
      aria-label={`${ariaLabel} player`}
      aria-keyshortcuts={interactive ? "Space Enter M" : undefined}
      tabIndex={interactive ? 0 : -1}
      onMouseEnter={interactive ? revealControls : undefined}
      onMouseLeave={interactive ? () => setShowControls(false) : undefined}
      onFocusCapture={interactive ? revealControls : undefined}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setShowControls(false);
      }}
      onPointerDown={
        interactive
          ? () => {
              revealControls();
              enableAudio();
            }
          : undefined
      }
      onKeyDown={interactive ? (event) => {
        if (event.key === " " || event.key === "Enter") {
          event.preventDefault();
          void togglePlay();
        }
        if (event.key.toLowerCase() === "m") toggleMute();
      } : undefined}
    >
      <video
        ref={videoRef}
        suppressHydrationWarning
        autoPlay={autoPlay && !startWhenVisible}
        muted={isMuted}
        loop={loop}
        poster={poster}
        playsInline
        preload="metadata"
        aria-label={ariaLabel}
        className="size-full cursor-pointer object-cover object-center"
        onClick={() => void togglePlay()}
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
        onTimeUpdate={updateProgress}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onVolumeChange={(event) => {
          setVolume(event.currentTarget.volume);
          setIsMuted(event.currentTarget.muted);
        }}
      >
        <source src={src} type="video/mp4" />
      </video>

      <AnimatePresence>
        {showControls ? (
          <motion.div
            className="absolute inset-x-3 bottom-3 z-20 rounded-lg border border-white/12 bg-[#0a0d1bd9] p-3 shadow-xl backdrop-blur-md sm:inset-x-5 sm:bottom-5 sm:p-4"
            initial={{ y: 14, opacity: 0, filter: "blur(6px)" }}
            animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
            exit={{ y: 14, opacity: 0, filter: "blur(6px)" }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center gap-2 text-xs tabular-nums text-white/75">
              <span>{formatTime(currentTime)}</span>
              <input aria-label="Video progress" type="range" min="0" max="100" step="0.1" value={progress} onChange={(event) => seek(Number(event.target.value))} className="h-1 min-w-0 flex-1 accent-white" />
              <span>{formatTime(duration)}</span>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 sm:gap-3">
                <button type="button" onClick={() => void togglePlay()} aria-label={isPlaying ? "Pause video" : "Play video"} className="flex size-8 items-center justify-center rounded-md text-white transition-colors hover:bg-white/12 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b6a6ff]">
                  {isPlaying ? <Pause className="size-4" /> : <Play className="ml-0.5 size-4 fill-current" />}
                </button>
                <button type="button" onClick={toggleMute} aria-label={isMuted ? "Unmute video" : "Mute video"} className="flex size-8 items-center justify-center rounded-md text-white transition-colors hover:bg-white/12 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b6a6ff]">
                  {isMuted ? <VolumeX className="size-4" /> : volume > 0.5 ? <Volume2 className="size-4" /> : <Volume1 className="size-4" />}
                </button>
                <input aria-label="Volume" type="range" min="0" max="100" value={isMuted ? 0 : volume * 100} onChange={(event) => changeVolume(Number(event.target.value))} className="hidden h-1 w-20 accent-white sm:block" />
              </div>
              <div className="flex items-center rounded-md bg-white/7 p-0.5" aria-label="Playback speed">
                {[0.5, 1, 1.5, 2].map((speed) => <button key={speed} type="button" onClick={() => setSpeed(speed)} aria-pressed={playbackRate === speed} className={cn("rounded px-1.5 py-1 text-[10px] font-medium text-white/70 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b6a6ff]", playbackRate === speed && "bg-white/14 text-white")}>{speed}x</button>)}
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
