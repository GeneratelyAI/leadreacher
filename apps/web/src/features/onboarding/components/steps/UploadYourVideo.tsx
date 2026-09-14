"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ArrowLeft, ArrowRight, FileVideo, Lock, Play, Upload, X } from "@/components/ui/icons";
import { applyStoredTheme } from "@/hooks/useThemeMode";
import { useStableReducedMotion } from "@/hooks/useStableReducedMotion";
import { apiFetch, bootstrapCurrentOrganization } from "@/lib/api";
import { navigateOnboarding, onboardingHref } from "../../public/navigation";
import { continueAfterContent } from "../../public/content-next";
import { cn } from "@/lib/utils";
import { FilePreviewIllustration } from "./CreativeIllustrations";
import mobile from "./CreativeMobile.module.css";

const MAX_VIDEO_UPLOAD_BYTES = 500 * 1024 * 1024;
const ACCEPTED_VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"];
const ACCEPTED_VIDEO_EXTENSIONS = [".mp4", ".mov", ".webm"];

type UploadedVideo = {
  name: string;
  size?: number;
  duration?: string;
  previewUrl: string;
  assetUrl?: string;
  assetId?: string;
  fixture?: boolean;
};

type UploadResponse = {
  videoConfig?: {
    uploadedVideoUrl?: unknown;
    uploadedVideoId?: unknown;
    uploadedVideoName?: unknown;
    uploadedVideoSize?: unknown;
  };
};

function ExpandableVideoPreview({ video }: { video: UploadedVideo }) {
  const [expanded, setExpanded] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const thumbnailRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const minimizeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const originRef = useRef<DOMRect | null>(null);
  const reducedMotion = useStableReducedMotion();
  const storyAsset = video.assetId ? `media:${video.assetId}` : video.assetUrl ? `media:${video.assetUrl}` : undefined;

  useEffect(() => {
    if (!expanded || !dialogRef.current || !playerRef.current || !originRef.current) return;
    const dialog = dialogRef.current;
    const player = playerRef.current;
    dialog.showModal();
    const target = player.getBoundingClientRect();
    const origin = originRef.current;
    const from = `translate(${origin.x - target.x}px, ${origin.y - target.y}px) scale(${origin.width / target.width}, ${origin.height / target.height})`;
    const animation = player.animate([
      { transform: reducedMotion ? "none" : from, opacity: 0.75, borderRadius: "10px" },
      { transform: "none", opacity: 1, borderRadius: "14px" },
    ], { duration: reducedMotion ? 60 : 240, easing: "cubic-bezier(.2, .8, .2, 1)" });
    let cancelled = false;
    void animation.finished.then(async () => {
      if (cancelled) return;
      setReady(true);
      minimizeRef.current?.focus({ preventScroll: true });
      try {
        await videoRef.current?.play();
      } catch {
        if (!cancelled) setFailed(true);
      }
    }).catch(() => {});
    return () => {
      cancelled = true;
      animation.cancel();
    };
  }, [expanded, reducedMotion]);

  async function minimize() {
    const player = playerRef.current;
    const thumbnail = thumbnailRef.current;
    videoRef.current?.pause();
    if (player && thumbnail) {
      const from = player.getBoundingClientRect();
      const target = thumbnail.getBoundingClientRect();
      const animation = player.animate([
        { transform: "none", opacity: 1 },
        { transform: reducedMotion ? "none" : `translate(${target.x - from.x}px, ${target.y - from.y}px) scale(${target.width / from.width}, ${target.height / from.height})`, opacity: 0.75 },
      ], { duration: reducedMotion ? 60 : 220, easing: "ease-in-out", fill: "forwards" });
      await animation.finished.catch(() => {});
      animation.cancel();
    }
    dialogRef.current?.close();
    setReady(false);
    setExpanded(false);
    requestAnimationFrame(() => triggerRef.current?.focus({ preventScroll: true }));
  }

  return <>
    <div ref={thumbnailRef} className="upload-your-video-thumbnail" data-story-object={storyAsset ? "media" : undefined} data-story-asset={storyAsset} data-story-source={storyAsset ? "uploaded-video" : undefined}>
      <video data-story-visual="true" className="upload-your-video-preview" src={video.previewUrl} muted preload="auto" playsInline aria-hidden tabIndex={-1} onLoadedData={(event) => { if (event.currentTarget.duration > .05 && event.currentTarget.currentTime < .01) event.currentTarget.currentTime = .05; }} />
      <button ref={triggerRef} className="upload-your-video-expand" type="button" onClick={() => {
        originRef.current = thumbnailRef.current?.getBoundingClientRect() ?? null;
        setFailed(false);
        setExpanded(true);
      }} aria-label={`Play ${video.name}`}>
        <span aria-hidden><Play weight="fill" /></span>
      </button>
    </div>
    <dialog ref={dialogRef} className="upload-your-video-dialog" aria-label={`Video preview for ${video.name}`} onCancel={(event) => {
      event.preventDefault();
      void minimize();
    }}>
      <div ref={playerRef} className="upload-your-video-expanded-player">
        <video ref={videoRef} src={video.previewUrl} controls={ready} preload="metadata" playsInline aria-label={`Preview of ${video.name}`} />
        <button ref={minimizeRef} type="button" className="upload-your-video-minimize" onClick={() => void minimize()}>Minimize</button>
        {failed ? <p role="alert" className="upload-your-video-playback-error">Playback could not start. Use the video controls to retry.</p> : null}
      </div>
    </dialog>
  </>;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes >= 100 * 1024 * 1024 ? 0 : 1).replace(/\.0$/, "")} MB`;
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const rounded = Math.floor(seconds);
  const minutes = Math.floor(rounded / 60);
  const remainingSeconds = `${rounded % 60}`.padStart(2, "0");
  return `${minutes}:${remainingSeconds}`;
}

function getVideoDuration(source: string): Promise<string> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    let settled = false;
    const finish = (duration = "0:00") => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      video.onloadedmetadata = null;
      video.onerror = null;
      video.removeAttribute("src");
      video.load();
      resolve(duration);
    };
    video.preload = "metadata";
    video.onloadedmetadata = () => finish(formatDuration(video.duration));
    video.onerror = () => finish();
    const timeout = setTimeout(() => finish(), 10_000);
    video.src = source;
  });
}

export default function UploadYourVideo({ preview = false, selectedFileFixture = false }: { preview?: boolean; selectedFileFixture?: boolean }) {
  useLayoutEffect(() => applyStoredTheme(), []);

  const inputRef = useRef<HTMLInputElement>(null);
  const browseRef = useRef<HTMLButtonElement>(null);
  const previewUrlRef = useRef<string | null>(null);
  const uploadAbortRef = useRef<AbortController | null>(null);
  const removalRequestedRef = useRef(false);
  const [selectedVideo, setSelectedVideo] = useState<UploadedVideo | null>(() => preview && selectedFileFixture ? {
    name: "Acme-product-introduction.mp4",
    size: 18 * 1024 * 1024,
    duration: "0:30",
    previewUrl: "/landing/product-story/personalized-video-outreach.mp4",
    assetUrl: "/landing/product-story/personalized-video-outreach.mp4",
    assetId: "preview-uploaded-video",
    fixture: true,
  } : null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [approved, setApproved] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (selectedVideo || removalRequestedRef.current) return;
    let cancelled = false;
    void (async () => {
      try {
        const { orgId } = await bootstrapCurrentOrganization();
        const strategy = await apiFetch<UploadResponse>(`/strategy/${orgId}`);
        const url = strategy.videoConfig?.uploadedVideoUrl;
        if (cancelled || typeof url !== "string" || !url.trim()) return;
        const savedName = strategy.videoConfig?.uploadedVideoName;
        const savedSize = strategy.videoConfig?.uploadedVideoSize;
        setSelectedVideo({
          name: typeof savedName === "string" && savedName.trim() ? savedName : "Uploaded campaign video",
          size: typeof savedSize === "number" && savedSize >= 0 ? savedSize : undefined,
          previewUrl: url,
          assetUrl: url,
          assetId: typeof strategy.videoConfig?.uploadedVideoId === "string" && strategy.videoConfig.uploadedVideoId.trim() ? strategy.videoConfig.uploadedVideoId : undefined,
        });
      } catch {
        // The upload surface remains available when no persisted asset can be restored.
      }
    })();
    return () => { cancelled = true; };
  }, [selectedVideo]);

  useEffect(() => () => {
    uploadAbortRef.current?.abort();
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
  }, []);

  async function clearSelection() {
    const video = selectedVideo;
    if (!video || approved || isRemoving) return;
    uploadAbortRef.current?.abort();
    uploadAbortRef.current = null;
    setIsUploading(false);
    removalRequestedRef.current = true;
    setSelectedVideo(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
    requestAnimationFrame(() => browseRef.current?.focus({ preventScroll: true }));
    setIsRemoving(true);
    try {
      const { orgId } = await bootstrapCurrentOrganization();
      await apiFetch(`/strategy/${orgId}/video-decision`, {
        method: "PATCH",
        body: JSON.stringify({ enabled: false, mode: null, source: null, tone: null, uploadedVideoUrl: null }),
      });
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    } catch (cause) {
      removalRequestedRef.current = false;
      setSelectedVideo(video);
      setError(cause instanceof Error ? cause.message : "Unable to remove your video. Please try again.");
    } finally {
      setIsRemoving(false);
    }
  }

  async function uploadFile(file: File | undefined) {
    if (!file || isUploading || approved) return;

    removalRequestedRef.current = false;

    const hasAcceptedExtension = ACCEPTED_VIDEO_EXTENSIONS.some((extension) =>
      file.name.toLowerCase().endsWith(extension),
    );
    if (!ACCEPTED_VIDEO_TYPES.includes(file.type) && !hasAcceptedExtension) {
      setError("Choose an MP4, MOV, or WebM video file.");
      return;
    }
    if (file.size > MAX_VIDEO_UPLOAD_BYTES) {
      setError("Video uploads must be 500 MB or smaller.");
      return;
    }

    setIsUploading(true);
    setError(null);
    const previewUrl = URL.createObjectURL(file);
    const controller = new AbortController();
    uploadAbortRef.current = controller;
    try {
      const [bootstrap, duration] = await Promise.all([
        bootstrapCurrentOrganization(),
        getVideoDuration(previewUrl),
      ]);
      if (controller.signal.aborted) {
        URL.revokeObjectURL(previewUrl);
        return;
      }
      const formData = new FormData();
      formData.append("video", file, file.name);
      const strategy = await apiFetch<UploadResponse>(
        `/strategy/${bootstrap.orgId}/video-upload`,
        { method: "POST", body: formData, signal: controller.signal },
      );
      if (typeof strategy.videoConfig?.uploadedVideoUrl !== "string" || !strategy.videoConfig.uploadedVideoUrl.trim()) {
        throw new Error("The uploaded video could not be confirmed.");
      }

      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = previewUrl;
      setSelectedVideo({
        name: file.name,
        size: file.size,
        duration,
        previewUrl,
        assetUrl: strategy.videoConfig.uploadedVideoUrl,
        assetId: typeof strategy.videoConfig.uploadedVideoId === "string" && strategy.videoConfig.uploadedVideoId.trim() ? strategy.videoConfig.uploadedVideoId : undefined,
      });
    } catch (uploadError) {
      URL.revokeObjectURL(previewUrl);
      if (!controller.signal.aborted) setError(uploadError instanceof Error ? uploadError.message : "Unable to upload your video.");
    } finally {
      if (uploadAbortRef.current === controller && !controller.signal.aborted) {
        uploadAbortRef.current = null;
        setIsUploading(false);
        if (inputRef.current) inputRef.current.value = "";
      }
    }
  }

  return (
    <section className={cn("upload-your-video-page", mobile.page)}>
      <main className="upload-your-video-main" aria-labelledby="upload-your-video-title">
        <header className="upload-your-video-header">
          <h1 id="upload-your-video-title">
            <span className={mobile.desktopOnly}>Upload your video<span className="signup-campaign-period">.</span></span>
            <span className={mobile.mobileOnly}>Put your video to work<span className="signup-campaign-period">.</span></span>
          </h1>
          <p><span className={mobile.desktopOnly}>Add the video you want to send prospects.</span><span className={mobile.mobileOnly}>Add the creative you already have.</span></p>
        </header>

        <input
          ref={inputRef}
          type="file"
          accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(event) => void uploadFile(event.target.files?.[0])}
        />

        <section className="upload-your-video-section" aria-label="Campaign video upload">
          {selectedVideo ? (
            <div className="upload-your-video-selected">
              {selectedVideo.previewUrl ? <ExpandableVideoPreview video={selectedVideo} /> : <div className={mobile.filePreview} aria-label="Sample selected video, preview unavailable"><FilePreviewIllustration /></div>}
              <div className="upload-your-video-file-details">
                <FileVideo className="upload-your-video-file-icon" weight="fill" aria-hidden />
                <div>
                  <p>{selectedVideo.name}</p>
                  <span>{[selectedVideo.duration, selectedVideo.name.includes(".") ? selectedVideo.name.split(".").pop()?.toUpperCase() : undefined, selectedVideo.size === undefined ? undefined : formatBytes(selectedVideo.size)].filter(Boolean).join(" · ") || "Saved campaign asset"}</span>
                </div>
                <Button type="button" variant="secondary" className="upload-your-video-remove" disabled={approved || isRemoving} onClick={() => void clearSelection()}>
                  <X className="size-4" aria-hidden />
                  Remove
                </Button>
              </div>
              <Button type="button" variant="secondary" className={mobile.fileReplace} disabled={isUploading || approved} onClick={() => inputRef.current?.click()}><Upload className="size-4" aria-hidden />Choose another video</Button>
              <p className={mobile.filePrivacy}><Lock aria-hidden />{selectedVideo.fixture ? "Sample file for this preview. No video has been uploaded." : "Uploading a video does not send it to prospects."}</p>
            </div>
          ) : (
            <div
              className="upload-your-video-drop-zone"
              onDragEnter={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={(event) => {
                if (event.currentTarget === event.target) setIsDragging(false);
              }}
              onDrop={(event) => {
                event.preventDefault();
                setIsDragging(false);
                void uploadFile(event.dataTransfer.files[0]);
              }}
              data-dragging={isDragging || undefined}
              aria-busy={isUploading}
            >
              <span className="upload-your-video-icon" data-story-object="content:upload" aria-hidden>
                <Upload className="size-10" weight="bold" />
              </span>
              <p>{isUploading ? "Uploading your video" : "Drag and drop your video here"}</p>
              <span>or</span>
              <Button ref={browseRef} type="button" variant="secondary" className="upload-your-video-browse" disabled={isUploading || isRemoving} onClick={() => inputRef.current?.click()}>
                Browse files
              </Button>
            </div>
          )}
          <p className="upload-your-video-helper">MP4, MOV, or WebM. Up to 500 MB.</p>
          {error ? <p className="upload-your-video-error" role="alert">{error}</p> : null}
        </section>
      </main>

      <div className="upload-your-video-actions">
        <Button type="button" variant="secondary" className="campaign-content-back" onClick={() => navigateOnboarding(onboardingHref("campaign-content"))}>
          <ArrowLeft className="size-5" aria-hidden />
          Back
        </Button>
        <Button type="button" className="onboarding-campaign-next" disabled={!selectedVideo || isUploading || approved} onClick={async () => {
          setApproved(true);
          try {
            const { orgId } = await bootstrapCurrentOrganization();
            await apiFetch(`/strategy/${orgId}/content-approval`, { method: "PATCH", body: JSON.stringify({ type: "Your video" }) });
            continueAfterContent();
          } catch (caught) {
            setApproved(false);
            setError(caught instanceof Error ? caught.message : "Unable to save your content selection. Please try again.");
          }
        }}>
          <span className={mobile.desktopOnly}>Continue</span><span className={mobile.mobileOnly}>Use this video</span>
          <ArrowRight className="size-5" aria-hidden />
        </Button>
      </div>

    </section>
  );
}
