"use client";

import { ArrowLeft, ArrowRight, Loader2 } from "@/components/ui/icons";
import { useEffect, useLayoutEffect, useState } from "react";
import { OnboardingCard } from "@/components/onboarding/OnboardingCard";
import { ActionBar } from "@/components/ui/ActionBar";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { applyStoredTheme } from "@/hooks/useThemeMode";
import { apiFetch, bootstrapCurrentOrganization } from "@/lib/api";
import { navigateOnboarding, onboardingHref } from "./steps";
import { GenerateVideo } from "./video-decision/GenerateVideo";
import { PersonalizeVideo } from "./video-decision/PersonalizeVideo";
import { ReviewMessage } from "./video-decision/ReviewMessage";
import { UploadVideo } from "./video-decision/UploadVideo";
import type { CampaignGoal, VideoConfig } from "./video-decision/types";

type StrategyResponse = {
  campaignType?: unknown;
  videoConfig?: unknown;
};

const HERO_COPY: Record<CampaignGoal, { title: string; description: string }> = {
  personalized_outreach: {
    title: "Choose your video tone",
    description: "Set the style we use for videos personalized to each prospect.",
  },
  ai_video_ad: {
    title: "Create your campaign video",
    description: "Choose the visual direction for one AI-generated video delivered to your selected prospects.",
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

function isCampaignGoal(value: unknown): value is CampaignGoal {
  return (
    value === "personalized_outreach" ||
    value === "ai_video_ad" ||
    value === "uploaded_video"
  );
}

function parseVideoConfig(value: unknown, campaignType: CampaignGoal): VideoConfig {
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

function defaultEnabledVideoConfig(campaignType: CampaignGoal): VideoConfig {
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

function canContinueWith(campaignType: CampaignGoal, videoConfig: VideoConfig): boolean {
  if (!videoConfig.enabled) return true;
  if (campaignType === "personalized_outreach") return videoConfig.tone !== null;
  if (campaignType === "ai_video_ad") return videoConfig.tone !== null;
  return videoConfig.uploadedVideoUrl !== null;
}

export default function VideoSetup() {
  useLayoutEffect(() => {
    applyStoredTheme();
  }, []);

  const [orgId, setOrgId] = useState<string | null>(null);
  const [campaignType, setCampaignGoal] = useState<CampaignGoal | null>(null);
  const [videoConfig, setVideoConfig] = useState<VideoConfig>(disabledVideoConfig);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadVideoSetup() {
      setIsLoading(true);
      setError(null);
      try {
        const bootstrap = await bootstrapCurrentOrganization();
        const strategy = await apiFetch<StrategyResponse>(
          `/strategy/${bootstrap.orgId}`,
        );
        if (cancelled) return;

        if (!isCampaignGoal(strategy.campaignType)) {
          navigateOnboarding(onboardingHref("campaign-type"));
          return;
        }

        setOrgId(bootstrap.orgId);
        setCampaignGoal(strategy.campaignType);
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

    void loadVideoSetup();
    return () => {
      cancelled = true;
    };
  }, [loadAttempt]);

  async function handleContinue() {
    if (!orgId || !campaignType || isSaving) return;

    setIsSaving(true);
    setError(null);
    try {
      await apiFetch(`/strategy/${orgId}/video-decision`, {
        method: "PATCH",
        body: JSON.stringify(videoConfig),
      });
      navigateOnboarding(onboardingHref("checkout"));
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
  const canContinue =
    Boolean(orgId && campaignType) &&
    !isLoading &&
    (campaignType ? canContinueWith(campaignType, videoConfig) : false);

  return (
    <div className="onboarding-page relative flex min-h-dvh w-full flex-col">
      <main className="onboarding-video-screen mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-5 pt-40 pb-44 h-compact:justify-start h-compact:pt-36 lg:pt-34 lg:pb-28">
        <PageHeader
          className="mx-auto"
          title={hero.title}
          description={hero.description}
        />

        {error ? (
          <Alert
            tone="error"
            className="mx-auto mt-6 w-full max-w-5xl"
            action={
              !isSaving ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setLoadAttempt((attempt) => attempt + 1)}
                >
                  Try again
                </Button>
              ) : null
            }
          >
            {error}
          </Alert>
        ) : null}

        {isLoading ? (
          <OnboardingCard
            className="mx-auto mt-8 w-full max-w-5xl"
            role="status"
            aria-live="polite"
          >
            <EmptyState
              icon={<Loader2 className="size-6 animate-spin" aria-hidden />}
              title="Loading your video options"
            />
          </OnboardingCard>
        ) : campaignType ? (
          <div className="onboarding-video-content mx-auto mt-8 w-full max-w-5xl space-y-6">
            {orgId ? <ReviewMessage orgId={orgId} /> : null}
            {campaignType === "personalized_outreach" ? (
              orgId ? (
                <PersonalizeVideo
                  videoConfig={videoConfig}
                  setVideoConfig={setVideoConfig}
                />
              ) : null
            ) : null}
            {campaignType === "ai_video_ad" ? (
              <GenerateVideo
                videoConfig={videoConfig}
                setVideoConfig={setVideoConfig}
              />
            ) : null}
            {campaignType === "uploaded_video" && orgId ? (
              <UploadVideo
                orgId={orgId}
                videoConfig={videoConfig}
                setVideoConfig={setVideoConfig}
                onError={setError}
              />
            ) : null}
          </div>
        ) : error ? (
          <OnboardingCard className="mx-auto mt-8 w-full max-w-5xl">
            <EmptyState title="Your video decision is unavailable" description="Retry loading your campaign settings to choose a video option." />
          </OnboardingCard>
        ) : null}
      </main>

      <ActionBar
        leading={
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigateOnboarding(onboardingHref("campaign-type"))}
            className="h-13 px-7 text-base"
          >
            <ArrowLeft className="size-5" aria-hidden />
            Back
          </Button>
        }
        trailing={
          <Button
            type="button"
            variant="primary"
            disabled={!canContinue || isSaving}
            onClick={() => void handleContinue()}
            className="h-13 px-8 text-base sm:px-10"
          >
            {isSaving ? "Saving..." : "Continue to checkout"}
            <ArrowRight className="size-5" aria-hidden />
          </Button>
        }
      />
    </div>
  );
}
