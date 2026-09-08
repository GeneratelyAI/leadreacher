"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createLiveCampaignSummary } from "@/components/onboarding/campaign-summary";
import { OnboardingLogo } from "@/components/onboarding/OnboardingLogo";
import { Pill } from "@/components/onboarding/Pill";
import { Button } from "@/components/ui/Button";
import { ArrowLeft, ArrowRight, FileVideo, Upload, X } from "@/components/ui/icons";
import { useWebsiteScrapeStatus } from "@/hooks/useWebsiteScrapeStatus";
import { applyStoredTheme } from "@/hooks/useThemeMode";
import { apiFetch, bootstrapCurrentOrganization } from "@/lib/api";
import { navigateOnboarding, onboardingHref } from "./steps";

const MAX_VIDEO_UPLOAD_BYTES = 500 * 1024 * 1024;
const ACCEPTED_VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"];
const ACCEPTED_VIDEO_EXTENSIONS = [".mp4", ".mov", ".webm"];

type UploadedVideo = {
  name: string;
  size: number;
  duration: string;
  previewUrl: string;
};

type UploadResponse = {
  videoConfig?: {
    uploadedVideoUrl?: unknown;
  };
};

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes >= 100 * 1024 * 1024 ? 0 : 1)} MB`;
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
    const finish = (duration = "0:00") => {
      video.removeAttribute("src");
      video.load();
      resolve(duration);
    };
    video.preload = "metadata";
    video.onloadedmetadata = () => finish(formatDuration(video.duration));
    video.onerror = () => finish();
    video.src = source;
  });
}

export default function UploadYourVideo() {
  useLayoutEffect(() => applyStoredTheme(), []);

  const inputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<UploadedVideo | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [approved, setApproved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { status, websiteUrl } = useWebsiteScrapeStatus({ context: "authenticated" });
  const campaign = useMemo(
    () => createLiveCampaignSummary(
      status,
      "chosen-content",
      { type: "Your video" },
      websiteUrl,
    ),
    [status, websiteUrl],
  );

  useEffect(() => () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
  }, []);

  function clearSelection() {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
    setSelectedVideo(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function uploadFile(file: File | undefined) {
    if (!file || isUploading) return;

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
    try {
      const [bootstrap, duration] = await Promise.all([
        bootstrapCurrentOrganization(),
        getVideoDuration(previewUrl),
      ]);
      const formData = new FormData();
      formData.append("video", file, file.name);
      const strategy = await apiFetch<UploadResponse>(
        `/strategy/${bootstrap.orgId}/video-upload`,
        { method: "POST", body: formData },
      );
      if (typeof strategy.videoConfig?.uploadedVideoUrl !== "string") {
        throw new Error("The uploaded video could not be confirmed.");
      }

      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = previewUrl;
      setSelectedVideo({
        name: file.name,
        size: file.size,
        duration,
        previewUrl,
      });
    } catch (uploadError) {
      URL.revokeObjectURL(previewUrl);
      setError(uploadError instanceof Error ? uploadError.message : "Unable to upload your video.");
    } finally {
      setIsUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <section className="upload-your-video-page">
      <Link href="/" aria-label="LeadReacher home" className="onboarding-brand-anchor inline-flex">
        <OnboardingLogo className="landing-navbar-logo onboarding-brand-wordmark" />
      </Link>

      <main className="upload-your-video-main" aria-labelledby="upload-your-video-title">
        <header className="upload-your-video-header">
          <h1 id="upload-your-video-title">
            Upload your video<span className="signup-campaign-period">.</span>
          </h1>
          <p>Add the video you want to send prospects.</p>
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
              <video
                className="upload-your-video-preview"
                controls
                preload="metadata"
                src={selectedVideo.previewUrl}
                aria-label={`Preview of ${selectedVideo.name}`}
              >
                Your browser does not support video playback.
              </video>
              <div className="upload-your-video-file-details">
                <FileVideo className="upload-your-video-file-icon" weight="fill" aria-hidden />
                <div>
                  <p>{selectedVideo.name}</p>
                  <span>{selectedVideo.duration} · {formatBytes(selectedVideo.size)}</span>
                </div>
                <Button type="button" variant="secondary" className="upload-your-video-remove" onClick={clearSelection}>
                  <X className="size-4" aria-hidden />
                  Remove
                </Button>
              </div>
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
              <span className="upload-your-video-icon" aria-hidden>
                <Upload className="size-10" weight="bold" />
              </span>
              <p>{isUploading ? "Uploading your video" : "Drag and drop your video here"}</p>
              <span>or</span>
              <Button type="button" variant="secondary" className="upload-your-video-browse" disabled={isUploading} onClick={() => inputRef.current?.click()}>
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
            navigateOnboarding(onboardingHref("checkout"));
          } catch (caught) {
            setApproved(false);
            setError(caught instanceof Error ? caught.message : "Unable to save your content selection. Please try again.");
          }
        }}>
          Continue
          <ArrowRight className="size-5" aria-hidden />
        </Button>
      </div>

      <aside className="signup-campaign-pill-column" aria-label="Live campaign summary">
        <Pill campaign={campaign} className="signup-campaign-pill" />
      </aside>
    </section>
  );
}
