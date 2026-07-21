import { Clapperboard } from "lucide-react";
import { HeroBadge } from "@/components/onboarding/HeroBadge";
import { VideoToneGrid } from "./VideoToneGrid";
import type { SetVideoConfig, VideoConfig, VideoTone } from "./types";

export function AiVideoAdVariant({
  videoConfig,
  setVideoConfig,
}: {
  videoConfig: VideoConfig;
  setVideoConfig: SetVideoConfig;
}) {
  function selectTone(tone: VideoTone) {
    setVideoConfig({
      enabled: true,
      mode: "standardized",
      source: "generated",
      tone,
      uploadedVideoUrl: null,
    });
  }

  return (
    <section aria-labelledby="video-style-heading">
      <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
        <HeroBadge icon={<Clapperboard className="size-7" />} />
        <h2 id="video-style-heading" className="mt-5 text-3xl font-bold tracking-tight text-onboarding-ink sm:text-4xl dark:text-onboarding-neutral-0">
          Select your preferred video style
        </h2>
        <p className="mt-4 max-w-xl text-base leading-7 text-onboarding-neutral-600 dark:text-onboarding-neutral-400">
          Choose the tone that best fits your message and audience.
        </p>
      </div>
      <div className="mt-9">
        <VideoToneGrid selectedTone={videoConfig.tone} onSelect={selectTone} />
      </div>
    </section>
  );
}
