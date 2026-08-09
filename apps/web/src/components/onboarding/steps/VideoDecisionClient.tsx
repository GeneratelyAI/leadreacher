"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Clapperboard, Loader2 } from "lucide-react";
import { useEffect, useLayoutEffect, useState } from "react";
import { HeroBadge } from "@/components/onboarding/HeroBadge";
import { OnboardingCard } from "@/components/onboarding/OnboardingCard";
import { OnboardingChrome } from "@/components/onboarding/OnboardingChrome";
import { Button } from "@/components/ui/Button";
import { applyStoredTheme } from "@/hooks/useThemeMode";
import { apiFetch, bootstrapOrganization } from "@/lib/api";
import { onboardingHref } from "./steps";
import { AiVideoAdVariant } from "./video-decision/AiVideoAdVariant";
import { PersonalizedOutreachVariant } from "./video-decision/PersonalizedOutreachVariant";
import { UploadedVideoVariant } from "./video-decision/UploadedVideoVariant";
import type { CampaignType, VideoConfig } from "./video-decision/types";

type StrategyResponse = {
  campaignType?: unknown;
  videoConfig?: unknown;
};

const HERO_COPY: Record<CampaignType, { title: string; description: string }> = {
  personalized_outreach: {
    title: "Choose your video tone",
    description: "Set the style we use for videos personalized to each prospect.",
  },
  ai_video_ad: {
    title: "Shape your video ad",
    description: "Choose the visual direction for one standardized campaign video.",
  },
  uploaded_video: {
    title: "Upload your campaign video",
    description: "Use your existing video across this campaign.",
  },
};

function disabledVideoConfig(): VideoConfig {
  return {
    enabled: false,
    mode: null,
    source: null,
    tone: null,
    uploadedVideoUrl: null,
  };
}

function isCampaignType(value: unknown): value is CampaignType {
  return (
    value === "personalized_outreach" ||
    value === "ai_video_ad" ||
    value === "uploaded_video"
  );
}

function parseVideoConfig(value: unknown, campaignType: CampaignType): VideoConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return defaultEnabledVideoConfig(campaignType);
  }

  const config = value as Record<string, unknown>;
  if (config.enabled !== true) {
    return disabledVideoConfig();
  }

  const uploadedVideoUrl =
    typeof config.uploadedVideoUrl === "string" ? config.uploadedVideoUrl : null;

  if (campaignType === "personalized_outreach") {
    return {
      enabled: true,
      mode: "personalized",
      source: "generated",
      tone:
        config.tone === "professional" ||
        config.tone === "casual" ||
        config.tone === "aggressive"
          ? config.tone
          : null,
      uploadedVideoUrl: null,
    };
  }

  if (campaignType === "ai_video_ad") {
    return {
      enabled: true,
      mode: "standardized",
      source: "generated",
      tone:
        config.tone === "professional" ||
        config.tone === "casual" ||
        config.tone === "aggressive"
          ? config.tone
          : null,
      uploadedVideoUrl: null,
    };
  }

  return {
    enabled: true,
    mode: null,
    source: uploadedVideoUrl ? "uploaded" : null,
    tone: null,
    uploadedVideoUrl,
  };
}

function defaultEnabledVideoConfig(campaignType: CampaignType): VideoConfig {
  if (campaignType === "personalized_outreach") {
    return {
      enabled: true,
      mode: "personalized",
      source: "generated",
      tone: null,
      uploadedVideoUrl: null,
    };
  }

  if (campaignType === "ai_video_ad") {
    return {
      enabled: true,
      mode: "standardized",
      source: "generated",
      tone: null,
      uploadedVideoUrl: null,
    };
  }

  return {
    enabled: true,
    mode: null,
    source: null,
    tone: null,
    uploadedVideoUrl: null,
  };
}

function canContinueWith(campaignType: CampaignType, videoConfig: VideoConfig): boolean {
  if (!videoConfig.enabled) return true;
  if (campaignType === "personalized_outreach") return videoConfig.tone !== null;
  if (campaignType === "ai_video_ad") return videoConfig.tone !== null;
  return videoConfig.uploadedVideoUrl !== null;
}

export default function VideoDecisionClient() {
  useLayoutEffect(() => {
    applyStoredTheme();
  }, []);

  const router = useRouter();
  const [orgId, setOrgId] = useState<string | null>(null);
  const [campaignType, setCampaignType] = useState<CampaignType | null>(null);
  const [videoConfig, setVideoConfig] = useState<VideoConfig>(disabledVideoConfig);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadVideoDecision() {
      try {
        const bootstrap = await bootstrapOrganization("LeadReacher");
        const strategy = await apiFetch<StrategyResponse>(
          `/strategy/${bootstrap.orgId}`,
        );
        if (cancelled) return;

        if (!isCampaignType(strategy.campaignType)) {
          router.push(onboardingHref("campaign-type"));
          return;
        }

        setOrgId(bootstrap.orgId);
        setCampaignType(strategy.campaignType);
        const parsedVideoConfig = parseVideoConfig(
          strategy.videoConfig,
          strategy.campaignType,
        );
        setVideoConfig(
          parsedVideoConfig.enabled
            ? parsedVideoConfig
            : defaultEnabledVideoConfig(strategy.campaignType),
        );
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load your video decision.",
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void loadVideoDecision();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function handleContinue() {
    if (!orgId || !campaignType || isSaving) return;

    setIsSaving(true);
    setError(null);
    try {
      await apiFetch(`/strategy/${orgId}/video-decision`, {
        method: "PATCH",
        body: JSON.stringify(videoConfig),
      });
      router.push(onboardingHref("checkout"));
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save your video decision.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  const hero = campaignType ? HERO_COPY[campaignType] : HERO_COPY.ai_video_ad;
  const showPageHero = campaignType === "uploaded_video";
  const canContinue =
    Boolean(orgId && campaignType) &&
    !isLoading &&
    (campaignType ? canContinueWith(campaignType, videoConfig) : false);

  return (
    <div className="onboarding-page relative flex h-dvh min-h-dvh w-full flex-col overflow-y-auto">
      <OnboardingChrome activeStep="video-decision" />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-5 pb-44 pt-28 lg:pb-28 lg:pt-34">
        {showPageHero ? (
          <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
            <HeroBadge icon={<Clapperboard className="size-7" />} />
            <h1 className="mt-5 text-3xl font-bold tracking-tight text-onboarding-ink sm:text-4xl dark:text-onboarding-neutral-0">
              {hero.title}
            </h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-onboarding-neutral-600 dark:text-onboarding-neutral-400">
              {hero.description}
            </p>
          </div>
        ) : null}

        {error ? (
          <p className="mx-auto mt-6 w-full max-w-5xl rounded-onboarding bg-onboarding-error-50 px-4 py-3 text-sm text-onboarding-error-900 dark:bg-onboarding-error-900 dark:text-onboarding-error-50" role="alert">
            {error}
          </p>
        ) : null}

        {isLoading ? (
          <OnboardingCard className="mx-auto mt-8 flex w-full max-w-5xl items-center justify-center gap-3 px-6 py-12 text-onboarding-neutral-600 dark:text-onboarding-neutral-400">
            <Loader2 className="size-5 animate-spin text-onboarding-purple-500" aria-hidden />
            Loading your video options
          </OnboardingCard>
        ) : campaignType ? (
          <div className={`mx-auto w-full max-w-5xl space-y-6 ${showPageHero ? "mt-8" : "mt-0"}`}>
            {campaignType === "personalized_outreach" ? (
              orgId ? (
                <PersonalizedOutreachVariant
                  orgId={orgId}
                  videoConfig={videoConfig}
                  setVideoConfig={setVideoConfig}
                />
              ) : null
            ) : null}
            {campaignType === "ai_video_ad" ? (
              <AiVideoAdVariant
                videoConfig={videoConfig}
                setVideoConfig={setVideoConfig}
              />
            ) : null}
            {campaignType === "uploaded_video" && orgId ? (
              <UploadedVideoVariant
                orgId={orgId}
                videoConfig={videoConfig}
                setVideoConfig={setVideoConfig}
                onError={setError}
              />
            ) : null}
          </div>
        ) : null}
      </main>

      <div className="onboarding-actions pointer-events-none fixed inset-x-0 z-30 flex items-center justify-between">
        <Button
          type="button"
          variant="secondary"
          onClick={() => router.push(onboardingHref("campaign-type"))}
          className="pointer-events-auto h-13 px-7 text-base"
        >
          <ArrowLeft className="size-5" aria-hidden />
          Back
        </Button>
        <Button
          type="button"
          variant="brand"
          disabled={!canContinue || isSaving}
          onClick={() => void handleContinue()}
          className="pointer-events-auto h-13 px-8 text-base sm:px-10"
        >
          {isSaving ? "Saving..." : "Continue to checkout"}
          <ArrowRight className="size-5" aria-hidden />
        </Button>
      </div>
    </div>
  );
}
