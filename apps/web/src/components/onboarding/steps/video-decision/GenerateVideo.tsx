import { VideoToneGrid } from "./VideoToneGrid";
import type { SetVideoConfig, VideoConfig, VideoTone } from "./types";

export function GenerateVideo({
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
        <h2 id="video-style-heading" className="text-3xl font-bold tracking-tight text-onboarding-ink sm:text-4xl dark:text-onboarding-neutral-0">
          Select your preferred video style
        </h2>
        <p className="mt-4 max-w-xl text-base leading-7 text-onboarding-neutral-600 dark:text-onboarding-neutral-400">
          Choose the tone for the one AI-generated video delivered to your selected prospects.
        </p>
      </div>
      <div className="mt-9">
        <VideoToneGrid selectedTone={videoConfig.tone} onSelect={selectTone} />
      </div>
    </section>
  );
}
