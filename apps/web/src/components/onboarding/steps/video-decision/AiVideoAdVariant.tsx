import { Clapperboard, Image as ImageIcon, Sparkles, Upload } from "lucide-react";
import { OnboardingCard } from "@/components/onboarding/OnboardingCard";
import type { SetVideoConfig, VideoConfig, VideoSource } from "./types";

const STORYBOARD = [
  { title: "Hook", time: "0-2s", detail: "Open with a relevant moment." },
  { title: "Problem", time: "2-4s", detail: "Name the challenge your buyer sees." },
  { title: "Solution", time: "4-6s", detail: "Show the value LeadReacher creates." },
  { title: "Payoff", time: "6-8s", detail: "Finish with a clear next action and branded end card." },
] as const;

export function AiVideoAdVariant({
  videoConfig,
  setVideoConfig,
}: {
  videoConfig: VideoConfig;
  setVideoConfig: SetVideoConfig;
}) {
  function selectSource(source: VideoSource) {
    setVideoConfig((current) => ({
      ...current,
      enabled: true,
      mode: "standardized",
      source,
      tone: null,
      uploadedVideoUrl: source === "uploaded" ? current.uploadedVideoUrl : null,
    }));
  }

  return (
    <div className="space-y-6">
      <OnboardingCard className="px-5 py-5">
        <div className="flex items-start gap-3">
          {videoConfig.source === "uploaded" ? (
            <Upload className="mt-0.5 size-5 shrink-0 text-onboarding-purple-500 dark:text-onboarding-purple-200" />
          ) : (
            <ImageIcon className="mt-0.5 size-5 shrink-0 text-onboarding-purple-500 dark:text-onboarding-purple-200" />
          )}
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-onboarding-ink dark:text-onboarding-neutral-0">
              Choose your visual source
            </h2>
            <p className="mt-1 text-sm text-onboarding-neutral-600 dark:text-onboarding-neutral-400">
              Your ad uses one standardized video across the campaign.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {(["generated", "uploaded"] as const).map((source) => {
                const selected = videoConfig.source === source;
                return (
                  <button
                    key={source}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => selectSource(source)}
                    className={`onboarding-choice-row ${selected ? "onboarding-choice-row--selected" : ""}`}
                  >
                    {source === "generated"
                      ? "AI-generated visuals"
                      : "Use uploaded visuals"}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </OnboardingCard>

      <OnboardingCard className="px-5 py-5">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-onboarding-purple-500" aria-hidden />
          <h2 className="text-base font-semibold text-onboarding-ink dark:text-onboarding-neutral-0">
            Storyboard preview
          </h2>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {STORYBOARD.map((scene) => (
            <article key={scene.title} className="onboarding-storyboard-card">
              <span className="onboarding-storyboard-card__visual" aria-hidden />
              <span className="mt-3 flex items-center justify-between text-xs text-onboarding-neutral-500 dark:text-onboarding-neutral-400">
                <span>{scene.time}</span>
                <Clapperboard className="size-3" />
              </span>
              <h3 className="mt-2 text-sm font-semibold text-onboarding-ink dark:text-onboarding-neutral-0">
                {scene.title}
              </h3>
              <p className="mt-1 text-xs leading-5 text-onboarding-neutral-600 dark:text-onboarding-neutral-400">
                {scene.detail}
              </p>
            </article>
          ))}
        </div>
        <p className="mt-4 text-xs text-onboarding-neutral-500 dark:text-onboarding-neutral-400">
          Each video ends with a two-second branded hold for a ten-second final runtime.
        </p>
      </OnboardingCard>
    </div>
  );
}
