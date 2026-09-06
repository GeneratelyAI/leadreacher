"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createSemanticCampaignSummary } from "@/components/onboarding/campaign-summary";
import { OnboardingLogo } from "@/components/onboarding/OnboardingLogo";
import { Pill, useCampaignData } from "@/components/onboarding/Pill";
import { Button } from "@/components/ui/Button";
import { ArrowLeft, ArrowRight, CheckCircle2, Play, Sparkles } from "@/components/ui/icons";
import { useWebsiteScrapeStatus } from "@/hooks/useWebsiteScrapeStatus";
import { applyStoredTheme } from "@/hooks/useThemeMode";
import { apiFetch, bootstrapCurrentOrganization } from "@/lib/api";
import { cn } from "@/lib/utils";
import { navigateOnboarding, onboardingHref } from "./steps";
import type { VideoTone } from "./video-decision/types";

type StyleOption = {
  id: VideoTone;
  title: string;
  qualities: readonly string[];
  image: string;
  recommended?: boolean;
};

const STYLE_OPTIONS: readonly StyleOption[] = [
  {
    id: "professional",
    title: "Professional",
    qualities: ["Polished", "Credible", "Decision-maker focused"],
    image: "/landing/product-story/content-professional.webp",
    recommended: true,
  },
  {
    id: "casual",
    title: "Casual",
    qualities: ["Natural", "Approachable", "Conversational"],
    image: "/landing/product-story/content-casual.webp",
  },
  {
    id: "aggressive",
    title: "Aggressive",
    qualities: ["Direct", "High-energy", "Action-focused"],
    image: "/landing/product-story/content-aggressive.webp",
  },
];

type ContentAnimationPhase = "generating" | "ready" | "select" | "approved";

function reducedMotionPreferred(): boolean {
  return typeof window !== "undefined"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function VideoStyleSelection({
  mode,
  styleLabel,
}: {
  mode: "personalized" | "standardized";
  styleLabel: string;
}) {
  useLayoutEffect(() => applyStoredTheme(), []);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const [selectedStyle, setSelectedStyle] = useState<VideoTone>("professional");
  const hasChosenStyle = useRef(false);
  const savedCampaign = useCampaignData();
  const savedContent = savedCampaign?.sections?.find((section) => section.id === "content")?.value;
  useEffect(() => {
    if (hasChosenStyle.current || !savedContent) return;
    const savedStyle = STYLE_OPTIONS.find((option) => savedContent.endsWith(` · ${option.title}`));
    if (savedStyle) setSelectedStyle(savedStyle.id);
  }, [savedContent]);
  const [phase, setPhase] = useState<ContentAnimationPhase>("generating");
  const [loadedPreviews, setLoadedPreviews] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { status, websiteUrl } = useWebsiteScrapeStatus({ context: "authenticated" });
  const campaign = useMemo(() => {
    const approvedContent = phase === "approved"
      ? {
          type: mode === "personalized" ? "Personalized video" : "AI video",
          style: STYLE_OPTIONS.find((option) => option.id === selectedStyle)?.title,
        }
      : undefined;
    const summary = createSemanticCampaignSummary(status, approvedContent, websiteUrl);

    return phase === "approved"
      ? { ...summary, newlyCompletedSectionId: "content" as const }
      : summary;
  }, [mode, phase, selectedStyle, status, websiteUrl]);

  useEffect(() => {
    if (loadedPreviews.length !== STYLE_OPTIONS.length) return;
    setPhase(reducedMotionPreferred() ? "select" : "ready");
    const frame = window.requestAnimationFrame(() => setPhase("select"));
    return () => window.cancelAnimationFrame(frame);
  }, [loadedPreviews]);

  async function handleContinue() {
    if (isSaving || phase === "generating") return;

    setIsSaving(true);
    setError(null);
    try {
      const bootstrap = await bootstrapCurrentOrganization();
      await apiFetch(`/strategy/${bootstrap.orgId}/video-decision`, {
        method: "PATCH",
        body: JSON.stringify({
          enabled: true,
          mode,
          source: "generated",
          tone: selectedStyle,
          uploadedVideoUrl: null,
        }),
      });
      if (!mounted.current) return;
      setPhase("approved");
      window.requestAnimationFrame(() => {
        if (mounted.current) navigateOnboarding(onboardingHref("video-decision"));
      });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save your video style.");
    } finally {
      setIsSaving(false);
    }
  }

  const isPreparing = phase === "generating";
  const statusIsReady = phase !== "generating";
  const contentTypeLabel = mode === "personalized" ? "personalized videos" : "AI video";

  return (
    <section className="personalized-video-style-page">
      <Link href="/" aria-label="LeadReacher home" className="onboarding-brand-anchor inline-flex">
        <OnboardingLogo className="landing-navbar-logo onboarding-brand-wordmark" />
      </Link>

      <main className="personalized-video-style-main" aria-labelledby="personalized-video-style-title">
        <header className="personalized-video-style-header">
          <h1 id="personalized-video-style-title">
            Campaign Content<span className="signup-campaign-period">.</span>
          </h1>
        </header>

        <div
          className={cn(
            "personalized-video-style-status",
            `personalized-video-style-status-${statusIsReady ? "ready" : "generating"}`,
          )}
          role="status"
          aria-live="polite"
        >
          {statusIsReady
            ? <CheckCircle2 className="personalized-video-style-status-icon" weight="fill" aria-hidden />
            : <Sparkles className="personalized-video-style-status-icon" weight="fill" aria-hidden />}
          <div className="personalized-video-style-status-copy" key={statusIsReady ? "ready" : "generating"}>
            <p>{statusIsReady ? "Your content is ready." : `Creating your ${contentTypeLabel}...`}</p>
            <span>{statusIsReady ? "Created for your business and prospects." : "Building three directions for your business and prospects."}</span>
          </div>
        </div>

        <section
          className={cn(
            "personalized-video-style-options",
            `personalized-video-style-options-${phase}`,
          )}
          aria-labelledby="personalized-video-style-options-title"
        >
          <h2 id="personalized-video-style-options-title">Choose your favorite.</h2>
          <div
            className={cn(
              "personalized-video-style-grid",
              isPreparing && "personalized-video-style-grid-preparing",
            )}
            role="radiogroup"
            aria-label={styleLabel}
          >
            {STYLE_OPTIONS.map((option) => {
              const selected = option.id === selectedStyle;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-hidden={isPreparing}
                  tabIndex={isPreparing ? -1 : undefined}
                  disabled={isPreparing || isSaving || phase === "approved"}
                  className={cn(
                    "personalized-video-style-card",
                    isPreparing && "personalized-video-style-card-preparing",
                    selected && !isPreparing && "personalized-video-style-card-selected",
                    selected && phase === "approved" && "personalized-video-style-card-approved",
                  )}
                  onClick={() => {
                    hasChosenStyle.current = true;
                    setSelectedStyle(option.id);
                  }}
                >
                  <span className="personalized-video-style-art" aria-hidden>
                    <Image
                      src={option.image}
                      alt=""
                      fill
                      loading="eager"
                      sizes="(min-width: 63rem) 16rem, 80vw"
                      className="object-cover"
                      onLoad={() => setLoadedPreviews((loaded) => loaded.includes(option.id) ? loaded : [...loaded, option.id])}
                      onError={() => {
                        setError("A preview could not load. You can still select its style.");
                        setLoadedPreviews((loaded) => loaded.includes(option.id) ? loaded : [...loaded, option.id]);
                      }}
                    />
                    <span className="personalized-video-style-play"><Play className="size-6" weight="fill" /></span>
                    <span className="personalized-video-style-duration">0:10</span>
                  </span>
                  <span className="personalized-video-style-card-title">
                    {option.title}
                    {option.recommended ? <span>Recommended</span> : null}
                  </span>
                  <span className="personalized-video-style-card-description">
                    {option.qualities.map((quality) => <span key={quality}>{quality}</span>)}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {error ? <p className="personalized-video-style-error" role="alert">{error}</p> : null}
      </main>

      <div className="personalized-video-style-actions">
        <Button type="button" variant="secondary" className="campaign-content-back" onClick={() => navigateOnboarding(onboardingHref("campaign-content"))}>
          <ArrowLeft className="size-5" aria-hidden />
          Back
        </Button>
        <Button
          type="button"
          className="onboarding-campaign-next"
          disabled={isSaving || isPreparing || phase === "approved"}
          onClick={() => void handleContinue()}
        >
          {isPreparing ? "Creating..." : phase === "approved" ? "Approved" : isSaving ? "Saving..." : "Use this"}
          <ArrowRight className="size-5" aria-hidden />
        </Button>
      </div>

      <aside className="signup-campaign-pill-column" aria-label="Live campaign summary">
        <Pill campaign={campaign} className="signup-campaign-pill" />
      </aside>
    </section>
  );
}

export default function PersonalizedVideoStyle() {
  return <VideoStyleSelection mode="personalized" styleLabel="Personalized video style" />;
}
