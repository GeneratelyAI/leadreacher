"use client";

import Image from "next/image";
import Link from "next/link";
import { useLayoutEffect, useMemo, useState } from "react";
import { OnboardingLogo } from "@/components/onboarding/OnboardingLogo";
import { Pill, type PillData } from "@/components/onboarding/Pill";
import { Button } from "@/components/ui/Button";
import { ArrowLeft, ArrowRight, CheckCircle2, Play } from "@/components/ui/icons";
import { useWebsiteScrapeStatus } from "@/hooks/useWebsiteScrapeStatus";
import { applyStoredTheme } from "@/hooks/useThemeMode";
import { apiFetch, bootstrapCurrentOrganization } from "@/lib/api";
import { getWebsiteFaviconUrl, parseWebsiteLink } from "@/lib/discovery-website";
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

export function VideoStyleSelection({
  mode,
  styleLabel,
}: {
  mode: "personalized" | "standardized";
  styleLabel: string;
}) {
  useLayoutEffect(() => applyStoredTheme(), []);

  const [selectedStyle, setSelectedStyle] = useState<VideoTone>("professional");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { status, websiteUrl } = useWebsiteScrapeStatus({ context: "authenticated" });
  const campaign = useMemo<PillData>(() => {
    const website = parseWebsiteLink(websiteUrl ?? status.url ?? "");
    const fields = [
      { label: "Market", value: status.market },
      { label: "Offer", value: status.offer },
      { label: "Customer", value: status.audience },
      { label: "Value", value: status.value },
      { label: "Goal", value: status.strategyStatus },
    ].filter((field): field is { label: string; value: string } => Boolean(field.value?.trim()));

    return {
      status: fields.length > 0 ? "ready" : "learning",
      statusLabel: fields.length > 0 ? "Business understood" : "Building your campaign",
      fields,
      site: website
        ? { label: website.hostname, iconUrl: getWebsiteFaviconUrl(website.hostname) }
        : undefined,
    };
  }, [status.audience, status.market, status.offer, status.strategyStatus, status.url, status.value, websiteUrl]);

  async function handleContinue() {
    if (isSaving) return;

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
      navigateOnboarding(onboardingHref("video-decision"));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save your video style.");
    } finally {
      setIsSaving(false);
    }
  }

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

        <div className="personalized-video-style-status" role="status">
          <CheckCircle2 className="personalized-video-style-status-icon" weight="fill" aria-hidden />
          <div>
            <p>YOUR CONTENT IS READY</p>
            <span>Created for your business and prospects.</span>
          </div>
        </div>

        <section className="personalized-video-style-options" aria-labelledby="personalized-video-style-options-title">
          <h2 id="personalized-video-style-options-title">Choose your favorite.</h2>
          <div className="personalized-video-style-grid" role="radiogroup" aria-label={styleLabel}>
            {STYLE_OPTIONS.map((option) => {
              const selected = option.id === selectedStyle;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  className={cn("personalized-video-style-card", selected && "personalized-video-style-card-selected")}
                  onClick={() => setSelectedStyle(option.id)}
                >
                  <span className="personalized-video-style-art" aria-hidden>
                    <Image src={option.image} alt="" fill sizes="(min-width: 63rem) 16rem, 80vw" className="object-cover" />
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
        <Button type="button" className="onboarding-campaign-next" disabled={isSaving} onClick={() => void handleContinue()}>
          {isSaving ? "Saving..." : "Use this"}
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
