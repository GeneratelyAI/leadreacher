import { Clapperboard } from "lucide-react";
import { OutreachMessageCard } from "./OutreachMessageCard";
import { VideoToneGrid } from "./VideoToneGrid";
import type { SetVideoConfig, VideoConfig, VideoTone } from "./types";

export function PersonalizedOutreachVariant({
  orgId,
  videoConfig,
  setVideoConfig,
}: {
  orgId: string;
  videoConfig: VideoConfig;
  setVideoConfig: SetVideoConfig;
}) {
  function selectTone(tone: VideoTone) {
    setVideoConfig({
      enabled: true,
      mode: "personalized",
      source: "generated",
      tone,
      uploadedVideoUrl: null,
    });
  }

  return (
    <div className="space-y-6">
      <OutreachMessageCard orgId={orgId} />
      <section aria-labelledby="video-tone-heading">
        <div className="flex items-center gap-2">
          <Clapperboard className="size-5 text-onboarding-purple-500" aria-hidden />
          <h2 id="video-tone-heading" className="text-base font-semibold text-onboarding-ink dark:text-onboarding-neutral-0">
            Select your preferred video style
          </h2>
        </div>
        <p className="mt-1 text-sm text-onboarding-neutral-600 dark:text-onboarding-neutral-400">
          Choose the style for videos personalized to each prospect.
        </p>
        <div className="mt-4">
          <VideoToneGrid selectedTone={videoConfig.tone} onSelect={selectTone} />
        </div>
      </section>
    </div>
  );
}
