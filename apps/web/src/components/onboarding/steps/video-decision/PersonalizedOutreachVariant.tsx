import { Check, MessageCircle, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { OnboardingCard } from "@/components/onboarding/OnboardingCard";
import type { SetVideoConfig, VideoConfig, VideoTone } from "./types";

const TONES: Array<{
  value: VideoTone;
  title: string;
  description: string;
  icon: typeof ShieldCheck;
}> = [
  {
    value: "professional",
    title: "Professional",
    description: "Clear, credible, and polished for executive conversations.",
    icon: ShieldCheck,
  },
  {
    value: "casual",
    title: "Casual",
    description: "Warm and approachable while staying focused on the buyer.",
    icon: MessageCircle,
  },
  {
    value: "aggressive",
    title: "Aggressive",
    description: "Direct, high-energy, and built to earn immediate attention.",
    icon: Zap,
  },
];

export function PersonalizedOutreachVariant({
  videoConfig,
  setVideoConfig,
}: {
  videoConfig: VideoConfig;
  setVideoConfig: SetVideoConfig;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-onboarding-ink dark:text-onboarding-neutral-0">
          Select your video tone
        </h2>
        <p className="mt-1 text-sm text-onboarding-neutral-600 dark:text-onboarding-neutral-400">
          We will use this style when creating personalized videos for each prospect.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {TONES.map((tone) => {
          const Icon = tone.icon;
          const selected = videoConfig.tone === tone.value;

          return (
            <button
              key={tone.value}
              type="button"
              aria-pressed={selected}
              onClick={() =>
                setVideoConfig({
                  enabled: true,
                  mode: "personalized",
                  source: "generated",
                  tone: tone.value,
                  uploadedVideoUrl: null,
                })
              }
              className={`app-card app-card--interactive relative p-5 text-left ${selected ? "app-card--selected" : ""}`}
            >
              <Icon
                className="size-6 text-onboarding-purple-600 dark:text-onboarding-purple-200"
                aria-hidden
              />
              <h3 className="mt-5 text-lg font-semibold text-onboarding-ink dark:text-onboarding-neutral-0">
                {tone.title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-onboarding-neutral-600 dark:text-onboarding-neutral-400">
                {tone.description}
              </p>
              {selected ? (
                <span className="onboarding-selection-mark" aria-label="Selected">
                  <Check className="size-3" aria-hidden />
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <OnboardingCard muted className="px-5 py-5">
        <div className="flex items-start gap-3">
          <Sparkles
            className="mt-0.5 size-5 shrink-0 text-onboarding-purple-500 dark:text-onboarding-purple-200"
            aria-hidden
          />
          <div>
            <h3 className="text-sm font-semibold text-onboarding-ink dark:text-onboarding-neutral-0">
              Personalized for every prospect
            </h3>
            <p className="mt-1 text-sm leading-6 text-onboarding-neutral-600 dark:text-onboarding-neutral-400">
              LeadReacher will tailor the message and AI-generated video to each
              prospect after your campaign strategy is ready.
            </p>
          </div>
        </div>
      </OnboardingCard>
    </div>
  );
}
