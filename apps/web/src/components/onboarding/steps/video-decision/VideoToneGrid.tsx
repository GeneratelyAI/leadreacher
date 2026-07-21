import { Check, MessageCircle, ShieldCheck, Zap } from "lucide-react";
import type { VideoTone } from "./types";

const TONES: Array<{
  value: VideoTone;
  title: string;
  tagline: string;
  description: string;
  icon: typeof ShieldCheck;
}> = [
  {
    value: "professional",
    title: "Professional",
    tagline: "Trustworthy • Credible • Polished",
    description: "Clear, considered delivery that builds trust and confidence.",
    icon: ShieldCheck,
  },
  {
    value: "casual",
    title: "Casual",
    tagline: "Friendly • Approachable • Conversational",
    description: "Warm, relatable delivery that creates connection and feels natural.",
    icon: MessageCircle,
  },
  {
    value: "aggressive",
    title: "Aggressive",
    tagline: "Bold • High Energy • Attention Grabbing",
    description: "High-impact delivery that earns attention and drives action.",
    icon: Zap,
  },
];

export function VideoToneGrid({
  selectedTone,
  onSelect,
}: {
  selectedTone: VideoTone | null;
  onSelect: (tone: VideoTone) => void;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {TONES.map((tone) => {
        const Icon = tone.icon;
        const selected = selectedTone === tone.value;

        return (
          <button
            key={tone.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onSelect(tone.value)}
            className={`app-card app-card--interactive relative overflow-hidden p-3 text-left ${selected ? "app-card--selected" : ""}`}
          >
            <div
              className="aspect-video w-full rounded-[calc(var(--onboarding-radius)-0.25rem)] bg-onboarding-neutral-150 dark:bg-onboarding-neutral-750"
              aria-hidden
            />
            <div className="px-2 pb-2 pt-5">
            <Icon
              className="size-6 text-onboarding-purple-600 dark:text-onboarding-purple-200"
              aria-hidden
            />
            <h3 className="mt-5 text-lg font-semibold text-onboarding-ink dark:text-onboarding-neutral-0">
              {tone.title}
            </h3>
            <p className="mt-2 text-sm font-medium text-onboarding-neutral-600 dark:text-onboarding-neutral-400">
              {tone.tagline}
            </p>
            <p className="mt-5 text-sm leading-6 text-onboarding-neutral-600 dark:text-onboarding-neutral-400">
              {tone.description}
            </p>
            </div>
            {selected ? (
              <span className="onboarding-selection-mark" aria-label="Selected">
                <Check className="size-3" aria-hidden />
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
