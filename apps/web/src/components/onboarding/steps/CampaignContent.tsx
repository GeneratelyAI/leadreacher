"use client";

import Image from "next/image";
import Link from "next/link";
import { useLayoutEffect, useMemo, useState } from "react";
import { OnboardingLogo } from "@/components/onboarding/OnboardingLogo";
import { Pill, type PillData } from "@/components/onboarding/Pill";
import { Button } from "@/components/ui/Button";
import { ArrowLeft, ArrowRight, Check, FileText, Play, Upload, type AppIcon } from "@/components/ui/icons";
import { useWebsiteScrapeStatus } from "@/hooks/useWebsiteScrapeStatus";
import { applyStoredTheme } from "@/hooks/useThemeMode";
import { apiFetch, bootstrapCurrentOrganization } from "@/lib/api";
import { getWebsiteFaviconUrl, parseWebsiteLink } from "@/lib/discovery-website";
import { cn } from "@/lib/utils";
import { navigateOnboarding, onboardingHref, strategyHref } from "./steps";

type ContentOptionId = "personalized-video" | "ai-video" | "your-video" | "document";
type PersistedCampaignType = "personalized_outreach" | "ai_video_ad" | "uploaded_video";

type ContentOption = {
  id: ContentOptionId;
  title: string;
  description: string;
  detail: string;
  image?: string;
  icon?: AppIcon;
  recommended?: boolean;
};

const CONTENT_OPTIONS: readonly ContentOption[] = [
  {
    id: "personalized-video",
    title: "Personalized Video",
    description: "Speak to every prospect by name.",
    detail: "One-to-one AI video.",
    image: "/landing/product-story/personalized-video-outreach-poster.webp",
    recommended: true,
  },
  {
    id: "ai-video",
    title: "AI Video",
    description: "Create it with AI.",
    detail: "One sales-focused video at scale.",
    image: "/landing/product-story/content-professional.webp",
  },
  {
    id: "your-video",
    title: "Your Video",
    description: "Put your video to work.",
    detail: "Upload existing creative.",
    icon: Upload,
  },
  {
    id: "document",
    title: "Document",
    description: "Give them something worth opening.",
    detail: "Deck · Case study · Brochure · PDF",
    icon: FileText,
  },
];

const PERSISTED_CAMPAIGN_TYPES: Record<ContentOptionId, PersistedCampaignType> = {
  "personalized-video": "personalized_outreach",
  "ai-video": "ai_video_ad",
  "your-video": "uploaded_video",
  document: "uploaded_video",
};

export default function CampaignContent() {
  useLayoutEffect(() => applyStoredTheme(), []);

  const [selectedId, setSelectedId] = useState<ContentOptionId>("personalized-video");
  const [isSaving, setIsSaving] = useState(false);
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
    try {
      const bootstrap = await bootstrapCurrentOrganization();
      await apiFetch(`/strategy/${bootstrap.orgId}/campaign-type`, {
        method: "PATCH",
        body: JSON.stringify({ campaignType: PERSISTED_CAMPAIGN_TYPES[selectedId] }),
      });
      navigateOnboarding(onboardingHref(
        selectedId === "personalized-video"
          ? "personalized-video-style"
          : selectedId === "ai-video"
            ? "ai-video-style"
          : selectedId === "your-video"
            ? "upload-video"
            : "video-decision",
      ));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="campaign-content-page">
      <Link href="/" aria-label="LeadReacher home" className="onboarding-brand-anchor inline-flex">
        <OnboardingLogo className="landing-navbar-logo onboarding-brand-wordmark" />
      </Link>

      <main className="campaign-content-main" aria-labelledby="campaign-content-title">
        <header className="campaign-content-header">
          <h1 id="campaign-content-title">
            Campaign Content<span className="signup-campaign-period">.</span>
          </h1>
          <p>Choose what you want to send prospects.</p>
        </header>

        <section className="campaign-content-options" aria-labelledby="campaign-content-options-title">
          <div className="campaign-content-options-copy">
            <h2 id="campaign-content-options-title">Video gets more attention. And more replies.</h2>
            <p>Add it to your campaign to drive higher engagement and conversions.</p>
          </div>

          <div className="campaign-content-options-grid" role="radiogroup" aria-label="Campaign content type">
            {CONTENT_OPTIONS.map((option) => {
              const selected = option.id === selectedId;
              const Icon = option.icon;

              return (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  className={cn("campaign-content-option", selected && "campaign-content-option-selected")}
                  onClick={() => setSelectedId(option.id)}
                >
                  <span className="campaign-content-option-art" aria-hidden>
                    {option.image ? (
                      <>
                        <Image src={option.image} alt="" fill sizes="(min-width: 63rem) 12rem, 45vw" className="object-cover" />
                        <span className="campaign-content-option-play"><Play className="size-5" weight="fill" /></span>
                      </>
                    ) : Icon ? (
                      <Icon className="campaign-content-option-icon" weight="fill" />
                    ) : null}
                  </span>
                  {selected ? <span className="campaign-content-option-check"><Check className="size-4" weight="bold" /></span> : null}
                  <span className="campaign-content-option-title">{option.title}</span>
                  <span className="campaign-content-option-description">{option.description}</span>
                  <span className="campaign-content-option-detail">{option.detail}</span>
                  {option.recommended ? <span className="campaign-content-option-recommended">Recommended</span> : null}
                </button>
              );
            })}
          </div>
        </section>

        <div className="campaign-content-actions">
          <Button type="button" variant="secondary" className="campaign-content-back" onClick={() => navigateOnboarding(strategyHref("how-it-works"))}>
            <ArrowLeft className="size-5" aria-hidden />
            Back
          </Button>
          <Button type="button" className="onboarding-campaign-next" disabled={isSaving} onClick={() => void handleContinue()}>
            {isSaving ? "Saving..." : "Continue"}
            <ArrowRight className="size-5" aria-hidden />
          </Button>
        </div>
      </main>

      <aside className="signup-campaign-pill-column" aria-label="Live campaign summary">
        <Pill campaign={campaign} className="signup-campaign-pill" />
      </aside>
    </section>
  );
}
