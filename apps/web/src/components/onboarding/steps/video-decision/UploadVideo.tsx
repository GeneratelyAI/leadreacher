import { FileVideo, Loader2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { OnboardingCard } from "@/components/onboarding/OnboardingCard";
import { Button } from "@/components/ui/Button";
import { apiFetch } from "@/lib/api";
import type { SetVideoConfig, VideoConfig } from "./types";

const MAX_VIDEO_UPLOAD_BYTES = 200 * 1024 * 1024;
const ACCEPTED_VIDEO_TYPES = ["video/mp4", "video/quicktime"];
const ACCEPTED_VIDEO_EXTENSIONS = [".mp4", ".mov"];

type UploadResponse = {
  videoConfig?: {
    uploadedVideoUrl?: unknown;
  };
};

export function UploadVideo({
  orgId,
  videoConfig,
  setVideoConfig,
  onError,
}: {
  orgId: string;
  videoConfig: VideoConfig;
  setVideoConfig: SetVideoConfig;
  onError: (message: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  async function uploadFile(file: File | undefined) {
    if (!file || isUploading) return;

    const hasAcceptedExtension = ACCEPTED_VIDEO_EXTENSIONS.some((extension) =>
      file.name.toLowerCase().endsWith(extension),
    );
    if (!ACCEPTED_VIDEO_TYPES.includes(file.type) && !hasAcceptedExtension) {
      onError("Upload an MP4 or MOV video file.");
      return;
    }
    if (file.size > MAX_VIDEO_UPLOAD_BYTES) {
      onError("Video uploads must be 200MB or smaller.");
      return;
    }

    setIsUploading(true);
    onError(null);
    try {
      const formData = new FormData();
      formData.append("video", file, file.name);
      const strategy = await apiFetch<UploadResponse>(
        `/strategy/${orgId}/video-upload`,
        {
          method: "POST",
          body: formData,
        },
      );
      const uploadedVideoUrl = strategy.videoConfig?.uploadedVideoUrl;
      if (typeof uploadedVideoUrl !== "string" || uploadedVideoUrl.length === 0) {
        throw new Error("The uploaded video URL was not returned.");
      }

      setVideoConfig({
        enabled: true,
        mode: null,
        source: "uploaded",
        tone: null,
        uploadedVideoUrl,
      });
    } catch (uploadError) {
      onError(
        uploadError instanceof Error
          ? uploadError.message
          : "Unable to upload your video.",
      );
    } finally {
      setIsUploading(false);
    }
  }

  function openFilePicker() {
    inputRef.current?.click();
  }

  if (videoConfig.uploadedVideoUrl) {
    return (
      <OnboardingCard className="overflow-hidden p-0">
        <video
          controls
          preload="metadata"
          aria-label="Uploaded campaign video preview"
          src={videoConfig.uploadedVideoUrl}
          className="aspect-video w-full bg-onboarding-neutral-950 object-contain"
        >
          Your browser does not support video playback.
        </video>
        <div className="flex flex-col gap-3 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <FileVideo
              className="mt-0.5 size-5 shrink-0 text-onboarding-purple-500 dark:text-onboarding-purple-200"
              aria-hidden
            />
            <div>
              <h2 className="text-base font-semibold text-onboarding-ink dark:text-onboarding-neutral-0">
                Video ready
              </h2>
              <p className="mt-1 text-sm text-onboarding-neutral-600 dark:text-onboarding-neutral-400">
                This video will be used across your campaign.
              </p>
            </div>
          </div>
          <Button type="button" variant="secondary" onClick={openFilePicker}>
            Replace video
          </Button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="video/mp4,video/quicktime,.mp4,.mov"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(event) => {
            void uploadFile(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      </OnboardingCard>
    );
  }

  return (
    <OnboardingCard className="p-5">
      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/quicktime,.mp4,.mov"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(event) => {
          void uploadFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={openFilePicker}
        onDragEnter={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          void uploadFile(event.dataTransfer.files[0]);
        }}
        disabled={isUploading}
        aria-label={isUploading ? "Uploading campaign video" : "Upload campaign video"}
        className={`flex min-h-64 w-full flex-col items-center justify-center rounded-onboarding border border-dashed px-6 text-center transition-colors ${
          isDragging
            ? "border-onboarding-purple-500 bg-onboarding-purple-50 dark:bg-onboarding-purple-900/20"
            : "border-onboarding-neutral-300 hover:border-onboarding-purple-400 dark:border-onboarding-neutral-700"
        } disabled:cursor-wait`}
      >
        {isUploading ? (
          <Loader2 className="size-8 animate-spin text-onboarding-purple-500" aria-hidden />
        ) : (
          <Upload className="size-8 text-onboarding-purple-500" aria-hidden />
        )}
        <span className="mt-4 text-base font-semibold text-onboarding-ink dark:text-onboarding-neutral-0">
          {isUploading ? "Uploading your video" : "Upload your campaign video"}
        </span>
        <span className="mt-2 max-w-md text-sm leading-6 text-onboarding-neutral-600 dark:text-onboarding-neutral-400">
          {isUploading
            ? "Your video is uploading securely. Keep this page open until it is ready."
            : "Drag and drop an MP4 or MOV file here, or click to browse. Maximum file size: 200MB."}
        </span>
      </button>
    </OnboardingCard>
  );
}
