"use client";

import Link from "next/link";
import Image from "next/image";
import {
  Copy,
  Download,
  Loader2,
  MoreHorizontal,
  Pause,
  Play,
  RefreshCw,
  Replace,
  TriangleAlert,
  Video,
} from "@/components/ui/icons";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ApiError, apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

export type CampaignVideoSummary = {
  id: string | null;
  status: string;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  videosSent: number;
  paused: boolean;
  needsReview: boolean;
  criticScore: number | null;
};

type CampaignVideoProps = {
  campaignId: string;
  video: CampaignVideoSummary | null | undefined;
  onVideoChange?: (next: CampaignVideoSummary) => void;
};

type VideoGenerationMode = "standardized" | "personalized";

function formatCount(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function isPreviewable(video: CampaignVideoSummary | null | undefined): boolean {
  if (!video) return false;
  if (video.needsReview) return false;
  if (!["ready", "approved"].includes(video.status)) return false;
  return Boolean(video.thumbnailUrl || video.videoUrl);
}

function isGenerating(status: string): boolean {
  return status === "pending" || status === "generating";
}

export function CampaignVideo({ campaignId, video, onVideoChange }: CampaignVideoProps) {
  const [failedThumbId, setFailedThumbId] = useState<string | null>(null);
  const [playOpen, setPlayOpen] = useState(false);
  const [pausing, setPausing] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [generationMode, setGenerationMode] = useState<VideoGenerationMode | null>(null);

  const resolved: CampaignVideoSummary = video ?? {
    id: null,
    status: "unused",
    videoUrl: null,
    thumbnailUrl: null,
    videosSent: 0,
    paused: false,
    needsReview: false,
    criticScore: null,
  };

  const hasThumb =
    Boolean(resolved.thumbnailUrl) &&
    failedThumbId !== resolved.id &&
    isPreviewable(resolved);
  const canPlay = Boolean(resolved.videoUrl) && isPreviewable(resolved);
  const activityHref = campaignId
    ? `/dashboard/activity?kind=video&campaignId=${encodeURIComponent(campaignId)}`
    : "/dashboard/activity?kind=video";
  const campaignsHref = "/dashboard/campaigns";
  const canManage = Boolean(campaignId);

  async function setPaused(paused: boolean) {
    setPausing(true);
    try {
      await apiFetch<{ id: string; paused: boolean }>(`/dashboard/campaigns/${campaignId}/video`, {
        method: "PATCH",
        body: JSON.stringify({ paused }),
      });
      onVideoChange?.({ ...resolved, paused });
      toast.success(paused ? "Video sends paused for this campaign" : "Video sends resumed");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Unable to update video pause state");
    } finally {
      setPausing(false);
    }
  }

  async function copyLink() {
    if (!resolved.videoUrl) return;
    try {
      await navigator.clipboard.writeText(resolved.videoUrl);
      toast.success("Video link copied");
    } catch {
      toast.error("Unable to copy link");
    }
  }

  async function retryVideo() {
    setRetrying(true);
    try {
      await apiFetch<{ queued: boolean }>(`/campaigns/${campaignId}/video/retry`, { method: "POST", body: JSON.stringify({}) });
      onVideoChange?.({ ...resolved, status: "generating", needsReview: false, criticScore: null });
      toast.success("Video retry queued. Outreach remains unchanged.");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Unable to retry video generation");
    } finally {
      setRetrying(false);
    }
  }

  async function enableVideo(mode: VideoGenerationMode) {
    setGenerationMode(mode);
    try {
      const result = await apiFetch<{ status: string }>(`/dashboard/campaigns/${campaignId}/video/enable`, {
        method: "POST",
        body: JSON.stringify({ mode }),
      });
      onVideoChange?.({ ...resolved, status: result.status, paused: false });
      toast.success(
        mode === "personalized"
          ? "Personalized video generation started"
          : "Standard video generation started",
      );
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Unable to enable campaign video");
    } finally {
      setGenerationMode(null);
    }
  }

  return (
    <>
      <AspectRatio
        ratio={16 / 9}
        className="relative flex items-center justify-center overflow-hidden rounded-lg bg-onboarding-neutral-100 dark:bg-onboarding-neutral-850"
      >
        {hasThumb ? (
          <Image
            src={resolved.thumbnailUrl ?? ""}
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, 720px"
            unoptimized
            className="absolute inset-0 size-full object-cover"
            onError={() => setFailedThumbId(resolved.id)}
          />
        ) : null}

        {resolved.paused && isPreviewable(resolved) ? (
          <span className="absolute top-3 right-14 z-10 inline-flex items-center rounded-md bg-onboarding-neutral-0/95 px-2 py-1 text-[11px] font-semibold text-onboarding-ink shadow-sm dark:bg-onboarding-neutral-900/95 dark:text-onboarding-neutral-0">
            Paused
          </span>
        ) : null}

        {resolved.needsReview ? (
          <span className="absolute top-3 left-3 z-10 inline-flex items-center gap-1 rounded-md bg-onboarding-warning-50/95 px-2 py-1 text-[11px] font-semibold text-onboarding-warning-800 shadow-sm dark:bg-onboarding-warning-900/90 dark:text-onboarding-warning-100">
            <TriangleAlert className="size-3" aria-hidden /> Review required
          </span>
        ) : null}

        {isPreviewable(resolved) ? (
          <span className="absolute bottom-3 left-3 z-10 inline-flex items-center rounded-md bg-onboarding-neutral-0/95 px-2 py-1 text-[11px] font-semibold text-onboarding-ink shadow-sm dark:bg-onboarding-neutral-900/95 dark:text-onboarding-neutral-0">
            {formatCount(resolved.videosSent)} sent
          </span>
        ) : null}

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                className="absolute top-3 right-3 z-10 inline-flex size-9 items-center justify-center rounded-md bg-onboarding-neutral-0/95 text-onboarding-ink shadow-sm outline-none transition-colors hover:bg-onboarding-neutral-0 focus-visible:ring-3 focus-visible:ring-onboarding-purple-300 dark:bg-onboarding-neutral-900/95 dark:text-onboarding-neutral-0 dark:hover:bg-onboarding-neutral-900"
                aria-label="Video actions"
              />
            }
          >
            <MoreHorizontal className="size-5" aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-48">
            {isPreviewable(resolved) && canManage ? (
              <DropdownMenuItem
                disabled={pausing}
                onClick={() => {
                  void setPaused(!resolved.paused);
                }}
              >
                <Pause className="size-4" aria-hidden />
                {resolved.paused ? "Resume video sends" : "Pause video sends"}
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem render={<Link href={activityHref} />}>
              <Video className="size-4" aria-hidden />
              Open video activity
            </DropdownMenuItem>
            {resolved.videoUrl ? (
              <DropdownMenuItem onClick={() => void copyLink()}>
                <Copy className="size-4" aria-hidden />
                Copy link
              </DropdownMenuItem>
            ) : null}
            {resolved.videoUrl ? (
              <DropdownMenuItem
                render={
                  <a href={resolved.videoUrl} target="_blank" rel="noreferrer" download />
                }
              >
                <Download className="size-4" aria-hidden />
                Download
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem render={<Link href={campaignsHref} />}>
              <Replace className="size-4" aria-hidden />
              Replace video
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {isPreviewable(resolved) ? (
          <button
            type="button"
            className={cn(
              "relative z-[1] inline-flex size-12 items-center justify-center rounded-full bg-onboarding-neutral-0/95 text-onboarding-ink shadow-sm outline-none transition-transform hover:scale-105 focus-visible:ring-3 focus-visible:ring-onboarding-purple-300 dark:bg-onboarding-neutral-900/95 dark:text-onboarding-neutral-0",
              !canPlay && "opacity-70",
            )}
            aria-label={canPlay ? "Play campaign video" : "Video preview unavailable"}
            disabled={!canPlay}
            onClick={() => {
              if (canPlay) setPlayOpen(true);
            }}
          >
            <Play className="ml-1 size-5 fill-current" aria-hidden />
          </button>
        ) : isGenerating(resolved.status) ? (
          <span className="relative z-[1] flex flex-col items-center gap-1.5 text-xs font-medium text-onboarding-neutral-500 dark:text-onboarding-neutral-400">
            <Loader2 className="size-5 animate-spin text-onboarding-purple-600 dark:text-onboarding-purple-200" aria-hidden />
            Generating…
          </span>
        ) : resolved.status === "failed" || resolved.status === "rejected" || resolved.needsReview ? (
          <span className="relative z-[1] flex flex-col items-center gap-2 px-4 text-center">
            <span className="text-xs font-medium text-onboarding-neutral-600 dark:text-onboarding-neutral-400">
              {resolved.needsReview ? "Quality review required" : "Video failed"}
            </span>
            <span className="max-w-52 text-[11px] leading-4 text-onboarding-neutral-500 dark:text-onboarding-neutral-400">
              Automated checks prevented this video from being used. Retry generation before sending outreach.
            </span>
            <Button size="sm" variant="outline" disabled={retrying || !canManage} className="h-8 gap-1.5 px-2.5 text-xs" onClick={() => void retryVideo()}>
              {retrying ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <RefreshCw className="size-3.5" aria-hidden />}
              Retry generation
            </Button>
          </span>
        ) : (
          <span className="relative z-[1] flex flex-col items-center gap-2 px-4 text-center">
            <span className="text-xs font-medium text-onboarding-neutral-500 dark:text-onboarding-neutral-400">
              Video not used
            </span>
            <span className="flex flex-wrap justify-center gap-2">
              <Button
                size="sm"
                disabled={!canManage || generationMode !== null}
                className="h-8 gap-1.5 px-2.5 text-xs"
                onClick={() => void enableVideo("standardized")}
              >
                {generationMode === "standardized" ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Video className="size-3.5" aria-hidden />}
                Generate standard video
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!canManage || generationMode !== null}
                className="h-8 gap-1.5 px-2.5 text-xs"
                onClick={() => void enableVideo("personalized")}
              >
                {generationMode === "personalized" ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Video className="size-3.5" aria-hidden />}
                Generate personalized per prospect
              </Button>
            </span>
          </span>
        )}
      </AspectRatio>

      <Dialog open={playOpen} onOpenChange={setPlayOpen}>
        <DialogContent className="max-w-3xl gap-3 p-4 sm:p-5" showCloseButton>
          <DialogHeader>
            <DialogTitle>Campaign video</DialogTitle>
            <DialogDescription>
              Preview of the master outreach video for this campaign.
            </DialogDescription>
          </DialogHeader>
          {resolved.videoUrl ? (
            <video
              key={resolved.videoUrl}
              src={resolved.videoUrl}
              controls
              autoPlay
              className="aspect-video w-full overflow-hidden rounded-lg bg-black"
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
