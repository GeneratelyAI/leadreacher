"use client";

import { ExternalLink, Play } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

type VideoAttachmentProps = {
  src: string;
  poster?: string;
  filename?: string;
  className?: string;
};

export function VideoAttachment({
  src,
  poster,
  filename = "Personalized video",
  className,
}: VideoAttachmentProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return (
      <a
        href={src}
        target="_blank"
        rel="noreferrer"
        className={cn("inline-flex items-center gap-1.5 text-xs font-medium text-onboarding-purple-600 underline dark:text-onboarding-purple-300", className)}
      >
        Open {filename} <ExternalLink className="size-3" />
      </a>
    );
  }

  return (
    <div className={cn("mt-2 w-full max-w-sm overflow-hidden rounded-lg border border-border bg-background shadow-sm", className)}>
      <div className="relative aspect-video bg-muted">
        <video
          className="size-full object-cover"
          src={src}
          poster={poster}
          controls={isPlaying}
          muted
          playsInline
          preload="metadata"
          onPlay={() => setIsPlaying(true)}
          onError={() => setHasError(true)}
        />
        {!isPlaying ? (
          <button
            type="button"
            className="absolute inset-0 grid place-items-center bg-foreground/10 transition-colors hover:bg-foreground/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
            aria-label={`Play ${filename}`}
            onClick={(event) => {
              const video = event.currentTarget.previousElementSibling;
              if (video instanceof HTMLVideoElement) void video.play();
            }}
          >
            <span className="grid size-11 place-items-center rounded-full border border-white/30 bg-black/45 text-white shadow-lg">
              <Play className="ml-0.5 size-5 fill-current" />
            </span>
          </button>
        ) : null}
      </div>
      <div className="flex items-center justify-between gap-3 px-3 py-2">
        <span className="truncate text-xs font-medium">{filename}</span>
        <a href={src} target="_blank" rel="noreferrer" className="shrink-0 text-muted-foreground hover:text-foreground" aria-label={`Open ${filename} in a new tab`}>
          <ExternalLink className="size-3.5" />
        </a>
      </div>
    </div>
  );
}
