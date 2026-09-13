"use client";

import Image from "next/image";
import type { CampaignType as PersistedCampaignType } from "@leadreacher/shared/campaign";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ArrowLeft, ArrowRight, Check, Play, Upload, type AppIcon } from "@/components/ui/icons";
import { applyStoredTheme } from "@/hooks/useThemeMode";
import { apiFetch, bootstrapCurrentOrganization } from "@/lib/api";
import { cn } from "@/lib/utils";
import { recoverContentChoice, type ContentChoice } from "@/features/onboarding/public/content-choice";
import { beginOnboardingNavigation, navigateOnboarding, onboardingHref, restoreOnboardingNavigation } from "../../public/navigation";
import { useCampaignPillDraft } from "../../state/campaign-context";
import { CreativeIllustration } from "./CreativeIllustrations";
import mobile from "./CreativeMobile.module.css";

type ContentOptionId = ContentChoice;

type ContentOption = {
  id: ContentOptionId;
  title: string;
  description: string;
  detail: string;
  image?: string;
  illustration?: string;
  icon?: AppIcon;
  recommended?: boolean;
  mobileDescription: string;
};

const CONTENT_OPTIONS: readonly ContentOption[] = [
  {
    id: "personalized-video",
    title: "Personalized Video",
    description: "Speak to every prospect by name.",
    detail: "One-to-one AI video.",
    image: "/landing/product-story/personalized-video-outreach-poster.webp",
    recommended: true,
    mobileDescription: "A personal introduction for every prospect.",
  },
  {
    id: "ai-video",
    title: "AI Video",
    description: "Create it with AI.",
    detail: "One sales-focused video at scale.",
    image: "/landing/product-story/content-professional.webp",
    mobileDescription: "One sales-focused video at scale.",
  },
  {
    id: "your-video",
    title: "Your Video",
    description: "Put your video to work.",
    detail: "Upload existing creative.",
    icon: Upload,
    mobileDescription: "Upload your existing creative.",
  },
  {
    id: "document",
    title: "Document",
    description: "Give them something worth opening.",
    detail: "Deck · Case study · Brochure · PDF",
    illustration: "/onboarding/campaign-content-pdf.svg",
    mobileDescription: "Share a deck, brochure, or PDF.",
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
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const [selectedId, setSelectedId] = useState<ContentOptionId>("personalized-video");
  const choiceTouched = useRef(false);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { orgId } = await bootstrapCurrentOrganization();
        const saved = await apiFetch<Parameters<typeof recoverContentChoice>[0]>(`/strategy/${orgId}`);
        if (!cancelled && !choiceTouched.current) setSelectedId(recoverContentChoice(saved));
      } catch { /* The submit path reports recovery or authentication failures. */ }
    })();
    return () => { cancelled = true; };
  }, []);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const { setDraft } = useCampaignPillDraft();

  async function handleContinue() {
    if (isSaving) return;

    const destination = onboardingHref(
      selectedId === "personalized-video"
        ? "personalized-video"
        : selectedId === "ai-video"
          ? "ai-video"
          : selectedId === "your-video"
            ? "your-video"
            : selectedId === "document"
              ? "document"
              : "campaign-content",
    );
    if (!beginOnboardingNavigation(destination)) return;
    setIsSaving(true);
    setError(null);
    setIsTransitioning(true);
    let didNavigate = false;
    try {
      const bootstrap = await bootstrapCurrentOrganization();
      await apiFetch(`/strategy/${bootstrap.orgId}/campaign-type`, {
        method: "PATCH",
        body: JSON.stringify({ campaignType: PERSISTED_CAMPAIGN_TYPES[selectedId], contentChoice: selectedId }),
      });
      if (!mounted.current) return;
      didNavigate = true;
      navigateOnboarding(destination);
    } catch (cause) {
      restoreOnboardingNavigation();
      setError(cause instanceof Error ? cause.message : "Unable to save your content choice.");
    } finally {
      setIsSaving(false);
      if (!didNavigate) setIsTransitioning(false);
    }
  }

  return (
    <section className={cn("campaign-content-page", mobile.page)}>
      <main className="campaign-content-main" aria-labelledby="campaign-content-title">
        <header className="campaign-content-header">
          <h1 id="campaign-content-title">
            <span className={mobile.desktopOnly}>Campaign Content<span className="signup-campaign-period">.</span></span>
            <span className={mobile.mobileOnly}>What will you send?</span>
          </h1>
          <p><span className={mobile.desktopOnly}>Choose what you want to send prospects.</span><span className={mobile.mobileOnly}>Choose the content for your campaign.</span></p>
        </header>

        <section
          className={cn(
            "campaign-content-options",
            isTransitioning && "campaign-content-options-exiting",
          )}
          aria-labelledby="campaign-content-options-title"
        >
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
                  tabIndex={selected ? 0 : -1}
                  disabled={isSaving}
                  className={cn(
                    "campaign-content-option",
                    selected && "campaign-content-option-selected",
                    isTransitioning && selected && "campaign-content-option-approving",
                  )}
                  onClick={() => { choiceTouched.current = true; setSelectedId(option.id); setDraft({ sectionId: "content", summary: option.title, value: option.title }); }}
                  onKeyDown={(event) => {
                    const direction = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
                    if (!direction && event.key !== "Home" && event.key !== "End") return;
                    event.preventDefault();
                    const current = CONTENT_OPTIONS.findIndex((choice) => choice.id === option.id);
                    const index = event.key === "Home" ? 0 : event.key === "End" ? CONTENT_OPTIONS.length - 1 : (current + direction + CONTENT_OPTIONS.length) % CONTENT_OPTIONS.length;
                    choiceTouched.current = true;
                    setSelectedId(CONTENT_OPTIONS[index].id);
                    const next = CONTENT_OPTIONS[index];
                    setDraft({ sectionId: "content", summary: next.title, value: next.title });
                    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[index]?.focus({ preventScroll: true });
                  }}
                >
                  <span className={mobile.optionRadio} aria-hidden />
                  <CreativeIllustration kind={option.id} className={mobile.mobileArt} />
                  <span className="campaign-content-option-art" data-story-object={option.image ? "media" : option.id === "your-video" ? "content:upload" : undefined} data-story-asset={option.image ? `media:${option.image}` : undefined} aria-hidden>
                    {option.image ? (
                      <>
                        <Image src={option.image} alt="" fill sizes="(min-width: 63rem) 12rem, 45vw" className="object-cover" />
                        <span className="campaign-content-option-play"><Play className="size-5" weight="fill" /></span>
                      </>
                    ) : option.illustration ? (
                      // The local SVG must bypass image optimization to retain its native vector rendering.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={option.illustration}
                        alt=""
                        width={96}
                        height={80}
                        className="campaign-content-option-illustration"
                        draggable={false}
                      />
                    ) : Icon ? (
                      <Icon className="campaign-content-option-icon" weight="fill" />
                    ) : null}
                  </span>
                  {selected ? <span className="campaign-content-option-check"><Check className="size-4" weight="bold" /></span> : null}
                  <span className="campaign-content-option-title">{option.title}</span>
                  <span className="campaign-content-option-description">{option.description}</span>
                  <span className="campaign-content-option-detail">{option.detail}</span>
                  <span className={cn(mobile.mobileOnly, mobile.optionDescription)}>{option.mobileDescription}</span>
                  {option.recommended ? <span className="campaign-content-option-recommended">Recommended</span> : null}
                </button>
              );
            })}
          </div>
        </section>

        {error ? <p role="alert">{error}</p> : null}
        <div className="campaign-content-actions">
          <Button type="button" variant="secondary" className="campaign-content-back" onClick={() => navigateOnboarding(onboardingHref("discovery"))}>
            <ArrowLeft className="size-5" aria-hidden />
            Back
          </Button>
          <Button type="button" className="onboarding-campaign-next" disabled={isSaving} onClick={() => void handleContinue()}>
            {isSaving ? "Saving..." : "Continue"}
            <ArrowRight className="size-5" aria-hidden />
          </Button>
        </div>
      </main>

    </section>
  );
}
